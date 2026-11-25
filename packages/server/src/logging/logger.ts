import pino from 'pino';
import type { DestinationStream } from 'pino';

const eventFields: Readonly<Record<string, readonly string[]>> = {
  'http.request.completed': ['requestId', 'route', 'statusCode', 'errorCode', 'durationMs'],
  'web.proxy.request.failed': ['requestId', 'statusCode', 'reason'],
  'agent.sse.closed': ['requestId', 'runId', 'outcome', 'durationMs'],
  'agent.run.accepted': ['requestId', 'runId', 'projectId', 'pageId', 'baseWorkingVersion'],
  'agent.run.reused': ['requestId', 'runId', 'projectId', 'pageId', 'baseWorkingVersion'],
  'agent.run.finished': ['runId', 'status', 'failureStage', 'errorCode', 'durationMs'],
  'agent.run.recovered': [
    'runId',
    'status',
    'recoveredCommit',
    'resultWorkingVersion',
    'errorCode',
  ],
  'agent.model_usage': [
    'runId',
    'requestIndex',
    'estimatedInputTokens',
    'inputBytes',
    'systemBytes',
    'toolDefinitionBytes',
    'userBytes',
    'assistantBytes',
    'toolResultBytes',
    'inputTokens',
    'outputTokens',
    'cacheReadTokens',
    'cacheWriteTokens',
    'inputUsageEstimated',
    'outputUsageEstimated',
    'durationMs',
    'toolCalls',
    'repeatedToolCalls',
  ],
  'working.commit.completed': [
    'source',
    'requestId',
    'runId',
    'pageId',
    'baseWorkingVersion',
    'resultWorkingVersion',
    'result',
    'errorCode',
  ],
  'server.started': [],
  'server.start.failed': ['stage'],
  'server.shutdown.failed': [],
  'server.ownership.lost': [],
};

let stdoutErrorsHandled = false;

export const createLogger = (
  host: 'desktop' | 'web',
  serviceInstanceId: string,
  destination?: DestinationStream,
) => {
  const base = { host, serviceInstanceId };
  let dropped = 0;
  if (!destination && !stdoutErrorsHandled) {
    // A closed log collector must not stop the Server.
    process.stdout.on('error', () => undefined);
    stdoutErrorsHandled = true;
  }
  return pino(
    {
      base,
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
      hooks: {
        logMethod(args, method) {
          const record = args[0];
          // Fastify can pass raw request and error objects to this same logger.
          if (!record || typeof record !== 'object') return;
          const input = record as Record<string, unknown>;
          const event = input.event;
          if (typeof event !== 'string' || !Object.hasOwn(eventFields, event)) return;
          const safe: Record<string, unknown> = { event };
          for (const field of eventFields[event]) {
            const value = input[field];
            if (
              (typeof value === 'string' &&
                value.length <= 256 &&
                (event !== 'agent.model_usage' || field === 'runId')) ||
              (typeof value === 'number' && Number.isFinite(value)) ||
              typeof value === 'boolean'
            )
              safe[field] = value;
          }
          try {
            method.call(this, safe);
          } catch {
            // A diagnostic sink failure cannot change a business result.
          }
        },
      },
    },
    {
      write(line) {
        if (destination) {
          destination.write(line);
          return;
        }
        if (process.stdout.writableNeedDrain) {
          dropped += 1;
          return;
        }
        const count = dropped;
        dropped = 0;
        const notice = count
          ? JSON.stringify({
              ...base,
              event: 'logging.records.dropped',
              level: 40,
              time: new Date().toISOString(),
              count,
            }) + '\n'
          : '';
        process.stdout.write(notice + line, (error) => {
          if (error) dropped += count + 1;
        });
      },
    },
  );
};

export type DiagnosticLogger = ReturnType<typeof createLogger>;
