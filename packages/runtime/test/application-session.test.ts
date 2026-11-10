import { expect, it, vi } from 'vitest';
import { createApplicationSession } from '../src/application-session';
// An invalid runtime action must not partially mutate shared state or navigate outside the application.
it('applies state atomically and confines navigation to declared pages', () => {
  const navigateToPage = vi.fn();
  const session = createApplicationSession(
    {
      initialState: { signedIn: false, user: null },
      access: {
        enabled: true,
        stateKey: 'signedIn',
        loginPageId: 'login',
        homePageId: 'home',
        publicPageIds: [],
      },
    },
    {
      pages: [
        { pageId: 'login', name: '登录' },
        { pageId: 'home', name: '首页' },
      ],
      stateKeys: ['signedIn', 'user'],
    },
    { navigateToPage, returnPageId: 'https://outside.example' },
  );
  expect(() =>
    session.update([
      { name: 'user', value: { name: 'demo' } },
      { name: 'unknown', value: true },
    ]),
  ).toThrow('未声明');
  expect(session.read('user')).toBeNull();
  expect(() => session.update([{ name: 'signedIn', value: 'true' }])).toThrow('布尔值');
  session.update([
    { name: 'signedIn', value: true },
    { name: 'user', value: { name: 'demo' } },
  ]);
  session.navigate('return');
  expect(navigateToPage).toHaveBeenCalledWith('home');
  expect(() => session.navigate('page', 'outside')).toThrow('不属于');
  session.reset();
  expect(session.read('signedIn')).toBe(false);
});
