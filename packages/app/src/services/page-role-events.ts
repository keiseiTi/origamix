const listeners = new Set<(projectId: string) => void>();

export const notifyPageRolesChanged = (projectId: string): void => {
  for (const listener of listeners) listener(projectId);
};

export const subscribePageRolesChanged = (listener: (projectId: string) => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
