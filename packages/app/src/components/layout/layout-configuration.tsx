import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@origamix/ui';
import type { EditorHandle, EditorInstance } from '@origamix/editor';
import type { RefObject } from 'react';
import { layoutPresets, createLayoutPreset, type LayoutPreset } from './presets';
import type { useLayoutConfig } from './use-layout-config';

export const LayoutConfiguration = ({
  config,
  editor,
  editorRef,
  projectName,
  editing,
  canEdit,
}: {
  config: ReturnType<typeof useLayoutConfig>;
  editor: EditorInstance;
  editorRef: RefObject<EditorHandle | null>;
  projectName: string;
  editing: boolean;
  canEdit: boolean;
}) => {
  const [selectedPreset, setSelectedPreset] = useState<LayoutPreset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const applyPreset = async (preset: LayoutPreset) => {
    setChanging(true);
    setError(null);
    try {
      await editorRef.current?.flush();
      editor.setSchema(createLayoutPreset(preset, editor.getSchema(), projectName));
      await editorRef.current?.flush();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '使用预设失败，草稿已保留');
    } finally {
      setChanging(false);
    }
  };
  if (!editing && !config.error && !error) return null;
  return (
    <div className='shrink-0 border-b border-border bg-background px-4 py-3 text-sm'>
      {editing && config.config?.enabled && (
        <div className='mt-3 flex flex-wrap items-center gap-2' aria-label='布局预设'>
          <span className='mr-1 text-xs text-muted-foreground'>从预设开始</span>
          {layoutPresets.map((preset) => (
            <Button
              key={preset.id}
              size='sm'
              variant='outline'
              disabled={changing || config.busy || !canEdit}
              onClick={() => setSelectedPreset(preset.id)}
            >
              {preset.name}
            </Button>
          ))}
        </div>
      )}
      <Dialog
        open={selectedPreset !== null}
        onOpenChange={(open) => !open && setSelectedPreset(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>使用布局预设</DialogTitle>
            <DialogDescription>
              替换当前布局结构，可通过撤销恢复。不会保存版本或应用到项目。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setSelectedPreset(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                const preset = selectedPreset;
                setSelectedPreset(null);
                if (preset) void applyPreset(preset);
              }}
            >
              使用预设
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {(config.error || error) && (
        <div role='alert' className='mt-2 flex items-center gap-2 text-xs text-destructive'>
          {config.error || error}
          <Button
            size='sm'
            variant='ghost'
            onClick={() => void config.refresh().catch(() => undefined)}
          >
            重试读取
          </Button>
        </div>
      )}
    </div>
  );
};
