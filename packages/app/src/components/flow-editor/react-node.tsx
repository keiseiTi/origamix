import { HtmlNode, HtmlNodeModel } from '@logicflow/core';
import { createRoot, type Root } from 'react-dom/client';
import { Play, Workflow } from 'lucide-react';
import { getNodeDefinition } from './nodes/definitions';

class EventNodeModel extends HtmlNodeModel {
  setAttributes(): void {
    this.width = 148;
    this.height = 48;
    this.text.editable = false;
    this.sourceRules = [
      {
        message: '请从输出锚点连接节点',
        validate: (_source, _target, anchor) =>
          String(this.type) !== 'condition' ||
          Boolean(anchor?.id?.endsWith('_true') || anchor?.id?.endsWith('_false')),
      },
    ];
    this.targetRules = [
      {
        message: '开始节点不能接收连线，条件节点请连接左侧输入锚点',
        validate: (_source, _target, _sourceAnchor, anchor) =>
          String(this.type) !== 'start' &&
          (String(this.type) !== 'condition' || anchor?.id === `${this.id}_in`),
      },
    ];
    this.anchorsOffset =
      String(this.type) === 'condition'
        ? []
        : String(this.type) === 'start'
          ? [[74, 0]]
          : [
              [-74, 0],
              [74, 0],
            ];
  }
  getDefaultAnchor() {
    if (String(this.type) !== 'condition') return super.getDefaultAnchor();
    return [
      { x: this.x - 74, y: this.y, id: `${this.id}_in` },
      { x: this.x + 74, y: this.y - 12, id: `${this.id}_true` },
      { x: this.x + 74, y: this.y + 12, id: `${this.id}_false` },
    ];
  }
}

export const createReactNode = (resolveElementLabel: (id: string) => string) => {
  class EventNode extends HtmlNode {
    reactRoot?: Root;
    mountElement?: HTMLDivElement;

    shouldUpdate(): boolean {
      return true;
    }

    setHtml(element: SVGForeignObjectElement): void {
      if (!this.reactRoot) {
        this.mountElement = document.createElement('div');
        element.appendChild(this.mountElement);
        this.reactRoot = createRoot(this.mountElement);
      }
      const { model } = this.props;
      const title =
        model.properties.title ||
        model.properties.alias ||
        getNodeDefinition(String(model.type))?.title ||
        String(model.type);
      const properties = model.properties;
      const targetIds = [
        properties.elementId,
        ...(Array.isArray(properties.elementIds) ? properties.elementIds : []),
        ...(Array.isArray(properties.setters)
          ? properties.setters.map((setter: { elementId?: unknown }) => setter.elementId)
          : []),
      ].filter((id): id is string => typeof id === 'string' && id.length > 0);
      const targetLabel = [...new Set(targetIds)].map(resolveElementLabel).join('、');
      const Icon = String(model.type) === 'start' ? Play : Workflow;
      this.reactRoot.render(
        <div
          className={`flex h-[48px] w-[148px] items-center gap-2 rounded-md border bg-white px-2.5 dark:bg-zinc-950 text-card-foreground shadow-sm ${model.isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}
        >
          <Icon size={14} className='shrink-0 text-primary' />
          <div className='min-w-0'>
            <div className='truncate text-xs font-medium'>{String(title)}</div>
            <div className='truncate text-[10px] text-muted-foreground'>
              {String(model.type) === 'start'
                ? '事件触发'
                : String(
                    String(model.type) === 'customJS'
                      ? '仅配置 · 暂不执行'
                      : targetLabel || model.properties.name || '点击配置节点',
                  )}
            </div>
          </div>
          {String(model.type) === 'condition' && (
            <div className='ml-auto flex flex-col gap-1 text-[9px] text-muted-foreground'>
              <span>真</span>
              <span>假</span>
            </div>
          )}
        </div>,
      );
    }

    componentWillUnmount(): void {
      const root = this.reactRoot;
      this.reactRoot = undefined;
      // Keep React's tree intact while LogicFlow clears its foreignObject.
      this.mountElement?.remove();
      queueMicrotask(() => root?.unmount());
      super.componentWillUnmount();
    }
  }

  return { view: EventNode, model: EventNodeModel };
};
