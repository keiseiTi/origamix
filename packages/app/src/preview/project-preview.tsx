import { useEffect, useRef, useState } from 'react';
import {
  createBrowserRouter,
  createHashRouter,
  Link,
  Navigate,
  Outlet,
  RouterProvider,
  useHref,
  useLocation,
  useNavigate,
} from 'react-router';
import {
  ApplicationShell,
  applicationPages,
  OrigamixPage,
  ApplicationProvider,
  ApplicationAccess,
  readApplicationDefinition,
} from '@origamix/runtime';
import { isProjectPreviewSnapshot, type ProjectPreviewSnapshot } from '@origamix/shared';
import { ArrowLeft, ArrowRight, RefreshCw, X, Sun, Moon } from 'lucide-react';
import { Button, Spinner } from '@origamix/ui';
import { loadRuntimeMaterials } from '@/materials/loaders';

type Materials = Awaited<ReturnType<typeof loadRuntimeMaterials>>;
const readSnapshot = async (refresh = false): Promise<ProjectPreviewSnapshot> => {
  const response = await fetch(`/__origamix/${refresh ? 'refresh' : 'snapshot'}`, {
    cache: 'no-store',
  });
  const data: unknown = await response.json();
  if (!response.ok) throw new Error((data as { message?: string }).message ?? '项目预览读取失败');
  if (!isProjectPreviewSnapshot(data)) throw new Error('项目预览数据无效');
  return data;
};
const Failure = ({ message, retry }: { message: string; retry: () => void }) => (
  <main
    role='alert'
    className='grid min-h-screen place-content-center gap-4 bg-background p-8 text-foreground'
  >
    <p>{message}</p>
    <Button onClick={retry}>重试读取</Button>
  </main>
);
const setTheme = (dark: boolean) => {
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
};

