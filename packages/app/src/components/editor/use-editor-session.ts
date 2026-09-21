import type { Schema } from '@tangramino/engine';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { schemaService } from '@/services/schema';
import { deriveSchemaOperations } from './derive-schema-operations';

export const useEditorSession = (projectId: string, pageId: string, readOnly: boolean) => {
  const [initial, setInitial] = useState<{
    schema: OrigamixPageSchema;
    revisionId: string;
    workingVersion: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const draftRef = useRef<OrigamixPageSchema | null>(null);
  const savedHashRef = useRef('');
  const workingVersionRef = useRef(0);
  const pendingRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<number | null>(null);
  const providerReadyRef = useRef(false);

  useEffect(() => {
    let active = true;
    providerReadyRef.current = false;
    schemaService
      .workingState(projectId, pageId)
      .then((result) => {
        if (!active) return;
        const hash = JSON.stringify(result.schema);
        draftRef.current = result.schema;
        savedHashRef.current = hash;
        workingVersionRef.current = result.workingVersion;
        setInitial(result);
        setError(null);
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : '无法读取 Schema');
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
      const saved = JSON.parse(savedHashRef.current) as OrigamixPageSchema;
      const operations = deriveSchemaOperations(saved, draft);
      const request =
        operations && operations.length > 0
          ? schemaService.applyWorkingOperations(
              projectId,
              pageId,
              workingVersionRef.current,
              operations,
            )
          : schemaService.updateWorking(projectId, pageId, workingVersionRef.current, draft);
      const operation = request
        .then((result) => {
          workingVersionRef.current = result.workingVersion;
          savedHashRef.current = JSON.stringify(result.schema);
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
      if (nextHash === savedHashRef.current) return;
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
    () => (initial ? `${projectId}:${pageId}:${initial.workingVersion}` : ''),
    [initial, pageId, projectId],
  );

  return { initial, loading, error, flush, onChange, providerKey };
};
