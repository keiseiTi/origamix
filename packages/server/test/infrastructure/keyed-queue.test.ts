import { deferred } from '../../testing/deferred';
import { expect, it } from 'vitest';
import { KeyedQueue } from '../../infrastructure/keyed-queue';

it('preserves same-key order and releases waiters after a rejected action', async () => {
  const queue = new KeyedQueue();
  const release = deferred();
  const entered = deferred();
  const order: number[] = [];
  const first = queue.run('page', async () => {
    entered.resolve();
    await release.promise;
    order.push(1);
    throw new Error('interrupted');
  });
  const rejected = expect(first).rejects.toThrow('interrupted');
  await entered.promise;
  const second = queue.run('page', async () => {
    order.push(2);
    return 'saved';
  });
  const third = queue.run('page', async () => {
    order.push(3);
  });
  expect(order).toEqual([]);
  release.resolve();
  await rejected;
  expect(await second).toBe('saved');
  await third;
  expect(order).toEqual([1, 2, 3]);
  expect(await queue.run('page', async () => 'reused')).toBe('reused');
});

it('lets other keys and independent queue scopes proceed', async () => {
  const queue = new KeyedQueue();
  const release = deferred();
  const pending = queue.run('same', () => release.promise);
  try {
    expect(await queue.run('other', async () => 1)).toBe(1);
    expect(await new KeyedQueue().run('same', async () => 2)).toBe(2);
  } finally {
    release.resolve();
    await pending;
  }
});
