const eventName = 'origamix:application-settings-changed';
export const notifyApplicationChanged = (projectId: string) =>
  window.dispatchEvent(new CustomEvent(eventName, { detail: projectId }));
export const subscribeApplicationChanged = (projectId: string, listener: () => void) => {
  const receive = (event: Event) => {
    if ((event as CustomEvent).detail === projectId) listener();
  };
  window.addEventListener(eventName, receive);
  return () => window.removeEventListener(eventName, receive);
};
