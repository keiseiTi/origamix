import type { Schema } from '@tangramino/engine';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { schemaService } from '../../services/schema';

export type EditorSaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

export const useEditorSession = (projectId: string, pageId: string, readOnly: boolean) => {
  const [initial, setInitial] = useState<{
    schema: OrigamixPageSchema;
    revisionId: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<EditorSaveStatus>('saved');
  const [error, setError] = useState<string | null>(null);
  const draftRef = useRef<OrigamixPageSchema | null>(null);
  const savedHashRef = useRef('');
  const revisionRef = useRef('');
  const pendingRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<number | null>(null);
  const providerReadyRef = useRef(false);

  useEffect(() => {
    let active = true;
    providerReadyRef.current = false;
    schemaService
      .get(projectId, pageId)
      .then((result) => {
        if (!active) return;
        const hash = JSON.stringify(result.schema);
        draftRef.current = result.schema;
        savedHashRef.current = hash;
        revisionRef.current = result.revisionId;
        setInitial(result);
        setStatus('saved');
        setError(null);
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : '无法读取 Schema');
        setStatus('error');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [projectId, pageId]);

  const flush = useCallback(async (): Promise<void> => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    while (true) {
      if (pendingRef.current) await pendingRef.current;
      const draft = draftRef.current;
      const draftHash = draft ? JSON.stringify(draft) : '';
      if (!draft || draftHash === savedHashRef.current) return;
      if (readOnly) throw new Error('AI 正在修改当前页面，请等待本轮完成');
      setStatus('saving');
      setError(null);
      const operation = schemaService
        .replace(projectId, pageId, { baseRevisionId: revisionRef.current, schema: draft })
        .then((result) => {
          revisionRef.current = result.revisionId;
          savedHashRef.current = JSON.stringify(result.schema);
          setStatus(JSON.stringify(draftRef.current) === savedHashRef.current ? 'saved' : 'dirty');
        })
        .catch((reason) => {
          setError(reason instanceof Error ? reason.message : '保存 Schema 失败');
          setStatus('error');
          throw reason;
        })
        .finally(() => {
          pendingRef.current = null;
        });
      pendingRef.current = operation;
      await operation;
    }
  }, [pageId, projectId, readOnly]);

  const onChange = useCallback(
    (schema: Schema): void => {
      if (!providerReadyRef.current || readOnly) return;
      const next = schema as OrigamixPageSchema;
      const nextHash = JSON.stringify(next);
      draftRef.current = next;
      if (nextHash === savedHashRef.current) {
        setStatus('saved');
        return;
      }
      setStatus('dirty');
      setError(null);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => void flush().catch(() => undefined), 700);
    },
    [flush, readOnly],
  );

  useEffect(() => {
    if (!initial) return;
    const timer = window.setTimeout(() => {
      providerReadyRef.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initial]);

  const providerKey = useMemo(
    () => (initial ? `${projectId}:${pageId}:${initial.revisionId}` : ''),
    [initial, pageId, projectId],
  );

  return { initial, loading, status, error, flush, onChange, providerKey };
};
