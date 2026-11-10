import {
  createContext,
  useContext,
  useState,
  useLayoutEffect,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { ApplicationDefinition, ApplicationMetadata } from '@origamix/shared';
import {
  createApplicationSession,
  type ApplicationSession,
  type ApplicationNavigation,
} from './application-session';
import type { RuntimeEngine } from './core/types';
const Context = createContext<ApplicationSession | null>(null);
const engines = new WeakMap<RuntimeEngine, ApplicationSession>();
export const bindApplication = (engine: RuntimeEngine, session: ApplicationSession | null) => {
  if (session) engines.set(engine, session);
  else engines.delete(engine);
};
export const engineApplication = (engine: RuntimeEngine) => {
  const value = engines.get(engine);
  if (!value) throw new Error('应用动作需要项目预览或生成应用上下文');
  return value;
};
export const ApplicationProvider = ({
  definition,
  metadata,
  navigation,
  children,
}: {
  definition: ApplicationDefinition;
  metadata: ApplicationMetadata;
  navigation: ApplicationNavigation;
  children: ReactNode;
}) => {
  const key = JSON.stringify({ definition, metadata });
  const [holder, setHolder] = useState(() => ({
    key,
    session: createApplicationSession(definition, metadata, navigation),
  }));
  if (holder.key !== key)
    setHolder({ key, session: createApplicationSession(definition, metadata, navigation) });
  const session = holder.session;
  useLayoutEffect(() => session.setNavigation(navigation), [session, navigation]);
  return <Context.Provider value={session}>{children}</Context.Provider>;
};
export const useApplication = () => useContext(Context);
export const ApplicationAccess = ({
  currentPageId,
  children,
  renderPending,
}: {
  currentPageId: string;
  children: ReactNode;
  renderPending: () => ReactNode;
}) => {
  const session = useApplication();
  return session ? (
    <Access session={session} currentPageId={currentPageId} renderPending={renderPending}>
      {children}
    </Access>
  ) : (
    <>{children}</>
  );
};
const Access = ({
  session,
  currentPageId,
  children,
  renderPending,
}: {
  session: ApplicationSession;
  currentPageId: string;
  children: ReactNode;
  renderPending: () => ReactNode;
}) => {
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const access = session.definition.access;
  const allowed = !access.enabled || snapshot.state[access.stateKey] === true;
  const login = access.enabled && currentPageId === access.loginPageId;
  const publicPage = login || (access.enabled && access.publicPageIds.includes(currentPageId));
  useEffect(() => {
    if (!access.enabled) return;
    if (!allowed && !publicPage) session.requireLogin(currentPageId);
    if (allowed && login) session.navigate('return');
  }, [session, access, allowed, publicPage, login, currentPageId]);
  if (access.enabled && ((!allowed && !publicPage) || (allowed && login)))
    return <>{renderPending()}</>;
  return <>{children}</>;
};
