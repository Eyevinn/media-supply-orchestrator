import { Static, Type } from '@sinclair/typebox';
import { FastifyPluginCallback } from 'fastify';

export const JobProgress = Type.Object({
  jobId: Type.String(),
  externalId: Type.Optional(Type.String()),
  progress: Type.Number(),
  status: Type.String()
});

export type JobProgress = Static<typeof JobProgress>;
export interface EncoreCallbackOptions {
  onCallback?: (job: JobProgress) => void;
  onSuccess?: (job: JobProgress) => void;
}

export const encoreCallbackApi: FastifyPluginCallback<EncoreCallbackOptions> = (
  fastify,
  opts,
  next
) => {
  fastify.post<{ Body: JobProgress }>(
    '/encoreCallback',
    {
      schema: {
        description: 'Callback endpoint for encore',
        response: {
          200: Type.Null()
        }
      }
    },
    async (req, reply) => {
      opts.onCallback?.(req.body);
      if (req.body.status.toUpperCase() === 'SUCCESSFUL') {
        opts.onSuccess?.(req.body);
      }
      reply.send();
    }
  );
  next();
};
