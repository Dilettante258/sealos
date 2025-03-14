import { authSession } from '@/services/backend/auth';
import { getK8s } from '@/services/backend/kubernetes';
import { jsonRes } from '@/services/backend/response';
import { ApiResp } from '@/services/kubernet';
import { KbPgClusterType } from '@/types/cluster';
import { BackupItemType, DBComponentsName, DBEditType, ResourceType } from '@/types/db';
import { json2Account, json2ResourceOps, json2CreateCluster } from '@/utils/json2Yaml';
import type { NextApiRequest, NextApiResponse } from 'next';
import { updateBackupPolicyApi } from './backup/updatePolicy';
import { BackupSupportedDBTypeList, DBComponents } from '@/constants/db';
import { adaptDBDetail, convertBackupFormToSpec } from '@/utils/adapt';
import { CustomObjectsApi, PatchUtils } from '@kubernetes/client-node';
import { isEqual } from 'lodash';

function compareResourceChanges(arr1: ResourceType[], arr2: ResourceType[]) {
  const changes: Array<{
    type: 'VerticalScaling' | 'HorizontalScaling' | 'VolumeExpansion';
    name: DBComponentsName;
  }> = [];

  arr1.forEach((item1) => {
    const correspondingItem = arr2.find(
      (item2) => item1.name === item2.name && !isEqual(item1, item2)
    );
    if (correspondingItem !== undefined) {
      for (const key of Object.keys(item1) as (keyof ResourceType)[]) {
        if (item1[key] !== correspondingItem[key]) {
          let type: 'VerticalScaling' | 'HorizontalScaling' | 'VolumeExpansion' = 'VolumeExpansion';
          switch (key) {
            case 'cpu':
            case 'memory':
              type = 'VerticalScaling';
              break;
            case 'replicas':
              type = 'HorizontalScaling';
              break;
            case 'storage':
              type = 'VolumeExpansion';
              break;
          }
          changes.push({
            type,
            name: item1.name
          });
        }
      }
    }
  });
  return changes;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResp>) {
  try {
    const { dbForm, isEdit, backupInfo } = req.body as {
      dbForm: DBEditType;
      isEdit: boolean;
      backupInfo?: BackupItemType;
    };

    const { k8sCustomObjects, namespace, applyYamlList, delYamlList } = await getK8s({
      kubeconfig: await authSession(req)
    });

    if (isEdit) {
      const { body } = (await k8sCustomObjects.getNamespacedCustomObject(
        'apps.kubeblocks.io',
        'v1alpha1',
        namespace,
        'clusters',
        dbForm.dbName
      )) as {
        body: KbPgClusterType;
      };
      // resources is legal: not inclued dirty data
      const { resources, terminationPolicy } = adaptDBDetail(body);
      const newResources = dbForm.resources.filter((item) =>
        DBComponents[dbForm.dbType].includes(item.name)
      );

      const opsRequests: string[] = [];

      const change = compareResourceChanges(newResources, resources);

      change.map((item) => {
        const changeYaml = json2ResourceOps(dbForm, item.name, item.type);
        opsRequests.push(changeYaml);
      });

      console.log('DB Edit Operation:', {
        dbName: dbForm.dbName,
        changes: change,
        opsCount: opsRequests.length
      });

      if (opsRequests.length > 0) {
        await applyYamlList(opsRequests, 'create');
      }

      if (BackupSupportedDBTypeList.includes(dbForm.dbType) && dbForm?.autoBackup) {
        const autoBackup = convertBackupFormToSpec({
          autoBackup: dbForm?.autoBackup,
          dbType: dbForm.dbType
        });

        await updateBackupPolicyApi({
          dbName: dbForm.dbName,
          dbType: dbForm.dbType,
          autoBackup,
          k8sCustomObjects,
          namespace
        });

        if (terminationPolicy !== dbForm.terminationPolicy) {
          await updateTerminationPolicyApi({
            dbName: dbForm.dbName,
            terminationPolicy: dbForm.terminationPolicy,
            k8sCustomObjects,
            namespace
          });
        }
      }

      return jsonRes(res, {
        data: `Successfully submitted ${opsRequests.length} change requests`
      });
    }

    const account = json2Account(dbForm);
    const cluster = json2CreateCluster(dbForm, backupInfo, {
      storageClassName: process.env.STORAGE_CLASSNAME
    });
    await applyYamlList([account, cluster], 'create');
    const { body } = (await k8sCustomObjects.getNamespacedCustomObject(
      'apps.kubeblocks.io',
      'v1alpha1',
      namespace,
      'clusters',
      dbForm.dbName
    )) as {
      body: KbPgClusterType;
    };
    const dbUid = body.metadata.uid;
    const dbName = body.metadata.name;

    const updateAccountYaml = json2Account(dbForm, dbUid);

    await applyYamlList([updateAccountYaml], 'replace');

    if (BackupSupportedDBTypeList.includes(dbForm.dbType) && dbForm?.autoBackup) {
      const autoBackup = convertBackupFormToSpec({
        autoBackup: dbForm?.autoBackup,
        dbType: dbForm.dbType
      });

      await updateBackupPolicyApi({
        dbName: dbForm.dbName,
        dbType: dbForm.dbType,
        autoBackup,
        k8sCustomObjects,
        namespace
      });
    }

    jsonRes(res, {
      data: 'success create db'
    });
  } catch (err: any) {
    jsonRes(res, {
      code: 500,
      error: err
    });
  }
}

export async function updateTerminationPolicyApi({
  dbName,
  terminationPolicy,
  k8sCustomObjects,
  namespace
}: {
  dbName: string;
  terminationPolicy: string;
  k8sCustomObjects: CustomObjectsApi;
  namespace: string;
}) {
  const group = 'apps.kubeblocks.io';
  const version = 'v1alpha1';
  const plural = 'clusters';

  const patch = [
    {
      op: 'replace',
      path: '/spec/terminationPolicy',
      value: terminationPolicy
    }
  ];

  const result = await k8sCustomObjects.patchNamespacedCustomObject(
    group,
    version,
    namespace,
    plural,
    dbName,
    patch,
    undefined,
    undefined,
    undefined,
    { headers: { 'Content-type': PatchUtils.PATCH_FORMAT_JSON_PATCH } }
  );

  return result;
}
