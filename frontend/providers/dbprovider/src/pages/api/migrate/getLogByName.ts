import { authSession } from '@/services/backend/auth';
import { getK8s } from '@/services/backend/kubernetes';
import { jsonRes } from '@/services/backend/response';
import { ApiResp } from '@/services/kubernet';
import { Log } from '@kubernetes/client-node';
import type { NextApiRequest, NextApiResponse } from 'next';
import { PassThrough } from 'stream';

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResp>) {
  const { kc, k8sCore, namespace } = await getK8s({
    kubeconfig: await authSession(req)
  });

  console.log(namespace);

  const {
    podName,
    containerName,
    stream = false,
    logSize,
    previous,
    sinceTime
  } = req.body as {
    containerName: string;
    podName: string;
    stream: boolean;
    logSize?: number;
    previous?: boolean;
    sinceTime?: number;
  };

  if (!podName) {
    throw new Error('podName is empty');
  }

  if (!stream) {
    const sinceSeconds =
      sinceTime && !!!previous ? Math.floor((Date.now() - sinceTime) / 1000) : undefined;
    try {
      const { body: data } = await k8sCore.readNamespacedPodLog(
        podName,
        namespace,
        containerName,
        undefined,
        undefined,
        undefined,
        undefined,
        previous,
        sinceSeconds,
        logSize
      );
      return jsonRes(res, {
        data
      });
    } catch (error: any) {
      jsonRes(res, {
        code: 500,
        error
      });
    }
  }
}

function timestampToRFC3339(timestamp: number) {
  return new Date(timestamp).toISOString();
}

// let streamResponse: any;
// const logStream = new PassThrough();

// const destroyStream = () => {
//   streamResponse?.destroy();
//   logStream?.destroy();
// };

// logStream.on('error', () => {
//   console.log('stream error');
//   destroyStream();
// });
// res.on('close', () => {
//   console.log('connect close');
//   destroyStream();
// });
// res.on('error', () => {
//   console.log('error: ', 'request error');
//   destroyStream();
// });

// res.setHeader('Content-Type', 'text/event-stream;charset-utf-8');
// res.setHeader('Access-Control-Allow-Origin', '*');
// res.setHeader('X-Accel-Buffering', 'no');
// res.setHeader('Cache-Control', 'no-cache, no-transform');

// res.flushHeaders();

// logStream.pipe(res);

// const reqData = {
//   follow: true,
//   pretty: false,
//   timestamps: false,
//   tailLines: 1000,
//   previous: !!previous
// } as any;
// if (!reqData.previous && sinceTime) {
//   reqData.sinceTime = timestampToRFC3339(sinceTime);
// }

// try {
//   const logs = new Log(kc);
//   streamResponse = await logs.log(
//     namespace,
//     podName,
//     containerName,
//     logStream,
//     (err) => {
//       if (err) {
//         console.log('pod log err', err);
//         res.write(err.toString());
//       }
//       destroyStream();
//     },
//     reqData
//   );
// } catch (err: any) {}
