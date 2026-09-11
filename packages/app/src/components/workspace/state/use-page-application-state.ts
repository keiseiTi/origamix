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
  const [applyStatus, setApplyStatus] = useState<PageApplyStatus>('loading');
  const [saveStatus, setSaveStatus] = useState<EditorSaveStatus>('saved');
  const pageKey = `${projectId ?? ''}:${pageId ?? ''}`;
  const pageKeyRef = useRef(pageKey);
  useEffect(() => {
    pageKeyRef.current = pageKey;
  }, [pageKey]);

  const refreshApplyState = useCallback(async (): Promise<void> => {
    if (!pageId || !projectId) return;
    const requestPageKey = `${projectId}:${pageId}`;
    try {
      const state = await schemaService.applyState(projectId, pageId);
      if (pageKeyRef.current === requestPageKey) setApplyStatus(state.status);
    } catch {
      if (pageKeyRef.current === requestPageKey) setApplyStatus('error');
    }
  }, [pageId, projectId]);

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
    await editorRef.current?.flush();
    const current = await schemaService.get(projectId, pageId);
    try {
      await schemaService.apply(projectId, pageId, current.revisionId);
      await refreshApplyState();
    } catch (error) {
      setApplyStatus(
        !(error instanceof ApiRequestError) || error.status >= 500 ? 'result_pending' : 'error',
      );
      throw error;
    }
  };

  const reloadFromProject = async (): Promise<void> => {
    if (!pageId || !projectId) return;
    const result = await schemaService.reloadFromProject(projectId, pageId);
    onSchemaCommitted(pageId, result.revisionId);
    await refreshApplyState();
  };

  return { applyStatus, saveStatus, setSaveStatus, applyPage, reloadFromProject };
};
