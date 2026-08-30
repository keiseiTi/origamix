import { Button, TextArea } from '@heroui/react';
import { LayoutPanelLeft, Send, Sparkles } from 'lucide-react';

export function ChatWorkspace({ pageName }: { pageName: string }): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center">
      <div className="w-[min(780px,calc(100%-64px))] flex-1 py-16 pb-7">
        <div className="flex gap-3 leading-relaxed">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <Sparkles size={14} />
          </span>
          <div>
            <strong className="text-sm">准备好修改“{pageName}”</strong>
            <p className="mt-1 max-w-155 text-zinc-600 dark:text-zinc-300">
              告诉我你希望这个页面包含什么。我会先生成候选 Schema，通过校验后再更新页面。
            </p>
          </div>
        </div>
      </div>
      <div className="w-[min(780px,calc(100%-64px))] rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-[0_8px_24px_rgb(0_0_0/0.1)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_8px_24px_rgb(0_0_0/0.35)]">
        <TextArea
          variant="secondary"
          className="block min-h-16 w-full resize-none border-0 bg-transparent px-2 py-1.5 shadow-none outline-none"
          aria-label="发送消息"
          placeholder="描述你想创建或修改的页面"
        />
        <footer className="flex items-center justify-between">
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-xs text-zinc-500 dark:text-zinc-400"
          >
            <LayoutPanelLeft size={14} />
            页面上下文
          </Button>
          <Button isIconOnly size="sm" className="h-7 min-h-7 w-7 min-w-7" aria-label="发送">
            <Send size={15} />
          </Button>
        </footer>
      </div>
      <p className="mt-2 mb-2.5 text-[10px] text-zinc-400 dark:text-zinc-500">
        AI 可能会出错，请检查生成结果。
      </p>
    </div>
  );
}
