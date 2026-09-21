import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { SchemaUtils } from '@tangramino/engine';
import { useEditorCore, type ActiveElement } from '@tangramino/base-editor';
import { useMemo, useState } from 'react';
import { MaterialPanel, type MaterialGroup } from './material-panel';

interface OutlineNode {
  activeElement: ActiveElement;
  children: OutlineNode[];
  title: string;
}

const OutlineItem = ({
  node,
  selectedId,
  onSelect,
}: {
  node: OutlineNode;
  selectedId?: string;
  onSelect: (element: ActiveElement) => void;
}): React.JSX.Element => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <div
        className={`flex h-7 items-center rounded px-1 text-xs ${selectedId === node.activeElement.id ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900'}`}
      >
        <button
          type='button'
          className='grid size-5 shrink-0 place-items-center rounded outline-none focus-visible:ring-2 focus-visible:ring-ring'
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? `收起 ${node.title}` : `展开 ${node.title}`}
          disabled={!hasChildren}
        >
          {hasChildren && (expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
        </button>
        <button
          type='button'
          className='min-w-0 flex-1 truncate text-left outline-none'
          title={node.title}
          onClick={() => onSelect(node.activeElement)}
        >
          {node.title}
        </button>
      </div>
      {hasChildren && expanded && (
        <ul className='ml-3 border-l border-zinc-200 pl-1 dark:border-zinc-800'>
          {node.children.map((child) => (
            <OutlineItem
              key={child.activeElement.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export const LeftPanel = ({ groups }: { groups: MaterialGroup[] }): React.JSX.Element => {
  const { schema, materials, activeElement, setActiveElement } = useEditorCore();
  const [hidden, setHidden] = useState(false);
  const [activeTab, setActiveTab] = useState<'materials' | 'outline'>('materials');

  const outline = useMemo<OutlineNode[]>(() => {
    const buildNode = (id: string): OutlineNode | null => {
      const element = schema.elements[id];
      const material = element ? materials.find((item) => item.type === element.type) : undefined;
      if (!element || !material) return null;
      const parents = SchemaUtils.getParents(schema, id)
        .map((parentId) => {
          const parent = schema.elements[parentId];
          const parentMaterial = parent
            ? materials.find((item) => item.type === parent.type)
            : undefined;
          return parent && parentMaterial
            ? ({
                id: parentId,
                type: parent.type,
                props: parent.props ?? {},
                material: parentMaterial,
              } as ActiveElement)
            : null;
        })
        .filter((item): item is ActiveElement => item !== null);
      const alias = typeof element.props?.alias === 'string' ? element.props.alias : '';
      return {
        activeElement: {
          id,
          type: element.type,
          props: element.props ?? {},
          material,
          parents,
        },
        title: alias ? `${alias}（${material.title}）` : String(material.title),
        children: (schema.layout.structure[id] ?? [])
          .map(buildNode)
          .filter((item): item is OutlineNode => item !== null),
      };
    };
    const root = buildNode(schema.layout.root);
    return root ? [root] : [];
  }, [materials, schema]);

  if (hidden) {
    return (
      <Button
        size='icon-xs'
        variant='ghost'
        className='absolute top-1 left-1 z-10 bg-background shadow-sm'
        aria-label='展开左侧面板'
        onClick={() => setHidden(false)}
      >
        <PanelLeftOpen />
      </Button>
    );
  }

  return (
    <aside className='flex h-full w-60 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'>
      <div className='flex h-10 items-end justify-between border-b border-zinc-200 px-2 dark:border-zinc-800'>
        <div className='flex h-full items-end gap-1' role='tablist' aria-label='左侧面板'>
          {(
            [
              ['materials', '物料'],
              ['outline', '大纲树'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type='button'
              role='tab'
              aria-selected={activeTab === key}
              className={`h-full border-b-2 px-2 text-xs font-medium ${activeTab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <Button
          size='icon-xs'
          variant='ghost'
          className='mb-1.5'
          aria-label='收起左侧面板'
          onClick={() => setHidden(true)}
        >
          <PanelLeftClose />
        </Button>
      </div>
      <div className='min-h-0 flex-1'>
        {activeTab === 'materials' ? (
          <MaterialPanel groups={groups} />
        ) : outline.length ? (
          <ul className='p-2'>
            {outline.map((node) => (
              <OutlineItem
                key={node.activeElement.id}
                node={node}
                selectedId={activeElement?.id}
                onSelect={setActiveElement}
              />
            ))}
          </ul>
        ) : (
          <p className='p-4 text-center text-xs text-muted-foreground'>暂无页面结构</p>
        )}
      </div>
    </aside>
  );
};
