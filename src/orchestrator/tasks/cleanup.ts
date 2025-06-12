import { Context } from '@osaas/client-core';
import { WorkOrder, WorkOrderManager, WorkOrderTask } from '../workorder';
import { OrchestratorOptions } from '../../orchestrator';
import { removeDir, removeFile } from '../../storage/minio';

export async function startCleanupTask(
  ctx: Context,
  task: WorkOrderTask,
  workOrder: WorkOrder,
  workOrderManager: WorkOrderManager,
  opts: OrchestratorOptions
) {
  // Remove source file
  await removeFile(
    opts.inputBucket,
    workOrder.source.pathname,
    new URL(opts.s3EndpointUrl),
    opts.s3AccessKeyId,
    opts.s3SecretAccessKey
  );
  console.log(
    `[${workOrder.id}]: Removed source file: ${workOrder.source.toString()}`
  );

  // Remove ABR transcoded files and subtitles
  await removeDir(
    opts.abrsubsBucket,
    `${workOrder.id}/`,
    new URL(opts.s3EndpointUrl),
    opts.s3AccessKeyId,
    opts.s3SecretAccessKey
  );
  console.log(
    `[${workOrder.id}]: Removed ABR transcoded files and subtitles for work order`
  );
  await workOrderManager.updateWorkOrderTask(
    workOrder.id,
    task.type,
    'COMPLETED'
  );
}
