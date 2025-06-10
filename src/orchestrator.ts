import { Context } from '@osaas/client-core';
import { setupListener } from './storage/minio';
import { createUniqueSlug } from './util';
import { transcode } from '@osaas/client-transcode';

export interface OrchestratorOptions {
  publicBaseUrl: string;
  inputBucket: string;
  abrsubsBucket: string;
  encoreUrl: string;
  s3EndpointUrl: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
}

export default (opts: OrchestratorOptions) => {
  const handleCreateNotification = async (record: any): Promise<void> => {
    console.log(
      `File created: s3://${record.s3.bucket.name}/${record.s3.object.key}`
    );
    const filename =
      record.s3.object.key.split('/').pop() || record.s3.object.key;
    const externalId = createUniqueSlug(filename);

    const ctx = new Context();
    const encoreServiceAccessToken = await ctx.getServiceAccessToken('encore');
    const job = await transcode(
      ctx,
      {
        encoreInstanceName: 'mediasupply',
        profile: 'program',
        callBackUrl: new URL('/encoreCallback', opts.publicBaseUrl),
        externalId,
        inputUrl: new URL(
          `s3://${record.s3.bucket.name}/${record.s3.object.key}`
        ),
        outputUrl: new URL(`s3://${opts.abrsubsBucket}/${externalId}/`)
      },
      {
        endpointUrl: new URL(opts.encoreUrl),
        bearerToken: encoreServiceAccessToken
      }
    );
    console.log(job);
  };
  setupListener(
    opts.inputBucket,
    new URL(opts.s3EndpointUrl),
    opts.s3AccessKeyId,
    opts.s3SecretAccessKey,
    handleCreateNotification
  );
};
