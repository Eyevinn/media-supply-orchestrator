import { Context, createJob, getJob } from '@osaas/client-core';
import {
  DEFAULT_STREAM_KEY_TEMPLATES,
  EncoreJob,
  parseInputsFromEncoreJob
} from '../encore';
import { WorkOrder, WorkOrderManager, WorkOrderTask } from '../workorder';
import { OrchestratorOptions } from '../../orchestrator';
import { ShakaJob } from '../shaka';

export async function startVodPackageTask(
  ctx: Context,
  task: WorkOrderTask,
  workOrder: WorkOrder,
  workOrderManager: WorkOrderManager,
  opts: OrchestratorOptions
) {
  const workOrderTask = workOrder.tasks.find(
    (task) => task.type === 'ABR_TRANSCODE'
  );
  const job = (workOrderTask?.taskPayload as EncoreJob) || null;
  if (!job) {
    console.error(`No ABR_TRANSCODE job found for work order ${workOrder.id}`);
    return;
  }
  const inputs = parseInputsFromEncoreJob(
    job as EncoreJob,
    DEFAULT_STREAM_KEY_TEMPLATES
  );
  // add inputs for subtitles if they exist
  if (workOrder.tasks.find((task) => task.type === 'TRANSCRIBE')) {
    inputs.push({
      type: 'text',
      key: 'en',
      filename: `s3://${opts.abrsubsBucket}/${job.externalId}/${job.externalId}_en.vtt`
    });
  }
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
        const basename = new URL(input.filename).pathname.split('/').pop();
        if (!basename) {
          throw new Error(`Could not extract basename from ${input.filename}`);
        }
        return `-i ${TYPE_MAP[input.type]}:${input.key}=${basename}`;
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
  await workOrderManager.updateWorkOrderTask(
    workOrder.id,
    task.type,
    'IN_PROGRESS',
    shakaJob as ShakaJob
  );
}

export async function updateVodPackageTask(
  ctx: Context,
  task: WorkOrderTask,
  workOrder: WorkOrder,
  workOrderManager: WorkOrderManager,
  opts: OrchestratorOptions
) {
  const shakaTaskPayload = task.taskPayload as ShakaJob;
  if (!shakaTaskPayload) {
    console.error(
      `[${workOrder.id}]: No Shaka task payload found for task ${task.type}`
    );
    await workOrderManager.updateWorkOrderTask(
      workOrder.id,
      task.type,
      'FAILED'
    );
    return;
  }
  const shakaServiceAccessToken = await ctx.getServiceAccessToken(
    'eyevinn-shaka-packager-s3'
  );
  const shakaJob = await getJob(
    ctx,
    'eyevinn-shaka-packager-s3',
    shakaTaskPayload.name,
    shakaServiceAccessToken
  );
  if (
    shakaJob.status === 'Complete' ||
    shakaJob.status === 'SuccessCriteriaMet'
  ) {
    task.status = 'COMPLETED';
  } else if (shakaJob.status === 'Failed') {
    task.status = 'FAILED';
    console.error(
      `[${workOrder.id}]: Shaka job ${shakaTaskPayload.name} failed: ${shakaJob.error}`
    );
  }
  await workOrderManager.updateWorkOrderTask(
    workOrder.id,
    task.type,
    task.status
  );
}
