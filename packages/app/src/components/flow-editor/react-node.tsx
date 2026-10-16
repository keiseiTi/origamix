import { HtmlNode, HtmlNodeModel } from '@logicflow/core';
import { createRoot, type Root } from 'react-dom/client';
import { Play, Workflow } from 'lucide-react';
import { nodeKinds } from './model';

class EventNodeModel extends HtmlNodeModel {
  setAttributes(): void {
    this.width = 148;
    this.height = 48;
    this.text.editable = false;
    this.anchorsOffset =
      String(this.type) === 'start'
        ? [[74, 0]]
        : [
            [-74, 0],
            [74, 0],
          ];
  }
}

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
      nodeKinds.find((kind) => kind.type === String(model.type))?.title ||
      '开始';
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
              : String(model.properties.elementId || model.properties.name || '点击配置节点')}
          </div>
        </div>
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

export const reactNode = { view: EventNode, model: EventNodeModel };
