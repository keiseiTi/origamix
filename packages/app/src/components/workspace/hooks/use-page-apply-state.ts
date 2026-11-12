import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { schemaService } from '@/services/schema';
type SessionKind = 'page';
import { pageOperationKey, usePendingOperations } from '@/store/pending-operations';
import { ApiRequestError, subscribeBackendReady } from '@/services/request';
import type { EditorHandle } from '@origamix/editor';

export type PageApplyStatus =
  | 'loading'
  | 'in_sync'
  | 'draft_unsaved'
  | 'saved_pending_apply'
  | 'external_change'
  | 'result_pending'
  | 'error';

export const usePageApplyState = ({
  projectId,
  pageId,
  schemaRefreshKey,
  active = true,
  editorRef,
  onSchemaCommitted,
}: {
  projectId?: string;
  pageId?: string;
  schemaRefreshKey: string;
  active?: boolean;
  kind?: SessionKind;
  editorRef: RefObject<EditorHandle | null>;
  onSchemaCommitted: (pageId: string, revisionId: string) => void;
}) => {
  const service = schemaService;
  const pageKey = pageOperationKey(projectId ?? '', pageId ?? '');
  const pendingApply = usePendingOperations((state) => state.applies[pageKey]);
  const [applyState, setApplyState] = useState<{ pageKey: string; value: PageApplyStatus }>({
    pageKey,
    value: 'loading',
  });
  const pageKeyRef = useRef(pageKey);
  const requests = useRef({ issued: 0, accepted: 0 });

  useEffect(() => {
    pageKeyRef.current = pageKey;
    return () => {
      pageKeyRef.current = '';
    };
  }, [pageKey]);
  const applyStatus = pendingApply
    ? 'result_pending'
    : applyState.pageKey === pageKey
      ? applyState.value
      : 'loading';
  const setApplyStatus = useCallback(
    (value: PageApplyStatus): void => setApplyState({ pageKey, value }),
    [pageKey],
  );

  const refreshApplyState = useCallback(async (): Promise<void> => {
    if (!pageId || !projectId) return;
    const requestPageKey = pageOperationKey(projectId, pageId);
    const requestState = requests.current;
    const sequence = ++requestState.issued;
    const publish = (value: PageApplyStatus) => {
      if (pageKeyRef.current !== requestPageKey || sequence <= requestState.accepted) return;
      requestState.accepted = sequence;
      setApplyStatus(value);
    };
    try {
      const state = await service.applyState(projectId, pageId);
      publish(state.status);
    } catch {
      publish('error');
    }
  }, [pageId, projectId, setApplyStatus, service]);

  useEffect(() => {
    if (!active) return;
    const requestState = requests.current;
    const initial = window.setTimeout(() => void refreshApplyState(), 0);
    return () => {
      // Invalidate responses immediately when the page or Revision changes.
      requestState.accepted = ++requestState.issued;
      window.clearTimeout(initial);
    };
  }, [active, refreshApplyState, schemaRefreshKey]);

  useEffect(() => {
    if (!active) return;
    return subscribeBackendReady(() => void refreshApplyState());
  }, [active, refreshApplyState]);

  const applyPage = async (): Promise<void> => {
    if (!pageId || !projectId) return;
    const requestPageKey = pageOperationKey(projectId, pageId);
    await editorRef.current?.flush();
    const current = await service.workingState(projectId, pageId);
    if (pageKeyRef.current !== requestPageKey) return;
    const operations = usePendingOperations.getState();
    const previousRequest = operations.applies[requestPageKey];
    if (previousRequest?.inFlight) throw new Error('应用请求仍在处理中，请稍后重试');
    if (!previousRequest && !current.revisionId) throw new Error('请先保存版本，再应用到项目');
    if (pageKeyRef.current !== requestPageKey) return;
    const request = previousRequest ?? {
      revisionId: current.revisionId!,
      workingVersion: current.workingVersion,
      clientRequestId: crypto.randomUUID(),
    };
    operations.setApply(requestPageKey, { ...request, inFlight: true });
    try {
      await service.apply(
        projectId,
        pageId,
        request.revisionId,
        request.workingVersion,
        request.clientRequestId,
      );
      operations.finishApply(requestPageKey, request.clientRequestId, true);
      if (pageKeyRef.current !== requestPageKey) return;
      await refreshApplyState();
    } catch (error) {
      if (pageKeyRef.current === requestPageKey)
        setApplyStatus(
          !(error instanceof ApiRequestError) || error.status >= 500 ? 'result_pending' : 'error',
        );
      operations.finishApply(
        requestPageKey,
        request.clientRequestId,
        error instanceof ApiRequestError &&
          error.status >= 400 &&
          error.status < 500 &&
          error.status !== 408,
      );
      throw error;
    }
  };

  const saveVersion = async (): Promise<void> => {
    if (!pageId || !projectId) return;
    const requestPageKey = pageOperationKey(projectId, pageId);
    await editorRef.current?.flush();
    const current = await service.workingState(projectId, pageId);
    if (pageKeyRef.current !== requestPageKey) return;
    const saved = await service.saveRevision(projectId, pageId, current.workingVersion);
    if (pageKeyRef.current !== requestPageKey) return;
    editorRef.current?.acknowledgeWorking?.({
      scope: { projectId, pageId },
      schema: saved.schema,
      workingVersion: saved.workingVersion,
    });
    // Saving a checkpoint advances Working metadata without resetting canvas/history.
    await refreshApplyState();
  };

  const reloadFromProject = async (): Promise<void> => {
    if (!pageId || !projectId) return;
    const requestPageKey = pageOperationKey(projectId, pageId);
    const result = await service.reloadFromProject(projectId, pageId);
    if (pageKeyRef.current !== requestPageKey) return;
    onSchemaCommitted(pageId, result.revisionId);
    await refreshApplyState();
  };

  const restoreRevision = async (revisionId: string): Promise<void> => {
    if (!pageId || !projectId) return;
    const requestPageKey = pageOperationKey(projectId, pageId);
    await editorRef.current?.flush();
    const current = await service.workingState(projectId, pageId);
    if (pageKeyRef.current !== requestPageKey) return;
    const restored = await service.restoreRevision(
      projectId,
      pageId,
      revisionId,
      current.workingVersion,
    );
    if (pageKeyRef.current !== requestPageKey) return;
    onSchemaCommitted(pageId, `working_restore_${restored.workingVersion}`);
    await refreshApplyState();
  };

  return {
    applyStatus,
    refreshApplyState,
    saveVersion,
    applyPage,
    reloadFromProject,
    restoreRevision,
  };
};
