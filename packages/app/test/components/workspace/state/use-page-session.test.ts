import { describe, expect, it } from 'vitest';
import { derivePageCapabilities } from '../../../../src/components/workspace/state/use-page-session';

describe('derivePageCapabilities', () => {
  it('locks every page mutation while Agent authority is unknown', () => {
    expect(
      derivePageCapabilities({
        agentActivity: 'unknown',
        applyStatus: 'saved_pending_apply',
      }),
    ).toEqual({
      canEdit: false,
      canApply: false,
      canSaveVersion: false,
      canReload: false,
      agentChecking: true,
    });
  });

  it('allows only operations supported by the settled page state', () => {
    expect(
      derivePageCapabilities({
        agentActivity: 'idle',
        applyStatus: 'saved_pending_apply',
      }),
    ).toMatchObject({
      canEdit: true,
      canApply: true,
      canSaveVersion: false,
      canReload: true,
    });
    expect(
      derivePageCapabilities({
        agentActivity: 'idle',
        applyStatus: 'draft_unsaved',
      }),
    ).toMatchObject({
      canApply: false,
      canSaveVersion: true,
    });
  });
});
