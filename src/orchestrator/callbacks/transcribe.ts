import { Static, Type } from '@sinclair/typebox';
import { FastifyPluginCallback } from 'fastify';

export const TranscribeProgress = Type.Object({
  event: Type.String(),
  jobId: Type.String(),
  externalId: Type.Optional(Type.String())
});

export type TranscribeProgress = Static<typeof TranscribeProgress>;
export interface TranscribeCallbackOptions {
  onCallback?: (job: TranscribeProgress) => void;
  onSuccess?: (job: TranscribeProgress) => void;
}

export const transcribeCallbackApi: FastifyPluginCallback<
  TranscribeCallbackOptions
> = (fastify, opts, next) => {
  fastify.post<{ Body: TranscribeProgress }>(
    '/transcribeCallback',
    {
      schema: {
        description: 'Callback endpoint for auto transcription',
        response: {
          200: Type.Null()
        }
      }
    },
    async (req, reply) => {
      opts.onCallback?.(req.body);
      if (req.body.event.toUpperCase() === 'SUBTITLING_COMPLETED') {
        opts.onSuccess?.(req.body);
      }
      reply.send();
    }
  );
  next();
};
