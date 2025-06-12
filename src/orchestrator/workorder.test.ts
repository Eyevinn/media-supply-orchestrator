import { EncoreJob } from './encore';
import { ShakaJob } from './shaka';
import {
  deserializeWorkOrder,
  serializeWorkOrder,
  WorkOrder
} from './workorder';

describe('Workorder', () => {
  it('can be serialized and deserialized', () => {
    const encoreJob: EncoreJob = {
      id: 'encore-job-123',
      status: 'COMPLETED',
      externalId: 'ext-456',
      inputs: [
        {
          uri: 's3://bucket/input.mp4'
        }
      ],
      output: [
        {
          type: 'video',
          format: 'mp4',
          file: 's3://bucket/output.mp4',
          fileSize: 1024000,
          overallBitrate: 2000000,
          videoStreams: [{ codec: 'h264', bitrate: 1500000 }],
          audioStreams: [{ codec: 'aac', bitrate: 128000, channels: 2 }]
        }
      ]
    };
    const workOrder: WorkOrder = {
      id: 'test-workorder',
      source: new URL('s3://bucket/source.mp4'),
      status: 'OPEN',
      tasks: [
        {
          dependsOn: [],
          type: 'ABR_TRANSCODE',
          status: 'COMPLETED',
          taskPayload: encoreJob
        },
        {
          dependsOn: ['ABR_TRANSCODE'],
          type: 'VOD_PACKAGE',
          status: 'PENDING',
          taskPayload: {
            name: 'hoppsan'
          } as ShakaJob
        },
        {
          dependsOn: [],
          type: 'TRANSCRIBE',
          status: 'PENDING'
        },
        {
          dependsOn: ['VOD_PACKAGE'],
          type: 'CLEANUP',
          status: 'PENDING'
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    expect(deserializeWorkOrder(serializeWorkOrder(workOrder))).toEqual(
      workOrder
    );
  });
});
