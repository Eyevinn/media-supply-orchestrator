import { Context, createJob } from '@osaas/client-core';
import { setupListener } from './storage/minio';
import { createUniqueSlug } from './util';
import { getTranscodeJob, transcode } from '@osaas/client-transcode';
import { FastifyInstance } from 'fastify';
import { encoreCallbackApi } from './orchestrator/encoreCallback';
import {
  DEFAULT_STREAM_KEY_TEMPLATES,
  EncoreJob,
  parseInputsFromEncoreJob
} from './orchestrator/encore';
import { WorkOrderManager } from './orchestrator/workorder';

export interface OrchestratorOptions {
  publicBaseUrl: string;
  inputBucket: string;
  abrsubsBucket: string;
  outputBucket: string;
  encoreUrl: string;
  s3EndpointUrl: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  api: FastifyInstance;
}

export default (opts: OrchestratorOptions) => {
  const workOrderManager = new WorkOrderManager();
  const ctx = new Context();

  const timer = setInterval(async () => {
    const openWorkOrders = await workOrderManager.getOpenWorkOrders();
    for (const workOrder of openWorkOrders) {
      console.debug(
        `Open work order found: ${workOrder.id} - ${workOrder.createdAt}`
      );
      if (workOrder.tasks.every((task) => task.status === 'COMPLETED')) {
        console.debug(`All tasks done for work order ${workOrder.id}`);
        await workOrderManager.updateWorkOrder(workOrder.id, 'CLOSED');
      } else {
        for (const task of workOrder.tasks) {
          if (
            task.status === 'PENDING' &&
            task.dependsOn.every(
              (t) =>
                workOrder.tasks.find((wt) => wt.type === t)?.status ===
                'COMPLETED'
            )
          ) {
            console.debug(
              `Starting task ${task.type} for work order ${workOrder.id}`
            );
            if (task.type === 'ABR_TRANSCODE') {
              const encoreServiceAccessToken = await ctx.getServiceAccessToken(
                'encore'
              );
              const job = await transcode(
                ctx,
                {
                  encoreInstanceName: 'mediasupply',
                  profile: 'program',
                  callBackUrl: new URL('/encoreCallback', opts.publicBaseUrl),
                  externalId: workOrder.id,
                  inputUrl: workOrder.source,
                  outputUrl: new URL(
                    `s3://${opts.abrsubsBucket}/${workOrder.id}/`
                  )
                },
                {
                  endpointUrl: new URL(opts.encoreUrl),
                  bearerToken: encoreServiceAccessToken
                }
              );
              console.debug(job);
              task.status = 'IN_PROGRESS';
            } else if (task.type === 'VOD_PACKAGE') {
              const workOrderTask = await workOrderManager.getWorkOrderTask(
                workOrder.id,
                'ABR_TRANSCODE'
              );
              const job = workOrderTask?.taskPayload;
              if (!job) {
                console.error(
                  `No ABR_TRANSCODE job found for work order ${workOrder.id}`
                );
                continue;
              }
              const inputs = parseInputsFromEncoreJob(
                job as EncoreJob,
                DEFAULT_STREAM_KEY_TEMPLATES
              );
              console.debug(inputs);
              const shakaArgs =
                `-s s3://${opts.abrsubsBucket}/${job.externalId} -d s3://${opts.outputBucket}/${job.externalId}/ ` +
                inputs
                  .map((input) => {
                    const TYPE_MAP: Record<string, string> = {
                      video: 'v',
                      audio: 'a',
                      text: 't'
                    };
                    const basename = new URL(input.filename).pathname
                      .split('/')
                      .pop();
                    if (!basename) {
                      throw new Error(
                        `Could not extract basename from ${input.filename}`
                      );
                    }
                    return `-i ${TYPE_MAP[input.type]}:${
                      input.key
                    }=${basename}`;
                  })
                  .join(' ');
              console.debug(`Shaka arguments: ${shakaArgs}`);
              const shakaJobId = job.externalId!.replace(/-/g, '');
              const shakaServiceAccessToken = await ctx.getServiceAccessToken(
                'eyevinn-shaka-packager-s3'
              );
              const shakaJob = await createJob(
                ctx,
                'eyevinn-shaka-packager-s3',
                shakaServiceAccessToken,
                {
                  name: shakaJobId,
                  cmdLineArgs: shakaArgs,
                  awsAccessKeyId: opts.s3AccessKeyId,
                  awsSecretAccessKey: opts.s3SecretAccessKey,
                  s3EndpointUrl: opts.s3EndpointUrl
                }
              );
              console.debug(`Created Shaka job: ${JSON.stringify(shakaJob)}`);
              // Close the task until we have implemented something to track the Shaka job status
              task.status = 'COMPLETED';
            }
          }
        }
      }
    }
  }, 5000);

  const handleCreateNotification = async (record: any): Promise<void> => {
    console.log(
      `File created: s3://${record.s3.bucket.name}/${record.s3.object.key}`
    );
    const filename =
      record.s3.object.key.split('/').pop() || record.s3.object.key;
    const externalId = createUniqueSlug(filename);
    await workOrderManager.createWorkOrder(
      externalId,
      new URL(`s3://${record.s3.bucket.name}/${record.s3.object.key}`)
    );
  };

  const handleEncoreSuccess = async (jobProgress: any): Promise<void> => {
    console.debug(`Encore job successful: ${JSON.stringify(jobProgress)}`);
    const ctx = new Context();
    const job = (await getTranscodeJob(ctx, 'mediasupply', jobProgress.jobId, {
      endpointUrl: new URL(opts.encoreUrl),
      bearerToken: await ctx.getServiceAccessToken('encore')
    })) as EncoreJob;
    if (!job.externalId) {
      throw new Error(`Encore job ${jobProgress.jobId} has no externalId`);
    }
    await workOrderManager.updateWorkOrderTask(
      job.externalId,
      'ABR_TRANSCODE',
      'COMPLETED',
      job
    );
  };

  setupListener(
    opts.inputBucket,
    new URL(opts.s3EndpointUrl),
    opts.s3AccessKeyId,
    opts.s3SecretAccessKey,
    handleCreateNotification
  );
  opts.api.register(encoreCallbackApi, {
    onCallback: (jobProgress) => {
      console.debug(
        `Received callback from Encore for job ${JSON.stringify(jobProgress)}`
      );
    },
    onSuccess: handleEncoreSuccess
  });
};
