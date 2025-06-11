import { Context } from '@osaas/client-core';
import { WorkOrder, WorkOrderTask } from '../workorder';
import { OrchestratorOptions } from '../../orchestrator';
import { transcode } from '@osaas/client-transcode';

export async function startAbrTranscodeTask(
  ctx: Context,
  task: WorkOrderTask,
  workOrder: WorkOrder,
  opts: OrchestratorOptions
) {
  const encoreServiceAccessToken = await ctx.getServiceAccessToken('encore');
  const job = await transcode(
    ctx,
    {
      encoreInstanceName: 'mediasupply',
      profile: 'program',
      callBackUrl: new URL('/encoreCallback', opts.publicBaseUrl),
      externalId: workOrder.id,
      inputUrl: workOrder.source,
      outputUrl: new URL(`s3://${opts.abrsubsBucket}/${workOrder.id}/`)
    },
    {
      endpointUrl: new URL(opts.encoreUrl),
      bearerToken: encoreServiceAccessToken
    }
  );
  task.status = 'IN_PROGRESS';
}
