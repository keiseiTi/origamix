import type { AgentEvent } from '@origamix/shared/protocol/agent';

type EventInput = Omit<AgentEvent, 'version' | 'eventId' | 'sequence' | 'occurredAt'> & {
  occurredAt?: string;
};

export interface AgentEventSubscription {
  replay: readonly AgentEvent[];
  close(): void;
}

interface RunChannel {
  nextEventId: number;
  events: AgentEvent[];
  subscribers: Set<(event: AgentEvent) => void>;
  terminal: boolean;
}

const terminalTypes = new Set(['run.completed', 'run.failed', 'run.cancelled', 'run.interrupted']);

/** Process-local event fan-out. Durable Run/messages remain the reconnect authority. */
export class AgentEventBroker {
  private readonly channels = new Map<string, RunChannel>();

  constructor(private readonly replayLimit = 200) {}

  publish(input: EventInput): AgentEvent {
    const channel = this.channel(input.runId);
    const event: AgentEvent = {
      version: '1',
      eventId: channel.nextEventId,
      sequence: channel.nextEventId,
      type: input.type,
      runId: input.runId,
      pageId: input.pageId,
      requestId: input.requestId,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      ...(input.revisionId ? { revisionId: input.revisionId } : {}),
      payload: input.payload,
    };
    channel.nextEventId += 1;
    channel.events.push(event);
    if (channel.events.length > this.replayLimit) channel.events.shift();
    for (const subscriber of channel.subscribers) subscriber(event);
    if (terminalTypes.has(event.type)) channel.terminal = true;
    return event;
  }

  subscribe(
    runId: string,
    afterEventId: number,
    onEvent: (event: AgentEvent) => void,
  ): AgentEventSubscription {
    const channel = this.channel(runId);
    const replay = channel.events.filter((event) => event.eventId > afterEventId);
    if (!channel.terminal) channel.subscribers.add(onEvent);
    return {
      replay,
      close: () => channel.subscribers.delete(onEvent),
    };
  }

  isTerminal(runId: string): boolean {
    return this.channels.get(runId)?.terminal ?? false;
  }

  private channel(runId: string): RunChannel {
    let channel = this.channels.get(runId);
    if (!channel) {
      channel = { nextEventId: 0, events: [], subscribers: new Set(), terminal: false };
      this.channels.set(runId, channel);
    }
    return channel;
  }
}
