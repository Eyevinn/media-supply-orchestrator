import { Context } from '@osaas/client-core';
import { setupListener } from './storage/minio';
import { createUniqueSlug } from './util';
import { getTranscodeJob } from '@osaas/client-transcode';
import { FastifyInstance } from 'fastify';
import { encoreCallbackApi } from './orchestrator/callbacks/encore';
import { EncoreJob } from './orchestrator/encore';
import { WorkOrderManager } from './orchestrator/workorder';
import { startAbrTranscodeTask } from './orchestrator/tasks/abr_transcode';
import {
  startVodPackageTask,
  updateVodPackageTask
} from './orchestrator/tasks/vod_package';
import { startTranscribeTask } from './orchestrator/tasks/transcribe';
import { transcribeCallbackApi } from './orchestrator/callbacks/transcribe';
import { startCleanupTask } from './orchestrator/tasks/cleanup';
import { Workflow } from './orchestrator/workflow';

export interface OrchestratorOptions {
  publicBaseUrl: string;
  inputBucket: string;
  abrsubsBucket: string;
  outputBucket: string;
  encoreUrl: string;
  subtitleGeneratorUrl: string;
  s3EndpointUrl: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  api: FastifyInstance;
  redisUrl?: string;
  workflowDefinitionUrl: URL;
}

export default (opts: OrchestratorOptions) => {
  const workOrderManager = new WorkOrderManager({
    redisUrl: opts.redisUrl ? new URL(opts.redisUrl) : undefined
  });
  const ctx = new Context();
  const workflow = new Workflow(opts.workflowDefinitionUrl);

  const timer = setInterval(async () => {
    const openWorkOrders = await workOrderManager.getOpenWorkOrders();
    for (const workOrder of openWorkOrders) {
      if (workOrder.tasks.every((task) => task.status === 'COMPLETED')) {
        console.log(`[${workOrder.id}]: All tasks done for work order`);
        await workOrderManager.updateWorkOrder(workOrder.id, 'CLOSED');
      } else {
        for (const task of workOrder.tasks) {
          try {
            if (
              task.status === 'PENDING' &&
              task.dependsOn.every(
                (t) =>
                  workOrder.tasks.find((wt) => wt.type === t)?.status ===
                  'COMPLETED'
              )
            ) {
              console.log(`[${workOrder.id}]: Starting task ${task.type}`);
              if (task.type === 'ABR_TRANSCODE') {
                await startAbrTranscodeTask(
                  ctx,
                  task,
                  workOrder,
                  workOrderManager,
                  opts
                );
              } else if (task.type === 'VOD_PACKAGE') {
                await startVodPackageTask(
                  ctx,
                  task,
                  workOrder,
                  workOrderManager,
                  opts
                );
              } else if (task.type === 'TRANSCRIBE') {
                await startTranscribeTask(
                  ctx,
                  task,
                  workOrder,
                  workOrderManager,
                  opts
                );
              } else if (task.type === 'CLEANUP') {
                await startCleanupTask(
                  ctx,
                  task,
                  workOrder,
                  workOrderManager,
                  opts
                );
              }
            } else if (task.status === 'IN_PROGRESS') {
              if (task.type === 'VOD_PACKAGE') {
                await updateVodPackageTask(
                  ctx,
                  task,
                  workOrder,
                  workOrderManager,
                  opts
                );
              }
            }
          } catch (error) {
            console.error(
              `[${workOrder.id}]: Error processing task ${task.type} for work order: `,
              error,
              workOrder
            );
          }
        }
      }
    }
  }, 5000);

  const handleCreateNotification = async (record: any): Promise<void> => {
    console.log(
      `File created: s3://${record.s3.bucket.name}/${record.s3.object.key}`
    );
    try {
      const filename =
        record.s3.object.key.split('/').pop() || record.s3.object.key;
      const externalId = createUniqueSlug(filename);
      const tasks = await workflow.getTasks();
      await workOrderManager.createWorkOrder(
        externalId,
        new URL(`s3://${record.s3.bucket.name}/${record.s3.object.key}`),
        tasks
      );
    } catch (error) {
      console.error(
        `Error creating work order for file s3://${record.s3.bucket.name}/${record.s3.object.key}: `,
        error
      );
    }
  };

  const handleEncoreSuccess = async (jobProgress: any): Promise<void> => {
    console.debug(`Encore job successful: ${JSON.stringify(jobProgress)}`);
    try {
      const ctx = new Context();
      const job = (await getTranscodeJob(
        ctx,
        'mediasupply',
        jobProgress.jobId,
        {
          endpointUrl: new URL(opts.encoreUrl),
          bearerToken: await ctx.getServiceAccessToken('encore')
        }
      )) as EncoreJob;
      if (!job.externalId) {
        throw new Error(`Encore job ${jobProgress.jobId} has no externalId`);
      }
      await workOrderManager.updateWorkOrderTask(
        job.externalId,
        'ABR_TRANSCODE',
        'COMPLETED',
        job
      );
    } catch (error) {
      console.error(
        `Error processing Encore job success for job ${jobProgress.jobId}: `,
        error
      );
    }
  };

  const handleTranscribeSuccess = async (jobProgress: any): Promise<void> => {
    console.debug(`Transcribe job successful: ${JSON.stringify(jobProgress)}`);
    try {
      await workOrderManager.updateWorkOrderTask(
        jobProgress.externalId,
        'TRANSCRIBE',
        'COMPLETED',
        jobProgress
      );
    } catch (error) {
      console.error(
        `Error processing Transcribe job success for job ${jobProgress.externalId}: `,
        error
      );
    }
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
  opts.api.register(transcribeCallbackApi, {
    onCallback: (jobProgress) => {
      console.debug(
        `Received callback from Transcribe for job ${JSON.stringify(
          jobProgress
        )}`
      );
    },
    onSuccess: handleTranscribeSuccess
  });
};
