import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@origamix/ui';
import type { EditorTool } from '../contracts';
import { GlobalVariablesPanel } from './global-variables-panel';
import { SchemaEditor } from './schema-editor';

const titles: Record<Exclude<EditorTool, 'history'>, string> = {
  globals: '全局变量',
  schema: 'Schema 编辑器',
};

export const EditorToolDialog = ({
  tool,
  onClose,
}: {
  tool: Exclude<EditorTool, 'history'> | null;
  onClose: () => void;
}): React.JSX.Element | null => {
  if (!tool) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={
          tool === 'globals'
            ? 'flex h-[min(70dvh,640px)] w-[calc(100%-2rem)] max-w-[1080px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1080px]'
            : tool === 'schema'
              ? 'flex h-[80dvh] w-[60vw] max-w-[60vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[60vw]'
              : 'h-[80vh] w-[60vw] max-w-[60vw] sm:max-w-[60vw]'
        }
      >
        <DialogHeader
          className={
            tool === 'globals' || tool === 'schema'
              ? 'shrink-0 border-b border-border px-5 py-4 pr-12'
              : undefined
          }
        >
          <DialogTitle>{titles[tool]}</DialogTitle>
        </DialogHeader>
        {tool === 'globals' ? (
          <GlobalVariablesPanel onSaved={onClose} />
        ) : tool === 'schema' ? (
          <SchemaEditor onSaved={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
