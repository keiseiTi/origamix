import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { nanoid } from 'nanoid';
import type { ApiResult } from '@origamix/shared/protocol/api';
import { ApiError } from '../errors';
import { registerAgentRoutes } from './agent-routes';
import { registerApplyRoutes } from './apply-routes';
import { registerProjectRoutes } from './project-routes';
import { registerRuntimeRoutes } from './runtime-routes';
import { registerSchemaRoutes } from './schema-routes';
import type { HttpServerInput, RouteAdapter, RouteInput } from './types';

const requestId = (value: unknown): string => {
  return typeof value === 'string' && value.length <= 100 ? value : nanoid();
};

const errorStatus = (error: unknown): number => {
  if (error instanceof ApiError) return error.statusCode;
  const statusCode =
    typeof error === 'object' && error !== null && 'statusCode' in error
      ? error.statusCode
      : undefined;
  return typeof statusCode === 'number' && statusCode >= 400 ? statusCode : 500;
};

const failure = (error: unknown, fallbackStatus = 500): ApiResult<never> => {
  const statusCode = error instanceof ApiError ? error.statusCode : fallbackStatus;
  return {
    success: false,
    code: error instanceof ApiError ? error.code : statusCode,
    data: null,
    message:
      error instanceof ApiError
        ? error.message
        : statusCode < 500 && error instanceof Error
          ? error.message
          : '服务器内部错误',
  };
};

const installRequestBoundary = (server: FastifyInstance, input: HttpServerInput): void => {
  const allowedOrigins = new Set(
    input.allowedOrigins ?? ['null', 'http://localhost:5173', 'http://127.0.0.1:5173'],
  );
  server.addHook('onRequest', async (request, reply) => {
    const id = requestId(request.headers['x-request-id']);
    request.headers['x-request-id'] = id;
    reply.header('X-Request-Id', id);
    const origin = request.headers.origin;
    if (origin && !allowedOrigins.has(origin))
      return reply.code(403).send({
        success: false,
        code: 403,
        data: null,
        message: '请求来源不受信任',
      });
    if (origin) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Vary', 'Origin');
      reply.header(
        'Access-Control-Allow-Headers',
        'Authorization, Content-Type, Last-Event-ID, X-Origamix-Service, X-Request-Id',
      );
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    }
    if (request.method === 'OPTIONS') return reply.code(204).send();
    if (
      request.headers.authorization !== `Bearer ${input.desktopToken}` ||
      request.headers['x-origamix-service'] !== input.serviceInstanceId
    )
      return reply.code(401).send({
        success: false,
        code: 401,
        data: null,
        message: '桌面会话无效',
      });
  });
  server.setErrorHandler((error, _request, reply) => {
    const statusCode = errorStatus(error);
    return reply.code(statusCode).send(failure(error, statusCode));
  });
};

const route: RouteAdapter =
  <T>(handler: (request: RouteInput<T>) => Promise<unknown> | unknown, successStatus = 200) =>
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    reply.code(successStatus).send({
      success: true,
      code: 200,
      data: await handler({
        body: request.body as T,
        params: request.params as Record<string, string>,
        headers: request.headers as Record<string, unknown>,
        query: request.query as Record<string, unknown>,
      }),
    });
  };

export const createHttpServer = (input: HttpServerInput): FastifyInstance => {
  const server = Fastify({
    bodyLimit: 512 * 1024,
    logger: false,
    ajv: { customOptions: { removeAdditional: false } },
  });
  installRequestBoundary(server, input);
  server.get('/api/v1/health', async () => ({
    success: true,
    code: 200,
    data: { serviceInstanceId: input.serviceInstanceId },
  }));
  const context = { server, input, route };
  registerProjectRoutes(context);
  registerSchemaRoutes(context);
  registerApplyRoutes(context);
  registerRuntimeRoutes(context);
  registerAgentRoutes(context);
  return server;
};
