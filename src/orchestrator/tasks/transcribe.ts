import { Context } from '@osaas/client-core';
import { WorkOrder, WorkOrderTask } from '../workorder';
import { OrchestratorOptions } from '../../orchestrator';
import { fileExists, readTextFile } from '../../storage/minio';

export async function startTranscribeTask(
  ctx: Context,
  task: WorkOrderTask,
  workOrder: WorkOrder,
  opts: OrchestratorOptions
) {
  const sourceWithoutExtension = workOrder.source
    .toString()
    .replace(/\.[^/.]+$/, '');
  let prompt = undefined;
  if (
    await fileExists(
      `${sourceWithoutExtension}.txt`,
      new URL(opts.s3EndpointUrl),
      opts.s3AccessKeyId,
      opts.s3SecretAccessKey
    )
  ) {
    prompt = await readTextFile(
      `${sourceWithoutExtension}.txt`,
      new URL(opts.s3EndpointUrl),
      opts.s3AccessKeyId,
      opts.s3SecretAccessKey
    );
    console.log(
      `[${workOrder.id}]: Using prompt from ${sourceWithoutExtension}.txt`
    );
  }
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
        prompt: prompt,
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
