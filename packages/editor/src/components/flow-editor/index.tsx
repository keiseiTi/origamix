import { getElementLabel } from '@origamix/shared';
import { Button } from '@origamix/ui';
import { Maximize, Minus, Plus, Undo2, Redo2 } from 'lucide-react';
import '@logicflow/core/lib/style/index.css';
import '@logicflow/extension/lib/style/index.css';
import './flow-editor.css';
import { nodeKinds, type EventTarget } from './flow-graph';
import { EventTree } from './event-tree';
import { defaultNodeProps, getNodeDefinition } from './nodes/node-catalog';
import { NodeProperties } from './nodes/node-properties';
import { useFlowCanvas } from './hooks/use-flow-canvas';
interface FlowEditorProps {
  target: EventTarget | null;
  onTargetChange: (target: EventTarget) => void;
}
export const FlowEditor = ({ target, onTargetChange }: FlowEditorProps): React.JSX.Element => {
  const {
    schema,
    materials,
    history,
    container,
    lfRef,
    selected,
    setSelected,
    update,
    addWithKeyboard,
  } = useFlowCanvas(target);

  return (
    <section
      className='flex min-h-0 flex-1 flex-col bg-white text-foreground dark:bg-zinc-950'
      aria-label='逻辑编辑器'
    >
      <div className='flex min-h-0 flex-1 overflow-x-auto'>
        <aside
          aria-label='流程节点面板'
          className='flex w-60 shrink-0 flex-col overflow-auto border-r border-border bg-white dark:bg-zinc-950'
        >
          <details open className='border-b border-border'>
            <summary className='cursor-pointer px-3 py-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring'>
              页面事件树
            </summary>
            <EventTree selected={target} onSelect={onTargetChange} />
          </details>
          <details open className='border-b border-border'>
            <summary className='cursor-pointer px-3 py-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring'>
              事件节点
            </summary>
            <div className='space-y-1 p-2 pt-0'>
              {nodeKinds.map((kind) => (
                <Button
                  key={kind.type}
                  variant='outline'
                  size='sm'
                  className='h-8 w-full cursor-grab justify-start text-xs font-normal active:cursor-grabbing'
                  title={`${kind.description}；拖入画布，或按 Enter 添加`}
                  disabled={!target}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    lfRef.current?.dnd.startDrag({
                      type: kind.type,
                      properties: defaultNodeProps(kind.type),
                    });
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    addWithKeyboard(kind.type);
                  }}
                >
                  {kind.title}
                </Button>
              ))}
            </div>
          </details>
        </aside>
        <div className='relative min-w-72 flex-1 bg-zinc-50 dark:bg-zinc-900'>
          {!target && (
            <div className='absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground'>
              从左侧页面事件树中选择事件，开始配置逻辑
            </div>
          )}
          <div ref={container} className='flow-canvas absolute inset-0' aria-label='事件流程画布' />
          {target && (
            <div className='absolute top-3 left-3 rounded-md border border-border bg-white/90 px-2.5 py-1.5 text-xs text-muted-foreground dark:bg-zinc-950/90'>
              {getElementLabel(
                target.elementId,
                schema.elements[target.elementId],
                String(
                  materials.find(
                    (material) => material.type === schema.elements[target.elementId]?.type,
                  )?.title ??
                    schema.elements[target.elementId]?.type ??
                    target.elementId,
                ),
              )}{' '}
              · {target.label}
            </div>
          )}
          {target && (
            <div className='absolute bottom-3 left-3 flex gap-1 rounded-lg border border-border bg-white p-1 shadow-sm dark:bg-zinc-950'>
              <Button
                size='icon-sm'
                variant='ghost'
                aria-label='撤销流程修改'
                disabled={!history.canUndo}
                onClick={() => {
                  history.undo();
                  setSelected(null);
                }}
              >
                <Undo2 size={16} />
              </Button>
              <Button
                size='icon-sm'
                variant='ghost'
                aria-label='重做流程修改'
                disabled={!history.canRedo}
                onClick={() => {
                  history.redo();
                  setSelected(null);
                }}
              >
                <Redo2 size={16} />
              </Button>
              <Button
                size='icon-sm'
                variant='ghost'
                aria-label='放大'
                onClick={() => lfRef.current?.zoom(true)}
              >
                <Plus size={16} />
              </Button>
              <Button
                size='icon-sm'
                variant='ghost'
                aria-label='缩小'
                onClick={() => lfRef.current?.zoom(false)}
              >
                <Minus size={16} />
              </Button>
              <Button
                size='icon-sm'
                variant='ghost'
                aria-label='适应画布'
                onClick={() => lfRef.current?.fitView(40, 40)}
              >
                <Maximize size={16} />
              </Button>
              <Button
                size='sm'
                variant='ghost'
                onClick={() => {
                  lfRef.current
                    ?.getSelectElements()
                    .edges.forEach((edge) => lfRef.current?.deleteEdge(edge.id));
                }}
              >
                删除选中连线
              </Button>
            </div>
          )}
        </div>
        <aside
          aria-label='流程节点配置'
          className='w-64 shrink-0 space-y-3 overflow-auto border-l border-border bg-white p-3 dark:bg-zinc-950'
        >
          <h3 className='border-b border-border pb-3 text-xs font-medium'>
            {selected
              ? String(
                  selected.properties?.title ||
                    getNodeDefinition(String(selected.type))?.title ||
                    '开始',
                )
              : '节点配置'}
          </h3>
          {!selected ? (
            <p className='text-xs text-muted-foreground'>请从左侧画布中选中节点</p>
          ) : (
            <NodeProperties
              key={selected.id}
              node={selected}
              onChange={update}
              eventLabel={target?.label}
            />
          )}
        </aside>
      </div>
    </section>
  );
};
