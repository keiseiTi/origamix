// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceTransitions } from '../../src/hooks/use-workspace-transitions';

afterEach(cleanup);

describe('workspace transitions', () => {
  it('blocks navigation on save failure and permits an explicit retry', async () => {
    const flush = vi
      .fn()
      .mockRejectedValueOnce(new Error('save failed'))
      .mockResolvedValue(undefined);
    const navigate = vi.fn();
    const hook = renderHook(() => useWorkspaceTransitions(flush));
    await act(async () => hook.result.current.transition(navigate));
    expect(navigate).not.toHaveBeenCalled();
    expect(hook.result.current.transitionError).toBe('save failed');
    await act(async () => hook.result.current.transition(navigate));
    expect(navigate).toHaveBeenCalledOnce();
    expect(hook.result.current.transitionError).toBeNull();
  });
});
