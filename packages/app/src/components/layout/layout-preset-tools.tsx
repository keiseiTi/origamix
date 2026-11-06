import { useState, type RefObject } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@origamix/ui';
import { useEditorContext, useEditorSelector, type EditorHandle } from '@origamix/editor';
import { PanelsTopLeft, ChevronDown } from 'lucide-react';
import { layoutPresets, createLayoutPreset, type LayoutPreset } from './presets';

export const LayoutPresetTools = ({
  editorRef,
  projectName,
  canEdit,
}: {
  editorRef: RefObject<EditorHandle | null>;
  projectName: string;
  canEdit: boolean;
}) => {
  const editor = useEditorContext();
  const readOnly = useEditorSelector((state) => state.readOnly);
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
      setSelectedPreset(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '使用预设失败，草稿已保留');
    } finally {
      setChanging(false);
    }
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button size='sm' variant='ghost' disabled={!canEdit || readOnly || changing} />}
        >
          <PanelsTopLeft size={15} />
          从预设开始
          <ChevronDown size={13} />
        </DropdownMenuTrigger>
        <DropdownMenuContent aria-label='布局预设'>
          {layoutPresets.map((preset) => (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => {
                setError(null);
                setSelectedPreset(preset.id);
              }}
            >
              {preset.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={selectedPreset !== null}
        onOpenChange={(open) => !open && !changing && setSelectedPreset(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>使用布局预设</DialogTitle>
            <DialogDescription>
              替换当前布局结构，可通过撤销恢复。不会保存版本或应用到项目。
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role='alert' className='text-sm text-destructive'>
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant='outline' disabled={changing} onClick={() => setSelectedPreset(null)}>
              取消
            </Button>
            <Button
              disabled={changing || !canEdit || readOnly}
              onClick={() => {
                const preset = selectedPreset;
                if (preset) void applyPreset(preset);
              }}
            >
              {changing ? '正在使用…' : '使用预设'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
