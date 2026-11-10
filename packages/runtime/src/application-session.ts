import type { ApplicationDefinition, ApplicationMetadata } from '@origamix/shared';
export interface ApplicationNavigation {
  navigateToPage: (id: string, returnPageId?: string) => void;
  returnPageId?: string | null;
}
const json = (value: unknown): unknown => {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(json);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype)
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (['__proto__', 'prototype', 'constructor'].includes(key))
          throw new Error('应用状态包含保留字段');
        return [key, json(item)];
      }),
    );
  throw new Error('应用状态只能包含 JSON 数据');
};
/** Transient per-application state; never persisted to Schema, storage, or platform databases. */
export const createApplicationSession = (
  definition: ApplicationDefinition,
  metadata: ApplicationMetadata,
  navigation: ApplicationNavigation,
) => {
  const initial = json(definition.initialState) as Record<string, unknown>;
  let snapshot = { state: structuredClone(initial), version: 0 };
  const listeners = new Set<() => void>();
  let currentNavigation = navigation;
  const publish = (state: Record<string, unknown>) => {
    snapshot = { state, version: snapshot.version + 1 };
    listeners.forEach((listener) => listener());
  };
  return {
    definition,
    metadata,
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setNavigation: (next: ApplicationNavigation) => {
      currentNavigation = next;
    },
    read: (name: string) => {
      if (!Object.hasOwn(initial, name)) throw new Error('应用状态未声明');
      return structuredClone(snapshot.state[name]);
    },
    update: (entries: readonly { name: string; value: unknown }[]) => {
      const next = { ...snapshot.state };
      for (const entry of entries) {
        if (!Object.hasOwn(initial, entry.name)) throw new Error(`应用状态未声明：${entry.name}`);
        const value = json(entry.value);
        if (
          definition.access.enabled &&
          entry.name === definition.access.stateKey &&
          typeof value !== 'boolean'
        )
          throw new Error('访问状态必须是布尔值');
        next[entry.name] = value;
      }
      publish(next);
    },
    reset: () => publish(structuredClone(initial)),
    navigate: (destination: 'page' | 'home' | 'return' | 'login', pageId?: string) => {
      const access = definition.access;
      const fallback = access.enabled
        ? access.homePageId
        : (metadata.pages.find((page) => page.path === '/') ?? metadata.pages[0])?.pageId;
      const id =
        destination === 'page'
          ? pageId
          : destination === 'login'
            ? access.enabled
              ? access.loginPageId
              : undefined
            : destination === 'return'
              ? metadata.pages.some((page) => page.pageId === currentNavigation.returnPageId) &&
                (!access.enabled || currentNavigation.returnPageId !== access.loginPageId)
                ? currentNavigation.returnPageId
                : fallback
              : fallback;
      if (!id || !metadata.pages.some((page) => page.pageId === id))
        throw new Error('目标页面不属于当前应用');
      currentNavigation.navigateToPage(id);
    },
    requireLogin: (from: string) => {
      if (definition.access.enabled)
        currentNavigation.navigateToPage(
          definition.access.loginPageId,
          metadata.pages.some((page) => page.pageId === from) ? from : undefined,
        );
    },
  };
};
export type ApplicationSession = ReturnType<typeof createApplicationSession>;
