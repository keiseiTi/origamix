import { equalJson } from '@origamix/shared';
import { ApiRequestError, subscribeBackendReady } from '@/services/request';
import type { OrigamixPageSchema } from '@origamix/shared';
import type { EditorTransaction, EditorWorkingState } from '@origamix/editor';
import { createEditorTransaction } from '@origamix/editor';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { schemaService } from '@/services/schema';
type SessionKind = 'page';
type WorkingState = Awaited<ReturnType<typeof schemaService.workingState>>;
type Session = {
  scope: {
    projectId: string;
    pageId: string;
  };
  active: boolean;
  kind: SessionKind;
  ready: boolean;
  generation: number;
  draft: OrigamixPageSchema | null;
  savedSchema: OrigamixPageSchema | null;
  workingVersion: number;
  pending: Promise<void> | null;
  timer: number | null;
  failed: boolean;
  attempt: {
    schema: OrigamixPageSchema;
    requestId: string;
  } | null;
};
export const useEditorSession = (
  projectId: string,
  pageId: string,
  readOnly: boolean,
  onWorkingCommitted?: () => void,
  readyToEdit = true,
  schemaRefreshKey = '',
  kind: SessionKind = 'page',
) => {
  const service = schemaService;
  // A new ref cell per scope isolates queues even when an old request is pending.
  const sessionRef = useMemo<{
    current: Session;
  }>(
    () => ({
      current: {
        scope: { projectId, pageId },
        active: false,
        kind,
        ready: false,
        generation: 0,
        draft: null,
        savedSchema: null,
        workingVersion: 0,
        pending: null,
        timer: null,
        failed: false,
        attempt: null,
      },
    }),
    [projectId, pageId, kind],
  );
  const [loaded, setLoaded] = useState<{
    sessionRef: {
      current: Session;
    };
    initial: WorkingState | null;
    refreshKey: string;
    error: string | null;
  } | null>(null);
  const [failure, setFailure] = useState<{
    sessionRef: {
      current: Session;
    };
    message: string;
  } | null>(null);
  const onWorkingCommittedRef = useRef(onWorkingCommitted);
  useEffect(() => {
    onWorkingCommittedRef.current = onWorkingCommitted;
  }, [onWorkingCommitted]);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const ownedSession = sessionRef.current;
    ownedSession.active = true;
    return () => {
      ownedSession.active = false;
      ownedSession.ready = false;
      if (ownedSession.timer !== null) window.clearTimeout(ownedSession.timer);
    };
  }, [sessionRef]);
  useEffect(() => {
    let active = true;
    const ownedSession = sessionRef.current;
    let sequence = 0;
    const load = async () => {
      const request = ++sequence;
      try {
        if (ownedSession.pending) await ownedSession.pending;
        if (!active || request !== sequence) return;
        if (ownedSession.failed || !equalJson(ownedSession.draft, ownedSession.savedSchema))
          throw new Error('Working 已更新，本地草稿已保留；请先重试保存草稿，再重试加载');
        const baseVersion = ownedSession.workingVersion;
        const result = await service.workingState(projectId, pageId);
        if (!active || request !== sequence) return;
        // Editing may have continued while the read was in flight.
        if (
          ownedSession.workingVersion !== baseVersion ||
          ownedSession.pending ||
          ownedSession.failed ||
          !equalJson(ownedSession.draft, ownedSession.savedSchema)
        )
          throw new Error('加载期间出现本地编辑，草稿已保留，请重试加载');
        ownedSession.generation += 1;
        ownedSession.draft = result.schema;
        ownedSession.savedSchema = result.schema;
        ownedSession.workingVersion = result.workingVersion;
        setLoaded({ sessionRef, initial: result, refreshKey: schemaRefreshKey, error: null });
      } catch (reason) {
        if (active && request === sequence)
          setLoaded((previous) => ({
            sessionRef,
            initial: previous?.sessionRef === sessionRef ? previous.initial : null,
            refreshKey: schemaRefreshKey,
            error: reason instanceof Error ? reason.message : '无法读取 Schema',
          }));
      }
    };
    void load();
    const unsubscribe = subscribeBackendReady(() => {
      // A retained local draft must never be replaced by recovery reads.
      if (!ownedSession.draft) void load();
    });
    return () => {
      unsubscribe();
      active = false;
    };
  }, [projectId, pageId, sessionRef, schemaRefreshKey, retry, service]);
  useEffect(() => {
    if (!readyToEdit || loaded?.sessionRef !== sessionRef || !loaded.initial) return;
    const ownedSession = sessionRef.current;
    const timer = window.setTimeout(() => {
      ownedSession.ready = ownedSession.active;
    }, 0);
    return () => {
      window.clearTimeout(timer);
      ownedSession.ready = false;
    };
  }, [loaded, sessionRef, readyToEdit]);
  const flush = useCallback(async (): Promise<void> => {
    if (sessionRef.current.timer !== null) {
      window.clearTimeout(sessionRef.current.timer);
      sessionRef.current.timer = null;
    }
    try {
      while (sessionRef.current.active) {
        if (sessionRef.current.pending) {
          await sessionRef.current.pending;
          continue;
        }
        if (!sessionRef.current.active) throw new Error('编辑会话已切换，旧请求结果已忽略');
        const draft = sessionRef.current.draft;
        if (!draft || equalJson(draft, sessionRef.current.savedSchema)) return;
        if (readOnly) throw new Error('当前页面暂时只读，请稍后再试');
        const attempt = {
          schema: structuredClone(draft),
          requestId: crypto.randomUUID(),
        };
        sessionRef.current.attempt = attempt;
        const transaction: EditorTransaction = createEditorTransaction(
          {
            scope: sessionRef.current.scope,
            workingVersion: sessionRef.current.workingVersion,
            schema: sessionRef.current.savedSchema!,
          },
          attempt.schema,
        );
        const request =
          transaction.kind === 'operations'
            ? service.applyWorkingOperations(
                transaction.scope.projectId,
                transaction.scope.pageId,
                transaction.baseWorkingVersion,
                transaction.operations,
                ...[],
              )
            : service.updateWorking(
                transaction.scope.projectId,
                transaction.scope.pageId,
                transaction.baseWorkingVersion,
                transaction.schema,
                ...[],
              );
        const operation = request
          .then((result) => {
            if (!sessionRef.current.active) throw new Error('编辑会话已切换，旧请求结果已忽略');
            sessionRef.current.workingVersion = result.workingVersion;
            sessionRef.current.savedSchema = result.schema;
            sessionRef.current.failed = false;
            sessionRef.current.attempt = null;
            setFailure(null);
            onWorkingCommittedRef.current?.();
          })
          .finally(() => {
            if (sessionRef.current.pending === operation) sessionRef.current.pending = null;
          });
        sessionRef.current.pending = operation;
        await operation;
      }
      throw new Error('编辑会话已关闭');
    } catch (reason) {
      if (reason instanceof ApiRequestError && reason.status < 500 && reason.status !== 408)
        sessionRef.current.attempt = null;
      if (sessionRef.current.active) {
        sessionRef.current.failed = true;
        setFailure({
          sessionRef,
          message: reason instanceof Error ? reason.message : '草稿保存失败，编辑内容已保留',
        });
      }
      throw reason;
    }
  }, [readOnly, sessionRef, service]);
  const generation = sessionRef.current.generation;
  const onChange = (
    schema: OrigamixPageSchema,
    options?: {
      immediate: boolean;
    },
  ): void => {
    if (
      generation !== sessionRef.current.generation ||
      !sessionRef.current.active ||
      !sessionRef.current.ready ||
      readOnly
    )
      return;
    sessionRef.current.draft = schema;
    if (equalJson(schema, sessionRef.current.savedSchema)) return;
    if (sessionRef.current.timer !== null) window.clearTimeout(sessionRef.current.timer);
    // A failed/ambiguous write needs an explicit flush; typing does not replay it.
    if (!sessionRef.current.failed)
      sessionRef.current.timer = window.setTimeout(
        () => void flush().catch(() => undefined),
        options?.immediate ? 0 : 700,
      );
  };
  const acknowledgeWorking = useCallback(
    (working: EditorWorkingState): void => {
      const current = sessionRef.current;
      if (
        !current.active ||
        working.scope.projectId !== current.scope.projectId ||
        working.scope.pageId !== current.scope.pageId ||
        working.workingVersion <= current.workingVersion
      )
        return;
      if (!equalJson(working.schema, current.savedSchema))
        throw new Error('页面内容已变化，本地草稿已保留，请重新加载');
      current.workingVersion = working.workingVersion;
    },
    [sessionRef],
  );
  const current = loaded?.sessionRef === sessionRef ? loaded : null;
  const initial = current?.initial ?? null;
  // A canvas mount consumes the retained draft; ordinary saves do not change
  // this identity or reset the currently mounted editor's history.
  const snapshot =
    initial && sessionRef.current.draft
      ? {
          schema: sessionRef.current.draft,
          sessionKey: `${projectId}:${pageId}:${generation}`,
        }
      : null;
  return {
    initial,
    loading: !current,
    refreshing: Boolean(current && current.refreshKey !== schemaRefreshKey),
    retryLoad: () => setRetry((value) => value + 1),
    error: failure?.sessionRef === sessionRef ? failure.message : (current?.error ?? null),
    flush,
    onChange,
    snapshot,
    acknowledgeWorking,
  };
};
