import { Input } from './shaka';

export interface EncoreJob {
  externalId?: string;
  id: string;
  status: string;
  output?: Output[];
  inputs: EncoreInput[];
}

export interface Output {
  type: string;
  format: string;
  file: string;
  fileSize: number;
  overallBitrate: number;
  videoStreams?: { codec: string; bitrate: number }[];
  audioStreams?: { codec: string; bitrate: number; channels: number }[];
}

export interface EncoreInput {
  uri: string;
}

export interface StreamKeyTemplates {
  video: string;
  audio: string;
}

export const DEFAULT_STREAM_KEY_TEMPLATES: StreamKeyTemplates = {
  video: '$VIDEOIDX$_$BITRATE$',
  audio: '$AUDIOIDX$'
};

export function parseInputsFromEncoreJob(
  job: EncoreJob,
  streamKeysConfig: StreamKeyTemplates
) {
  const inputs: Input[] = [];

  if (job.status !== 'SUCCESSFUL') {
    throw new Error('Encore job is not successful');
  }
  if (!job.output) {
    throw new Error('Encore job has no output');
  }
  const video = job.output
    .filter((output) => output.type === 'VideoFile')
    .map((output) => ({ output, videoStream: output.videoStreams?.[0] }));
  const audio = job.output
    .filter((output) => output.type === 'AudioFile')
    .map((output) => ({ output, audioStream: output.audioStreams?.[0] }))
    .filter((v) => v.audioStream?.channels === 2);

  if (audio.length === 0) {
    const moreAudio = job.output
      .filter((output) => output.type === 'VideoFile')
      .filter(hasStereoAudioStream)
      .map((output) => ({
        output,
        audioStream: output.audioStreams?.filter((a) => a.channels === 2)[0]
      }));
    if (moreAudio.length > 0) {
      audio.push(moreAudio[0]);
    }
  }
  let videoIdx = 0;
  video.forEach((v) => {
    const bitrateKb = v.videoStream?.bitrate
      ? Math.round(v.videoStream?.bitrate / 1000)
      : 0;
    const key = keyFromTemplate(streamKeysConfig.video, {
      videoIdx,
      audioIdx: 0,
      totalIdx: videoIdx,
      bitrate: bitrateKb
    });
    inputs.push({ type: 'video', key, filename: v.output.file });
    videoIdx++;
  });
  let audioIdx = 0;
  audio.forEach((audio) => {
    const bitrateKb = audio.audioStream?.bitrate
      ? Math.round(audio.audioStream?.bitrate / 1000)
      : 0;
    const key = keyFromTemplate(streamKeysConfig.audio, {
      videoIdx,
      audioIdx,
      totalIdx: videoIdx + audioIdx,
      bitrate: bitrateKb
    });
    inputs.push({ type: 'audio', key, filename: audio.output.file });
    audioIdx++;
  });
  return inputs;
}

function keyFromTemplate(
  template: string,
  values: {
    videoIdx: number;
    audioIdx: number;
    totalIdx: number;
    bitrate: number;
  }
) {
  return template
    .replaceAll('$VIDEOIDX$', `${values.videoIdx}`)
    .replaceAll('$AUDIOIDX$', `${values.audioIdx}`)
    .replaceAll('$TOTALIDX$', `${values.totalIdx}`)
    .replaceAll('$BITRATE$', `${values.bitrate}`);
}

function hasStereoAudioStream(output: Output) {
  if (!output.audioStreams || output.audioStreams.length === 0) {
    return false;
  }
  return output.audioStreams.filter((a) => a.channels === 2).length > 0;
}
