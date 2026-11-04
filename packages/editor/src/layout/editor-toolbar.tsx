import type { ReactNode } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@origamix/ui';
import {
  getEditorPlugins,
  useEditorContext,
  useEditorSelector,
  type EditorInstance,
} from '../session/editor-controls';
import { composePluginRenderers } from '../plugins/compose-plugin-renderers';
import type { EditorToolbarArea as ToolbarArea } from '../contracts/plugin-contracts';

export type EditorToolbarArea = ToolbarArea;

/** Layout only: custom toolbars can reuse it without invoking the all renderer recursively. */
export const EditorToolbar = ({ children }: { children: ReactNode }) => (
  <header
    aria-label='编辑器工具栏'
    className='relative z-10 flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-3 text-xs'
  >
    {children}
  </header>
);

export const EditorSaveButton = () => {
  const editor = useEditorContext();
  const saving = useEditorSelector((state) => state.saving);
  const canSave = useEditorSelector((state) => state.canSave);
  const error = useEditorSelector((state) => state.saveError);
  return (
    <>
      {error && (
        <span role='alert' className='max-w-56 truncate text-destructive' title={error}>
          {error}
        </span>
      )}
      <Button
        size='sm'
        disabled={!canSave || saving}
        aria-busy={saving}
        title={!canSave ? '当前未配置保存能力或暂不可保存' : undefined}
        onClick={() => {
          void editor.save().catch(() => undefined);
        }}
      >
        <Save />
        {saving ? '保存中…' : '保存'}
      </Button>
    </>
  );
};

const renderToolbarArea = (
  editor: EditorInstance,
  area: Exclude<ToolbarArea, 'all'>,
  children?: ReactNode,
): ReactNode => {
  const initial = children === undefined && area === 'end' ? <EditorSaveButton /> : children;
  return (
    <div
      key={area}
      className={
        area === 'center'
          ? 'flex min-w-0 flex-1 items-center justify-center gap-2'
          : 'flex min-w-0 items-center gap-2'
      }
    >
      {composePluginRenderers(getEditorPlugins(editor), editor, 'renderToolbar', initial, area)}
    </div>
  );
};

/** Local regions only; safe to reuse from a plugin replacing area=all. */
export const EditorToolbarArea = ({
  area,
  children,
}: {
  area: Exclude<ToolbarArea, 'all'>;
  children?: ReactNode;
}) => {
  const editor = useEditorContext();
  return renderToolbarArea(editor, area, children);
};

export const EditorChrome = ({ children }: { children: ReactNode }) => {
  const editor = useEditorContext();
  const plugins = getEditorPlugins(editor);
  const defaultToolbar = (
    <EditorToolbar>
      {renderToolbarArea(editor, 'start')}
      {renderToolbarArea(editor, 'center')}
      {renderToolbarArea(editor, 'end')}
    </EditorToolbar>
  );
  return (
    <>
      {composePluginRenderers(plugins, editor, 'renderTop', null)}
      {composePluginRenderers(plugins, editor, 'renderToolbar', defaultToolbar, 'all')}
      {children}
      {composePluginRenderers(plugins, editor, 'renderBottom', null)}
    </>
  );
};
