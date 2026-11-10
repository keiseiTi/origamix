// @vitest-environment happy-dom
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { ApplicationProvider, ApplicationAccess, useApplication } from '../src/application';
import type { ApplicationSession } from '../src/application-session';
// Server cannot prove that a blocked page's business effects stay unmounted.
it('keeps private effects unmounted until the declared access state permits rendering', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host),
    effect = vi.fn(),
    navigateToPage = vi.fn();
  let session: ApplicationSession | null = null;
  const Capture = () => {
    session = useApplication();
    return null;
  };
  const Private = () => {
    useEffect(effect, []);
    return <p>private</p>;
  };
  try {
    await act(async () =>
      root.render(
        <ApplicationProvider
          definition={{
            initialState: { signedIn: false },
            access: {
              enabled: true,
              stateKey: 'signedIn',
              loginPageId: 'login',
              homePageId: 'private',
              publicPageIds: [],
            },
          }}
          metadata={{
            pages: [
              { pageId: 'login', name: '登录' },
              { pageId: 'private', name: '私有' },
            ],
            stateKeys: ['signedIn'],
          }}
          navigation={{ navigateToPage }}
        >
          <Capture />
          <ApplicationAccess currentPageId='private' renderPending={() => <p>blocked</p>}>
            <Private />
          </ApplicationAccess>
        </ApplicationProvider>,
      ),
    );
    expect(effect).not.toHaveBeenCalled();
    expect(host.textContent).toBe('blocked');
    expect(navigateToPage).toHaveBeenCalledWith('login', 'private');
    await act(async () => session!.update([{ name: 'signedIn', value: true }]));
    expect(effect).toHaveBeenCalledOnce();
    expect(host.textContent).toBe('private');
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
