import { AsyncLocalStorage } from 'node:async_hooks';
import { conflict } from '../errors';

interface Activity {
  readers: number;
  exclusive: boolean;
  drained?: () => void;
}
const activities = new Map<string, Activity>();
const owner = new AsyncLocalStorage<{ path: string; active: boolean }>();
const activityFor = (path: string): Activity => {
  let state = activities.get(path);
  if (!state) {
    state = { readers: 0, exclusive: false };
    activities.set(path, state);
  }
  return state;
};

/** Admission/Schema leases finish before destructive project lifecycle work starts. */
export const withProjectActivity = async <T>(
  path: string,
  action: () => Promise<T>,
): Promise<T> => {
  const current = owner.getStore();
  if (current?.path === path && current.active) return action();
  const state = activityFor(path);
  if (state.exclusive) throw conflict('项目正在更新，请稍后重试');
  state.readers += 1;
  try {
    return await action();
  } finally {
    state.readers -= 1;
    if (!state.readers) {
      state.drained?.();
      if (!state.exclusive) activities.delete(path);
    }
  }
};

/** Caller holds ProjectService's project queue. Nested project operations share ownership. */
export const withExclusiveProjectActivity = async <T>(
  path: string,
  action: () => Promise<T>,
): Promise<T> => {
  const state = activityFor(path);
  if (state.exclusive) throw conflict('项目生命周期操作正在执行');
  state.exclusive = true;
  const token = { path, active: true };
  try {
    if (state.readers)
      await new Promise<void>((resolve) => {
        state.drained = resolve;
      });
    return await owner.run(token, action);
  } finally {
    token.active = false;
    state.exclusive = false;
    state.drained = undefined;
    if (!state.readers) activities.delete(path);
  }
};
