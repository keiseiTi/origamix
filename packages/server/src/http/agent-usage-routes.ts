import { Type, type Static } from '@sinclair/typebox';
import { PageScopeSchema } from './body-schemas';
import type { RouteRegistrationContext } from './types';

const TimeZoneSchema = Type.String({ minLength: 1, maxLength: 100 });
const PageUsageBody = Type.Object(
  { ...PageScopeSchema.properties, timeZone: TimeZoneSchema },
  { additionalProperties: false },
);
const DailyUsageBody = Type.Object(
  {
    timeZone: TimeZoneSchema,
    days: Type.Union([Type.Literal(1), Type.Literal(7), Type.Literal(30)]),
    scope: Type.Optional(PageScopeSchema),
    detailDate: Type.Optional(Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' })),
  },
  { additionalProperties: false },
);

export const registerAgentUsageRoutes = ({
  server,
  input,
  route,
}: RouteRegistrationContext): void => {
  const usage = input.agentUsage;
  if (!usage) return;
  server.post(
    '/api/v1/agent/usage/page',
    { schema: { body: PageUsageBody } },
    route<Static<typeof PageUsageBody>>(({ body: { projectId, pageId, timeZone } }) =>
      usage.page({ projectId, pageId }, timeZone),
    ),
  );
  server.post(
    '/api/v1/agent/usage/daily',
    { schema: { body: DailyUsageBody } },
    route<Static<typeof DailyUsageBody>>(({ body }) => usage.daily(body)),
  );
};
