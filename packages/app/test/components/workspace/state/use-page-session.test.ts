import { describe, expect, it } from 'vitest';
import { derivePageCapabilities } from '../../../../src/components/workspace/state/use-page-session';

describe('derivePageCapabilities', () => {
  it('locks every page mutation while Agent authority is unknown', () => {
    expect(
      derivePageCapabilities({
        agentActivity: 'unknown',
        applyStatus: 'saved_pending_apply',
        saveStatus: 'saved',
      }),
    ).toEqual({
      canEdit: false,
      canUndo: false,
      canApply: false,
      canSaveVersion: false,
      canReload: false,
      canLeave: false,
      agentChecking: true,
    });
  });

  it('allows only operations supported by the settled page state', () => {
    expect(
      derivePageCapabilities({
        agentActivity: 'idle',
        applyStatus: 'saved_pending_apply',
        saveStatus: 'saved',
      }),
    ).toMatchObject({
      canEdit: true,
      canUndo: true,
      canApply: true,
      canSaveVersion: false,
      canReload: true,
      canLeave: true,
    });
    expect(
      derivePageCapabilities({
        agentActivity: 'idle',
        applyStatus: 'saved_pending_apply',
        saveStatus: 'dirty',
      }),
    ).toMatchObject({ canApply: false, canLeave: false });
    expect(
      derivePageCapabilities({
        agentActivity: 'idle',
        applyStatus: 'draft_unsaved',
        saveStatus: 'saved',
      }),
    ).toMatchObject({
      canApply: false,
      canSaveVersion: true,
      canUndo: false,
      canLeave: true,
    });
  });
});
