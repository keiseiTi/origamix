import { describe, expect, it } from 'vitest';
import { derivePageCapabilities } from '../../../../src/components/workspace/state/use-page-session';

describe('derivePageCapabilities', () => {
  it('locks every page mutation while Agent authority is unknown', () => {
    expect(
      derivePageCapabilities({
        agentActivity: 'unknown',
        applyStatus: 'pending',
        saveStatus: 'saved',
      }),
    ).toEqual({
      canEdit: false,
      canUndo: false,
      canApply: false,
      canReload: false,
      canLeave: false,
      agentChecking: true,
    });
  });

  it('allows only operations supported by the settled page state', () => {
    expect(
      derivePageCapabilities({
        agentActivity: 'idle',
        applyStatus: 'pending',
        saveStatus: 'saved',
      }),
    ).toMatchObject({
      canEdit: true,
      canUndo: true,
      canApply: true,
      canReload: true,
      canLeave: true,
    });
    expect(
      derivePageCapabilities({
        agentActivity: 'idle',
        applyStatus: 'pending',
        saveStatus: 'dirty',
      }),
    ).toMatchObject({ canApply: false, canLeave: false });
  });
});
