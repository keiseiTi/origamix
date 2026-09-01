import { describe, expect, it } from 'vitest';
import { parseSession, restoreSidebar } from './view-session';

describe('window view session', () => {
  it.each([null, '{broken', 'null', '42'])(
    'defaults safely for missing or invalid storage: %s',
    (raw) => {
      expect(parseSession(raw)).toMatchObject({ activeTab: 'chat', isSettingsOpen: false });
    },
  );
  it('does not treat truthy strings as persisted booleans', () => {
    expect(
      parseSession('{"activeTab":"unknown","isSettingsOpen":"true","sidebarCollapsed":"false"}'),
    ).toEqual({ activeTab: 'chat', isSettingsOpen: false, sidebarCollapsed: undefined });
  });
  it('restores editor navigation and sidebar state across reload', () => {
    expect(
      parseSession('{"activeTab":"edit","isSettingsOpen":true,"sidebarCollapsed":true}'),
    ).toEqual({ activeTab: 'edit', isSettingsOpen: true, sidebarCollapsed: true });
  });
  it('uses the server snapshot only before this window has a sidebar preference', () => {
    const initial = parseSession(null);
    expect(restoreSidebar(initial, true).sidebarCollapsed).toBe(true);
    for (const sidebarCollapsed of [false, true]) {
      const current = { ...initial, sidebarCollapsed };
      expect(restoreSidebar(current, !sidebarCollapsed)).toBe(current);
    }
  });
});
