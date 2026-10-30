import { subscribeBackendReady } from '@/services/request';
import type { OrigamixPageSchema } from '@origamix/shared';
import type { EditorTransaction } from '@origamix/editor';
import { createEditorTransaction } from '@origamix/editor';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { schemaService } from '@/services/schema';

type WorkingState = Awaited<ReturnType<typeof schemaService.workingState>>;
type Session = {
  scope: { projectId: string; pageId: string };
  active: boolean;
  ready: boolean;
  draft: OrigamixPageSchema | null;
  savedHash: string;
  workingVersion: number;
  pending: Promise<void> | null;
  timer: number | null;
  failed: boolean;
};

export const useEditorSession = (
  projectId: string,
  pageId: string,
  readOnly: boolean,
  onWorkingCommitted?: () => void,
  readyToEdit = true,
) => {
  // A new ref cell per scope isolates queues even when an old request is pending.
  const sessionRef = useMemo<{ current: Session }>(
    () => ({
      current: {
        scope: { projectId, pageId },
        active: false,
        ready: false,
        draft: null,
        savedHash: '',
        workingVersion: 0,
        pending: null,
        timer: null,
        failed: false,
      },
    }),
    [projectId, pageId],
  );
  const [loaded, setLoaded] = useState<{
    sessionRef: { current: Session };
    initial: WorkingState | null;
    error: string | null;
  } | null>(null);
  const [failure, setFailure] = useState<{
    sessionRef: { current: Session };
    message: string;
  } | null>(null);
  const onWorkingCommittedRef = useRef(onWorkingCommitted);
  useEffect(() => {
    onWorkingCommittedRef.current = onWorkingCommitted;
  }, [onWorkingCommitted]);

  useEffect(() => {
    let active = true;
    const ownedSession = sessionRef.current;
    sessionRef.current.active = true;
    sessionRef.current.ready = false;
    let sequence = 0;
    const load = () => {
      const request = ++sequence;
      return schemaService
        .workingState(projectId, pageId)
        .then((result) => {
          if (!active || sequence !== request) return;
          sessionRef.current.draft = result.schema;
          sessionRef.current.savedHash = JSON.stringify(result.schema);
          sessionRef.current.workingVersion = result.workingVersion;
          setLoaded({ sessionRef, initial: result, error: null });
        })
        .catch((reason: unknown) => {
          if (active && sequence === request)
            setLoaded({
              sessionRef,
              initial: null,
              error: reason instanceof Error ? reason.message : '无法读取 Schema',
            });
        });
    };
    void load();
    const unsubscribe = subscribeBackendReady(() => {
      // A retained local draft must never be replaced by recovery reads.
      if (!ownedSession.draft) void load();
    });
    return () => {
      unsubscribe();
      active = false;
      ownedSession.active = false;
      ownedSession.ready = false;
      if (ownedSession.timer !== null) window.clearTimeout(ownedSession.timer);
    };
  }, [projectId, pageId, sessionRef]);

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
        if (!draft || JSON.stringify(draft) === sessionRef.current.savedHash) return;
        if (readOnly) throw new Error('当前页面暂时只读，请稍后再试');
        const transaction: EditorTransaction = createEditorTransaction(
          {
            scope: sessionRef.current.scope,
            workingVersion: sessionRef.current.workingVersion,
            schema: JSON.parse(sessionRef.current.savedHash) as OrigamixPageSchema,
          },
          draft,
        );
        const request =
          transaction.kind === 'operations'
            ? schemaService.applyWorkingOperations(
                transaction.scope.projectId,
                transaction.scope.pageId,
                transaction.baseWorkingVersion,
                transaction.operations,
              )
            : schemaService.updateWorking(
                transaction.scope.projectId,
                transaction.scope.pageId,
                transaction.baseWorkingVersion,
                transaction.schema,
              );
        const operation = request
          .then((result) => {
            if (!sessionRef.current.active) throw new Error('编辑会话已切换，旧请求结果已忽略');
            sessionRef.current.workingVersion = result.workingVersion;
            sessionRef.current.savedHash = JSON.stringify(result.schema);
            sessionRef.current.failed = false;
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
      if (sessionRef.current.active) {
        sessionRef.current.failed = true;
        setFailure({
          sessionRef,
          message: reason instanceof Error ? reason.message : '草稿保存失败，编辑内容已保留',
        });
      }
      throw reason;
    }
  }, [readOnly, sessionRef]);

  const onChange = (schema: OrigamixPageSchema, options?: { immediate: boolean }): void => {
    if (!sessionRef.current.active || !sessionRef.current.ready || readOnly) return;
    sessionRef.current.draft = schema;
    if (JSON.stringify(schema) === sessionRef.current.savedHash) return;
    if (sessionRef.current.timer !== null) window.clearTimeout(sessionRef.current.timer);
    // A failed/ambiguous write needs an explicit flush; typing does not replay it.
    if (!sessionRef.current.failed)
      sessionRef.current.timer = window.setTimeout(
        () => void flush().catch(() => undefined),
        options?.immediate ? 0 : 700,
      );
  };

  const current = loaded?.sessionRef === sessionRef ? loaded : null;
  const initial = current?.initial ?? null;
  const providerKey = initial ? `${projectId}:${pageId}:${initial.workingVersion}` : '';
  return {
    initial,
    loading: !current,
    error: failure?.sessionRef === sessionRef ? failure.message : (current?.error ?? null),
    flush,
    onChange,
    providerKey,
  };
};
