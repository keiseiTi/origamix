import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { schemaService } from '../../../services/schema';
import { pageOperationKey, usePendingOperations } from '../../../store/pending-operations';
import { ApiRequestError } from '../../../services/request';
import type { EditorHandle } from '../../editor';
import type { EditorSaveStatus } from '../../editor/use-editor-session';

export type PageApplyStatus =
  'loading' | 'in_sync' | 'pending' | 'external_change' | 'result_pending' | 'error';

export const usePageApplicationState = ({
  projectId,
  pageId,
  schemaRefreshKey,
  editorRef,
  onSchemaCommitted,
}: {
  projectId?: string;
  pageId?: string;
  schemaRefreshKey: string;
  editorRef: RefObject<EditorHandle | null>;
  onSchemaCommitted: (pageId: string, revisionId: string) => void;
}) => {
  const pageKey = pageOperationKey(projectId ?? '', pageId ?? '');
  const pendingApply = usePendingOperations((state) => state.applies[pageKey]);
  const [applyState, setApplyState] = useState<{ pageKey: string; value: PageApplyStatus }>({
    pageKey,
    value: 'loading',
  });
  const [saveState, setSaveState] = useState<{ pageKey: string; value: EditorSaveStatus }>({
    pageKey,
    value: 'saved',
  });
  const pageKeyRef = useRef(pageKey);
  const polling = useRef({ issued: 0, accepted: 0 });

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
  const saveStatus = saveState.pageKey === pageKey ? saveState.value : 'saved';
  const setApplyStatus = useCallback(
    (value: PageApplyStatus): void => setApplyState({ pageKey, value }),
    [pageKey],
  );
  const setSaveStatus = useCallback(
    (value: EditorSaveStatus): void => setSaveState({ pageKey, value }),
    [pageKey],
  );

  const refreshApplyState = useCallback(async (): Promise<void> => {
    if (!pageId || !projectId) return;
    const requestPageKey = pageOperationKey(projectId, pageId);
    const pollingState = polling.current;
    const sequence = ++pollingState.issued;
    const publish = (value: PageApplyStatus) => {
      if (pageKeyRef.current !== requestPageKey || sequence <= pollingState.accepted) return;
      // Accept responses in request order without starving slower-than-interval polling.
      pollingState.accepted = sequence;
      setApplyStatus(value);
    };
    try {
      const state = await schemaService.applyState(projectId, pageId);
      publish(state.status);
    } catch {
      publish('error');
    }
  }, [pageId, projectId, setApplyStatus]);

  useEffect(() => {
    const pollingState = polling.current;
    const initial = window.setTimeout(() => void refreshApplyState(), 0);
    const timer = window.setInterval(() => void refreshApplyState(), 1500);
    return () => {
      // Invalidate responses immediately, before a new page/revision starts polling.
      pollingState.accepted = ++pollingState.issued;
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refreshApplyState, schemaRefreshKey]);

  const applyPage = async (): Promise<void> => {
    if (!pageId || !projectId) return;
    const requestPageKey = pageOperationKey(projectId, pageId);
    await editorRef.current?.flush();
    const current = await schemaService.get(projectId, pageId);
    if (pageKeyRef.current !== requestPageKey) return;
    const operations = usePendingOperations.getState();
    const previousRequest = operations.applies[requestPageKey];
    if (previousRequest?.inFlight) throw new Error('应用请求仍在处理中，请稍后重试');
    const request = previousRequest ?? {
      revisionId: current.revisionId,
      clientRequestId: crypto.randomUUID(),
    };
    operations.setApply(requestPageKey, { ...request, inFlight: true });
    try {
      await schemaService.apply(projectId, pageId, request.revisionId, request.clientRequestId);
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

  const reloadFromProject = async (): Promise<void> => {
    if (!pageId || !projectId) return;
    const requestPageKey = pageOperationKey(projectId, pageId);
    const result = await schemaService.reloadFromProject(projectId, pageId);
    if (pageKeyRef.current !== requestPageKey) return;
    onSchemaCommitted(pageId, result.revisionId);
    await refreshApplyState();
  };

  return { applyStatus, saveStatus, setSaveStatus, applyPage, reloadFromProject };
};
