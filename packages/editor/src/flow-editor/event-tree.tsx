import { getElementLabel } from '@origamix/shared';
import { useFlowEditorSession } from './flow-editor-context';
import { ChevronDown, ChevronRight, Zap } from 'lucide-react';
import { useState } from 'react';
import type { EventTarget } from './flow-graph';

interface EventTreeNode {
  id: string;
  title: string;
  events: EventTarget[];
  children: EventTreeNode[];
}

const EventTreeItem = ({
  node,
  selected,
  onSelect,
}: {
  node: EventTreeNode;
  selected: EventTarget | null;
  onSelect: (target: EventTarget) => void;
}): React.JSX.Element => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0 || node.events.length > 0;
  return (
    <li>
      <button
        type='button'
        className='flex h-7 w-full items-center gap-1 rounded px-1 text-left text-xs text-zinc-700 outline-none hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-ring dark:text-zinc-300 dark:hover:bg-zinc-900'
        aria-expanded={hasChildren ? expanded : undefined}
        onClick={() => setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown size={13} />
          ) : (
            <ChevronRight size={13} />
          )
        ) : (
          <span className='w-3' />
        )}
        <span className='truncate'>{node.title}</span>
      </button>
      {expanded && hasChildren && (
        <ul className='ml-3 border-l border-border pl-1'>
          {node.events.map((event) => (
            <li key={event.event}>
              <button
                type='button'
                aria-pressed={
                  selected?.elementId === event.elementId && selected.event === event.event
                }
                className={`flex min-h-7 w-full items-center gap-1.5 rounded px-2 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected?.elementId === event.elementId && selected.event === event.event ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' : 'text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}
                onClick={() => onSelect(event)}
              >
                <Zap size={12} className='shrink-0' />
                <span className='truncate'>{event.label}</span>
              </button>
            </li>
          ))}
          {node.children.map((child) => (
            <EventTreeItem key={child.id} node={child} selected={selected} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
};

export const EventTree = ({
  selected,
  onSelect,
}: {
  selected: EventTarget | null;
  onSelect: (target: EventTarget) => void;
}): React.JSX.Element => {
  const { schema, materials } = useFlowEditorSession();
  const build = (id: string, ancestors: Set<string>): EventTreeNode | null => {
    const element = schema.elements[id];
    if (!element || ancestors.has(id)) return null;
    const material = materials.find((item) => item.type === element.type);
    const next = new Set(ancestors).add(id);
    return {
      id,
      title: getElementLabel(
        id,
        element,
        typeof material?.title === 'string' ? material.title : undefined,
      ),
      events: (material?.contextConfig?.methods ?? []).map((method) => ({
        elementId: id,
        event: method.name,
        label: method.description || method.name,
      })),
      children: (schema.layout.structure[id] ?? [])
        .map((child) => build(child, next))
        .filter((child): child is EventTreeNode => child !== null),
    };
  };
  const root = build(schema.layout.root, new Set());
  return root ? (
    <ul className='p-2' aria-label='页面事件树'>
      <EventTreeItem node={root} selected={selected} onSelect={onSelect} />
    </ul>
  ) : (
    <p className='p-3 text-xs text-muted-foreground'>暂无页面结构</p>
  );
};
