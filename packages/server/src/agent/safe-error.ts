/** Defense in depth for Agent errors and persisted failure messages. */
export const redactAgentMessage = (message: string): string =>
  message
    .replace(/\bBearer\s+[^\s,;'"<>]+/gi, 'Bearer [REDACTED]')
    .replace(
      /\b(api[_-]?key|token|secret|password|authorization)\s*[:=]\s*[^\s,;]+/gi,
      '$1=[REDACTED]',
    )
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[REDACTED]')
    .replace(
      /(?:file:\/\/)?\/(?:Users|home|private|tmp|var|workspace|Volumes|Applications)\/[^\s'"<>]+/g,
      '[REDACTED_PATH]',
    )
    .replace(/\b[A-Za-z]:[\\/][^\s'"<>]+/g, '[REDACTED_PATH]')
    .slice(0, 2_000);
