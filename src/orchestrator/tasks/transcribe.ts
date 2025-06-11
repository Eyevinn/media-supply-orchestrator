import { Context } from '@osaas/client-core';
import { WorkOrder, WorkOrderTask } from '../workorder';
import { OrchestratorOptions } from '../../orchestrator';

export async function startTranscribeTask(
  ctx: Context,
  task: WorkOrderTask,
  workOrder: WorkOrder,
  opts: OrchestratorOptions
) {
  const autoSubtitleAccessToken = await ctx.getServiceAccessToken(
    'eyevinn-auto-subtitles'
  );
  const response = await fetch(
    new URL('/transcribe/s3', opts.subtitleGeneratorUrl),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${autoSubtitleAccessToken}`
      },
      body: JSON.stringify({
        url: workOrder.source.toString(),
        callbackUrl: new URL(
          '/transcribeCallback',
          opts.publicBaseUrl
        ).toString(),
        language: 'en',
        format: 'vtt',
        externalId: workOrder.id,
        bucket: opts.abrsubsBucket,
        key: `${workOrder.id}/${workOrder.id}_en`
      })
    }
  );
  if (!response.ok) {
    console.error(
      `Failed to start transcription for work order ${workOrder.id}: ${response.statusText}`
    );
    task.status = 'FAILED';
    return;
  }
  const data = await response.json();
  console.log(`[${workOrder.id}]: Transcription started for work order:`, data);
  task.status = 'IN_PROGRESS';
}
