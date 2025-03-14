import { getUserQuota } from '@/api/platform';
import { DBEditType, ResourceType } from '@/types/db';
import { I18nCommonKey } from '@/types/i18next';
import { UserQuotaItemType } from '@/types/user';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

type State = {
  balance: number;
  userQuota: UserQuotaItemType[];
  loadUserQuota: () => Promise<null>;
  checkQuotaAllow: (request: DBEditType, usedData?: DBEditType) => I18nCommonKey | undefined;
};

const calculateResourceConsumption = (
  resources: ResourceType[]
): { cpu: number; memory: number; storage: number } => {
  return resources.reduce(
    (accumulator, currentResource) => {
      accumulator.cpu += (currentResource.cpu / 1000) * currentResource.replicas;
      accumulator.memory += (currentResource.memory / 1024) * currentResource.replicas;
      accumulator.storage += currentResource.storage * currentResource.replicas;
      return accumulator;
    },
    { cpu: 0, memory: 0, storage: 0 }
  );
};

export const useUserStore = create<State>()(
  devtools(
    immer((set, get) => ({
      balance: 5,
      userQuota: [],
      loadUserQuota: async () => {
        const response = await getUserQuota();

        set((state) => {
          state.userQuota = response.quota;
        });
        return null;
      },
      checkQuotaAllow: ({ resources }, usedData): I18nCommonKey | undefined => {
        const quote = get().userQuota;

        const request = calculateResourceConsumption(resources);

        if (usedData) {
          const used = calculateResourceConsumption(usedData.resources);
          request.cpu -= used.cpu;
          request.memory -= used.memory;
          request.storage -= used.storage;
        }

        const overLimitTip: { [key: string]: I18nCommonKey } = {
          cpu: 'app.cpu_exceeds_quota',
          memory: 'app.memory_exceeds_quota',
          storage: 'app.storage_exceeds_quota'
        };

        const exceedQuota = quote.find((item) => {
          if (item.used + request[item.type] > item.limit) {
            return true;
          }
        });

        return exceedQuota?.type ? overLimitTip[exceedQuota.type] : undefined;
      }
    }))
  )
);
