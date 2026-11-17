export const isProductionWeb = () =>
  typeof document !== 'undefined' &&
  document.querySelector('meta[name="origamix-web-host"][content="production"]') !== null;

export const hasProductionWebModel = () =>
  document.querySelector('meta[name="origamix-model-configured"][content="true"]') !== null;

let expired = false;
const listeners = new Set<(expired: boolean) => void>();
export const subscribeWebSession = (listener: (expired: boolean) => void) => {
  listeners.add(listener);
  listener(expired);
  return () => {
    listeners.delete(listener);
  };
};

const updateWebSession = (requiresLogin: boolean) => {
  if (requiresLogin === expired) return;
  expired = requiresLogin;
  for (const listener of listeners) listener(expired);
};

export const observeWebSession = (response: Response) => {
  if (isProductionWeb() && response.headers.get('X-Origamix-Session-Required') === '1')
    updateWebSession(true);
};

export const checkWebSession = async (signal: AbortSignal) => {
  const response = await fetch('/api/v1/health', { cache: 'no-store', signal });
  if (signal.aborted) return;
  if (response.ok) updateWebSession(false);
  else observeWebSession(response);
};
