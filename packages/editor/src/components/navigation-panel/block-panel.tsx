import { nanoid } from 'nanoid';
import { useState } from 'react';
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@origamix/ui';
import { instantiateBlock, type BlockDefinition } from '@origamix/shared';
import { useEditorCore } from '../../session/editor-context';
import { Draggable } from '../canvas/canvas-drag-controls';

const BlockItem = ({ block }: { block: BlockDefinition }) => {
  const materials = useEditorCore((state) => state.materials);
  const schema = useEditorCore((state) => state.schema);
  const active = useEditorCore((state) => state.activeElement);
  const setSchema = useEditorCore((state) => state.setSchema);
  const readOnly = useEditorCore((state) => state.readOnly);
  const [open, setOpen] = useState(false);
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const root = materials.find(
    (item) => item.type === block.schema.elements[block.schema.layout.root]?.type,
  );
  if (!root) return null;
  const ready = block.parameters.every((parameter) => parameters[parameter.name]?.trim());
  const material = { ...root, title: block.title, block: { definition: block, parameters } };
  const insert = () => {
    try {
      const parentId = active?.material.acceptsChildren ? active.id : schema.layout.root;
      const parent = schema.elements[parentId];
      if (!parent || (root.dropTypes && !root.dropTypes.includes(parent.type)))
        throw new Error('请先选择允许放置该模块的容器');
      const result = instantiateBlock({
        block,
        parameters,
        schema,
        parentId,
        createId: () => `element-${nanoid()}`,
      });
      setSchema(result.schema, { source: 'panel' });
      setOpen(false);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '插入失败，草稿已保留');
    }
  };
  return (
    <div className='space-y-2 rounded border border-border p-3'>
      {ready && !readOnly ? (
        <Draggable material={material}>
          <div className='cursor-grab rounded bg-muted p-2 text-sm'>{block.title} · 拖入画布</div>
        </Draggable>
      ) : (
        <div className='text-sm font-medium'>{block.title}</div>
      )}
      <p className='text-xs text-muted-foreground'>{block.description}</p>
      <Button size='sm' variant='outline' disabled={readOnly} onClick={() => setOpen(true)}>
        配置并插入
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{block.title}</DialogTitle>
            <DialogDescription>
              {block.description} 插入后可分别编辑元素和事件逻辑。
            </DialogDescription>
          </DialogHeader>
          {block.parameters.map((parameter) => (
            <label className='grid gap-2 text-sm' key={parameter.name}>
              {parameter.label}
              <Input
                value={parameters[parameter.name] ?? ''}
                onChange={(event) =>
                  setParameters((previous) => ({
                    ...previous,
                    [parameter.name]: event.target.value,
                  }))
                }
              />
            </label>
          ))}
          {error && (
            <p role='alert' className='text-sm text-destructive'>
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant='outline' onClick={() => setOpen(false)}>
              关闭
            </Button>
            <Button disabled={!ready || readOnly} onClick={insert}>
              插入当前容器
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export const BlockPanel = () => {
  const blocks = useEditorCore((state) => state.blocks);
  return (
    <div className='h-full space-y-3 overflow-auto p-3' aria-label='组合模块'>
      {blocks.length ? (
        blocks.map((block) => <BlockItem key={block.id} block={block} />)
      ) : (
        <p className='text-xs text-muted-foreground'>当前编辑目标没有可用的组合模块</p>
      )}
    </div>
  );
};
