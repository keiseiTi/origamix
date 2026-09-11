import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { schemaService } from '../../../services/schema';
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
  const pageKey = `${projectId ?? ''}:${pageId ?? ''}`;
  const [applyState, setApplyState] = useState<{ pageKey: string; value: PageApplyStatus }>({
    pageKey,
    value: 'loading',
  });
  const [saveState, setSaveState] = useState<{ pageKey: string; value: EditorSaveStatus }>({
    pageKey,
    value: 'saved',
  });
  const pageKeyRef = useRef(pageKey);
  const applyRequestsRef = useRef(
    new Map<string, { revisionId: string; clientRequestId: string }>(),
  );
  useEffect(() => {
    pageKeyRef.current = pageKey;
  }, [pageKey]);
  const applyStatus = applyState.pageKey === pageKey ? applyState.value : 'loading';
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
    const requestPageKey = `${projectId}:${pageId}`;
    try {
      const state = await schemaService.applyState(projectId, pageId);
      if (pageKeyRef.current === requestPageKey) setApplyStatus(state.status);
    } catch {
      if (pageKeyRef.current === requestPageKey) setApplyStatus('error');
    }
  }, [pageId, projectId, setApplyStatus]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refreshApplyState(), 0);
    const timer = window.setInterval(() => void refreshApplyState(), 1500);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refreshApplyState, schemaRefreshKey]);

  const applyPage = async (): Promise<void> => {
    if (!pageId || !projectId) return;
    const requestPageKey = `${projectId}:${pageId}`;
    await editorRef.current?.flush();
    const current = await schemaService.get(projectId, pageId);
    if (pageKeyRef.current !== requestPageKey) return;
    const previousRequest = applyRequestsRef.current.get(requestPageKey);
    const request =
      previousRequest?.revisionId === current.revisionId
        ? previousRequest
        : { revisionId: current.revisionId, clientRequestId: crypto.randomUUID() };
    applyRequestsRef.current.set(requestPageKey, request);
    try {
      await schemaService.apply(projectId, pageId, current.revisionId, request.clientRequestId);
      applyRequestsRef.current.delete(requestPageKey);
      if (pageKeyRef.current !== requestPageKey) return;
      await refreshApplyState();
    } catch (error) {
      if (pageKeyRef.current === requestPageKey)
        setApplyStatus(
          !(error instanceof ApiRequestError) || error.status >= 500 ? 'result_pending' : 'error',
        );
      if (error instanceof ApiRequestError && error.status < 500)
        applyRequestsRef.current.delete(requestPageKey);
      throw error;
    }
  };

  const reloadFromProject = async (): Promise<void> => {
    if (!pageId || !projectId) return;
    const requestPageKey = `${projectId}:${pageId}`;
    const result = await schemaService.reloadFromProject(projectId, pageId);
    if (pageKeyRef.current !== requestPageKey) return;
    onSchemaCommitted(pageId, result.revisionId);
    await refreshApplyState();
  };

  return { applyStatus, saveStatus, setSaveStatus, applyPage, reloadFromProject };
};
