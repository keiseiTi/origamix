import { describe, expect, it, vi } from 'vitest';
import { AgentEventBroker } from './agent-event-broker';

const input = (type: string) => ({
  type,
  runId: 'run_test',
  pageId: 'page_test',
  requestId: 'request-test',
  payload: {},
});

describe('AgentEventBroker', () => {
  it('orders events, replays after the cursor and stops live delivery after close', () => {
    const broker = new AgentEventBroker(2);
    broker.publish(input('run.queued'));
    broker.publish(input('assistant.delta'));
    broker.publish(input('run.stage'));
    const listener = vi.fn();
    const subscription = broker.subscribe('run_test', 0, listener);
    expect(subscription.replay.map(({ eventId }) => eventId)).toEqual([1, 2]);
    broker.publish(input('assistant.delta'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0]).toMatchObject({ eventId: 3, sequence: 3, version: '1' });
    subscription.close();
    broker.publish(input('run.completed'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(broker.resourceSnapshot()).toMatchObject({ subscribers: 0, retainedEvents: 2 });
  });

  it('does not register new live subscribers after a terminal event', () => {
    const broker = new AgentEventBroker();
    broker.publish(input('run.cancelled'));
    const listener = vi.fn();
    expect(broker.subscribe('run_test', -1, listener).replay).toHaveLength(1);
    broker.publish(input('assistant.delta'));
    expect(listener).not.toHaveBeenCalled();
  });

  it('bounds terminal channel retention while preserving active subscriptions', () => {
    const broker = new AgentEventBroker(2, 2);
    broker.publish({ ...input('run.completed'), runId: 'run_old' });
    const active = broker.subscribe('run_active', -1, () => undefined);
    broker.publish({ ...input('run.completed'), runId: 'run_new' });
    expect(broker.resourceSnapshot()).toMatchObject({ channels: 2, subscribers: 1 });
    active.close();
  });
});