const ProjectPreviewHost = () => {
  const frame = useRef<HTMLIFrameElement>(null);
  const [snapshot, setSnapshot] = useState<ProjectPreviewSnapshot | null>(null);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [dark, setDark] = useState(false);
  const [active, setActive] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [frameVersion, setFrameVersion] = useState(0);
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const currentUrl = useRef<string | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    let alive = true;
    const sequence = generation;
    readSnapshot()
      .then((value) => {
        if (alive) {
          setSnapshot(value);
          setApproved(!value.hasUnappliedChanges);
          setError(null);
          document.title = `${value.name} · 项目预览`;
        }
      })
      .catch((reason) => {
        if (alive) setError(reason instanceof Error ? reason.message : '项目预览读取失败');
      });
    return () => {
      alive = false;
      sequence.current++;
    };
  }, [attempt]);
  useEffect(() => {
    let alive = true,
      pending = false;
    const timer = setInterval(() => {
      if (pending) return;
      pending = true;
      void fetch('/__origamix/status', { cache: 'no-store' })
        .then(async (response) => {
          if (response.status === 410) {
            if (alive) setActive(false);
            return;
          }
          const data = await response.json();
          if (!alive) return;
          if (!response.ok) {
            setError(data.message ?? '项目内容无法读取');
            return;
          }
          setUpdated(data.updated === true);
        })
        .catch(() => {
          if (alive) setError('预览连接已断开，请关闭后重新打开');
        })
        .finally(() => {
          pending = false;
        });
    }, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'origamix.project.ready')
        frame.current?.contentWindow?.postMessage(
          { type: 'origamix.project.theme', dark },
          location.origin,
        );
      if (event.data?.type === 'origamix.project.location' && typeof event.data.href === 'string') {
        const url = new URL(event.data.href, location.origin);
        if (url.origin === location.origin && !url.pathname.startsWith('/__origamix/'))
          currentUrl.current = `${url.pathname}${url.search}${url.hash}`;
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [dark]);
  const refresh = async () => {
    if (busy) return;
    const identity = ++generation.current;
    setBusy(true);
    setError(null);
    try {
      const next = await readSnapshot(true);
      if (generation.current !== identity) return;
      if (
        snapshot &&
        (snapshot.manifest.routing.mode !== next.manifest.routing.mode ||
          snapshot.manifest.routing.basePath !== next.manifest.routing.basePath)
      )
        currentUrl.current = null;
      const prefix = next.manifest.routing.basePath;
      setFrameSrc(
        currentUrl.current ?? (next.manifest.routing.mode === 'hash' ? `${prefix}#/` : prefix),
      );
      setSnapshot(next);
      setUpdated(false);
      // A refresh reloads runtime state even when applied bytes have not changed.
      setFrameVersion((value) => value + 1);
    } catch (reason) {
      if (generation.current === identity)
        setError(reason instanceof Error ? reason.message : '刷新失败');
    } finally {
      if (generation.current === identity) setBusy(false);
    }
  };
  if (!active)
    return (
      <Failure message='布局已关闭或项目已不可用，本次预览已结束。' retry={() => window.close()} />
    );
  if (!snapshot)
    return error ? (
      <Failure message={error} retry={() => setAttempt((value) => value + 1)} />
    ) : (
      <Spinner aria-label='准备项目预览' />
    );
  const prefix = snapshot.manifest.routing.basePath;
  const src = frameSrc ?? (snapshot.manifest.routing.mode === 'hash' ? `${prefix}#/` : prefix);
  const send = (action: string) =>
    frame.current?.contentWindow?.postMessage(
      { type: 'origamix.project.history', action },
      location.origin,
    );
  return (
    <main className='flex h-screen flex-col bg-background text-foreground'>
      <header className='flex h-12 shrink-0 items-center gap-2 border-b border-border px-3'>
        <Button size='icon-sm' variant='ghost' aria-label='后退' onClick={() => send('back')}>
          <ArrowLeft />
        </Button>
        <Button size='icon-sm' variant='ghost' aria-label='前进' onClick={() => send('forward')}>
          <ArrowRight />
        </Button>
        <Button
          size='icon-sm'
          variant='ghost'
          aria-label='刷新项目预览'
          disabled={busy}
          onClick={() => void refresh()}
        >
          <RefreshCw className={busy ? 'animate-spin' : ''} />
        </Button>
        <span className='min-w-0 flex-1 truncate text-sm'>{snapshot.name}</span>
        {updated && (
          <Button size='sm' variant='secondary' disabled={busy} onClick={() => void refresh()}>
            项目内容已更新，点击刷新
          </Button>
        )}
        <Button
          size='icon-sm'
          variant='ghost'
          aria-label={dark ? '切换浅色' : '切换深色'}
          onClick={() => {
            setTheme(!dark);
            setDark(!dark);
            frame.current?.contentWindow?.postMessage(
              { type: 'origamix.project.theme', dark: !dark },
              location.origin,
            );
          }}
        >
          {dark ? <Sun /> : <Moon />}
        </Button>
        <Button
          size='icon-sm'
          variant='ghost'
          aria-label='关闭项目预览'
          onClick={() => window.close()}
        >
          <X />
        </Button>
      </header>
      {error && (
        <div
          role='alert'
          className='flex items-center gap-3 bg-destructive/10 px-4 py-2 text-sm text-destructive'
        >
          {error}
          <Button size='sm' variant='ghost' disabled={busy} onClick={() => void refresh()}>
            重试
          </Button>
        </div>
      )}
      {!approved ? (
        <section className='m-auto grid max-w-md gap-4 p-8'>
          <h1 className='font-semibold'>部分修改尚未应用</h1>
          <p className='text-sm text-muted-foreground'>
            项目预览使用已应用的内容，不会保存或应用当前草稿。
          </p>
          <Button onClick={() => setApproved(true)}>继续预览</Button>
          <Button variant='ghost' onClick={() => window.close()}>
            取消
          </Button>
        </section>
      ) : (
        <iframe
          key={`${snapshot.snapshotId}:${frameVersion}`}
          ref={frame}
          title='项目应用'
          src={src}
          sandbox='allow-scripts allow-same-origin allow-forms allow-modals'
          className='min-h-0 w-full flex-1 border-0'
        />
      )}
    </main>
  );
};

const Application = ({
  snapshot,
  materials,
}: {
  snapshot: ProjectPreviewSnapshot;
  materials: Materials;
}) => {
  const location = useLocation(),
    navigate = useNavigate(),
    rootHref = useHref('/').replace(/\/?$/, '/');
  const [dark, setDark] = useState(false);
  const pages = applicationPages(snapshot.manifest).map((page) => ({
    ...page,
    href: `${rootHref}${page.path.slice(1)}`,
  }));
  const currentPageId =
    pages.find((page) => page.path === (location.pathname.replace(/\/+$/, '') || '/'))?.pageId ??
    '';
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== window.location.origin) return;
      if (event.data?.type === 'origamix.project.theme' && typeof event.data.dark === 'boolean') {
        setDark(event.data.dark);
        setTheme(event.data.dark);
      }
      if (event.data?.type === 'origamix.project.history') {
        if (event.data.action === 'back') window.history.back();
        if (event.data.action === 'forward') window.history.forward();
      }
    };
    window.addEventListener('message', receive);
    window.parent.postMessage({ type: 'origamix.project.ready' }, window.location.origin);
    return () => window.removeEventListener('message', receive);
  }, []);
  useEffect(() => {
    window.parent.postMessage(
      { type: 'origamix.project.location', href: window.location.href },
      window.location.origin,
    );
  }, [location]);
  const definition = readApplicationDefinition(snapshot.manifest),
    access = definition.access;
  const loginPage = access.enabled && currentPageId === access.loginPageId;
  const candidate = new URLSearchParams(location.search).get('returnPageId');
  const returnPageId = pages.some((page) => page.pageId === candidate) ? candidate : null;
  const go = (id: string, returnTo?: string) => {
    const page = pages.find((page) => page.pageId === id);
    if (page)
      void navigate(page.path + (returnTo ? `?returnPageId=${encodeURIComponent(returnTo)}` : ''), {
        replace: Boolean(returnTo),
      });
  };
  const menuPages = pages.filter((page) => !access.enabled || page.pageId !== access.loginPageId);
  const Provider = materials.Provider;
  return (
    <Provider mode={dark ? 'dark' : 'light'}>
      <ApplicationProvider
        definition={definition}
        metadata={{ pages, stateKeys: Object.keys(definition.initialState) }}
        navigation={{ navigateToPage: go, returnPageId }}
      >
        <ApplicationAccess
          currentPageId={currentPageId}
          renderPending={() => <Spinner aria-label='进入页面' />}
        >
          <ApplicationShell
            projectId={snapshot.projectId}
            enabled={!loginPage}
            layout={snapshot.layout}
            materials={materials.components}
            navigation={{
              currentPageId,
              pages: menuPages,
              pageIds: menuPages.map((page) => page.pageId),
              navigateToPage: (id) => {
                const page = pages.find((page) => page.pageId === id);
                if (page) void navigate(page.path);
              },
            }}
          >
            <Outlet />
          </ApplicationShell>
        </ApplicationAccess>
      </ApplicationProvider>
    </Provider>
  );
};
const createApplicationRouter = (snapshot: ProjectPreviewSnapshot, materials: Materials) => {
  const pages = applicationPages(snapshot.manifest);
  const routes = pages.map((page) => ({
    path: page.path,
    element: (
      <OrigamixPage
        key={page.pageId}
        schema={snapshot.pageSchemas[page.pageId]!}
        materials={materials.components}
      />
    ),
  }));
  if (pages.length && !pages.some((page) => page.path === '/'))
    routes.push({ path: '/', element: <Navigate to={pages[0]!.path} replace /> });
  const createRouter =
    snapshot.manifest.routing.mode === 'hash' ? createHashRouter : createBrowserRouter;
  return createRouter(
    [
      {
        element: <Application snapshot={snapshot} materials={materials} />,
        errorElement: (
          <Failure
            message='应用渲染失败，请刷新项目预览。'
            retry={() => window.location.reload()}
          />
        ),
        children: [
          ...routes,
          {
            path: '*',
            element: (
              <section className='p-8'>
                <h1>{pages.length ? '页面不存在' : '项目还没有页面'}</h1>
                {pages.length > 0 && <Link to='/'>返回首页</Link>}
              </section>
            ),
          },
        ],
      },
    ],
    {
      basename:
        snapshot.manifest.routing.mode === 'browser' ? snapshot.manifest.routing.basePath : '/',
    },
  );
};
const ProjectApplication = () => {
  const [router, setRouter] = useState<ReturnType<typeof createApplicationRouter> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let owned: ReturnType<typeof createApplicationRouter> | undefined;
    void readSnapshot()
      .then(async (snapshot) => {
        const materials = await loadRuntimeMaterials(snapshot.manifest.materialSet);
        if (!alive) return;
        owned = createApplicationRouter(snapshot, materials);
        setRouter(owned);
      })
      .catch((reason) => {
        if (alive) setError(reason instanceof Error ? reason.message : '加载应用失败');
      });
    return () => {
      alive = false;
      owned?.dispose();
    };
  }, []);
  return error ? (
    <Failure message={error} retry={() => window.location.reload()} />
  ) : router ? (
    <RouterProvider router={router} />
  ) : (
    <Spinner aria-label='加载应用' />
  );
};
export const ProjectPreview = () =>
  window.location.pathname === '/__origamix/preview' ? (
    <ProjectPreviewHost />
  ) : (
    <ProjectApplication />
  );
