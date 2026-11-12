const eventName = 'origamix:project-pages-changed';
export const notifyProjectPagesChanged = (projectId: string) =>
  window.dispatchEvent(new CustomEvent(eventName, { detail: projectId }));
export const subscribeProjectPagesChanged = (projectId: string, listener: () => void) => {
  const receive = (event: Event) => {
    if ((event as CustomEvent).detail === projectId) listener();
  };
  window.addEventListener(eventName, receive);
  return () => window.removeEventListener(eventName, receive);
};
