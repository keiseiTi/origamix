import { HtmlNode, HtmlNodeModel } from '@logicflow/core';
import { createRoot, type Root } from 'react-dom/client';
import { Play, Workflow } from 'lucide-react';
import { nodeKinds } from './model';

class EventNodeModel extends HtmlNodeModel {
  setAttributes(): void {
    this.width = 200;
    this.height = 76;
    this.text.editable = false;
    this.anchorsOffset =
      String(this.type) === 'start'
        ? [[100, 0]]
        : [
            [-100, 0],
            [100, 0],
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
        className={`flex h-[76px] w-[200px] items-center gap-3 rounded-xl border bg-card px-4 text-card-foreground shadow-sm ${model.isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}
      >
        <Icon size={20} className='shrink-0 text-primary' />
        <div className='min-w-0'>
          <div className='truncate text-sm font-medium'>{String(title)}</div>
          <div className='truncate text-xs text-muted-foreground'>
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
