import {
  ProjectSettingsAgentRequestSchema,
  type ProjectSettingsAgentRequest,
  type ProjectSettingsAgentEvent,
} from '@origamix/shared';
import type { RouteRegistrationContext } from './types';
import { ApiError } from '../errors';

export const registerProjectSettingsAgentRoutes = ({
  server,
  input,
}: RouteRegistrationContext): void => {
  const service = input.settingsAgent;
  if (!service) return;
  server.post(
    '/api/v1/projects/settings/assist',
    { schema: { body: ProjectSettingsAgentRequestSchema } },
    async (request, reply) => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      reply.raw.on('close', abort);
      reply.hijack();
      for (const [name, value] of Object.entries(reply.getHeaders())) {
        if (value !== undefined) reply.raw.setHeader(name, value);
      }
      reply.raw.writeHead(200, {
        'content-type': 'application/x-ndjson; charset=utf-8',
        'cache-control': 'no-store',
        'x-accel-buffering': 'no',
      });
      const emit = (event: ProjectSettingsAgentEvent) => {
        if (!reply.raw.destroyed && !reply.raw.writableEnded)
          reply.raw.write(`${JSON.stringify(event)}\n`);
      };
      try {
        await service.run(request.body as ProjectSettingsAgentRequest, controller.signal, emit);
      } catch (error) {
        emit({
          type: 'failed',
          message: error instanceof ApiError ? error.message : '布局助手暂时不可用，请稍后重试',
        });
      } finally {
        reply.raw.off('close', abort);
        if (!reply.raw.writableEnded) reply.raw.end();
      }
    },
  );
};
