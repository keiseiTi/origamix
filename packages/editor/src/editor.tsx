import { snapshotEditorPlugins } from './plugins/plugin-host';
import { extendEditorMaterial } from './plugins/material-plugins';
import { getEditorPlugins } from './session/editor-controls';
import type { OrigamixPageSchema } from '@origamix/shared';
import { DragOverlay } from './canvas/canvas-drag-controls';
import { EditorProvider } from './session/editor-provider';
import { useEditorCore } from './session/editor-session';
import { type Material } from './contracts/material-contracts';
import type { OrigamixPageSchema as Schema } from '@origamix/shared';
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { InsertPositionIndicator } from './canvas/insert-position-indicator';
import { EditorChrome } from './layout/editor-toolbar';
import type { EditorSaveOptions } from './session/editor-controls';
import { EditorLayout } from './layout/editor-layout';
import type { MaterialGroup } from './panels/material-panel';
import { useEditorView, type EditorInstance } from './session/editor-controls';

import type {
  EditorMaterialRegistration,
  EditorTheme,
  EditorMode,
  EditorTargetSelection,
} from './contracts/editor-contracts';

export interface EditorProps {
  editor: EditorInstance;
  onSave?: EditorSaveOptions['onSave'];
  onFlush?: EditorSaveOptions['onFlush'];
  canSave?: boolean;
  children?: ReactNode;
  schema: OrigamixPageSchema;
  sessionKey: string;
  registration: EditorMaterialRegistration;
  theme: EditorTheme;
  onChange: (schema: OrigamixPageSchema, options?: { immediate: boolean }) => void;
  readOnly?: boolean;
  readOnlyMessage?: string;
  targetSelection?: EditorTargetSelection;
}

const EditorCanvas = ({
  groups,
  viewportWidth,
  mode,
  onModeChange,
}: {
  groups: MaterialGroup[];
  viewportWidth: number;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => Promise<void>;
}): React.JSX.Element => {
  const dragElement = useEditorCore((state) => state.dragElement);

  const dragTitle = (dragElement as Material)?.title ?? '';

  return (
    <>
      <EditorLayout
        groups={groups}
        viewportWidth={viewportWidth}
        mode={mode}
        onModeChange={onModeChange}
      />
      <DragOverlay>
        <div className='rounded-md border border-blue-500 bg-white/95 px-3 py-2 text-xs text-blue-700 shadow-lg dark:bg-zinc-900 dark:text-blue-300'>
          {dragTitle}
        </div>
      </DragOverlay>
      <InsertPositionIndicator />
    </>
  );
};

export const Editor = ({
  editor,
  onSave,
  onFlush,
  canSave,
  children,
  schema,
  sessionKey,
  registration,
  theme,
  onChange,
  readOnly = false,
  readOnlyMessage,
  targetSelection,
}: EditorProps): React.JSX.Element => {
  const mode = useEditorView(editor, (state) => state.mode);
  const viewportWidth = useEditorView(editor, (state) => state.viewportWidth);
  const plugins = useMemo(
    () => snapshotEditorPlugins([...getEditorPlugins(editor), ...(registration.plugins ?? [])]),
    [editor, registration],
  );
  const extendedMaterials = useMemo(() => {
    const registry = new Map(
      registration.catalog.materials.map((manifest) => [manifest.type, manifest]),
    );
    return new Map(
      [
        ...(registration.rootMaterials ?? []),
        ...registration.groups.flatMap((group) => group.children),
      ].map((material) => {
        const manifest = registry.get(material.type);
        if (!manifest) throw new Error(`物料 ${material.type} 缺少 Manifest`);
        return [material.type, extendEditorMaterial(material, manifest, plugins)];
      }),
    );
  }, [registration, plugins]);
  const groups = useMemo(
    () =>
      registration.groups.map((group) => ({
        title: group.title,
        children: group.children.map((material) => extendedMaterials.get(material.type)!),
      })),
    [registration, extendedMaterials],
  );
  const rootMaterialTypes = useMemo(
    () => (registration.rootMaterials ?? []).map((material) => material.type),
    [registration.rootMaterials],
  );
  const materials = useMemo(
    () => [
      ...(registration.rootMaterials ?? []).map((material) =>
        extendedMaterials.get(material.type)!,
      ),
      ...groups.flatMap((group) => group.children),
    ],
    [groups, registration.rootMaterials, extendedMaterials],
  );

  // Host status updates must not rerun the engine's change effect for an unchanged schema.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const onEngineChange = useCallback(
    (next: Schema): void => {
      if (!readOnly)
        onChangeRef.current(next as OrigamixPageSchema, { immediate: mode === 'logic' });
    },
    [readOnly, mode],
  );

  return (
    <div className='relative border-t flex min-h-0 flex-1 flex-col bg-white dark:bg-zinc-950'>
      <EditorProvider
        key={sessionKey}
        editor={editor}
        plugins={plugins}
        save={{ onSave, onFlush, canSave }}
        readOnly={readOnly}
        theme={theme}
        materialCatalog={registration.catalog.materials}
        rootMaterialTypes={rootMaterialTypes}
        targetSelection={targetSelection}
        materials={materials}
        schema={schema as Schema}
        onChange={onEngineChange}
      >
        <EditorChrome>
          <div className='relative flex min-h-0 flex-1 flex-col'>
            <EditorCanvas
              groups={groups}
              viewportWidth={viewportWidth}
              mode={mode}
              onModeChange={editor.setMode}
            />
            {children}
            {readOnly && (
              <div
                className='absolute inset-0 z-20 grid place-items-center bg-white/45 backdrop-blur-[1px] dark:bg-zinc-950/55'
                role='status'
              >
                <span className='rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'>
                  {readOnlyMessage ?? '当前不可编辑'}
                </span>
              </div>
            )}
          </div>
        </EditorChrome>
      </EditorProvider>
    </div>
  );
};
