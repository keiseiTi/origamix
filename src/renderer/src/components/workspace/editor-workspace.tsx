import { FilePlus2, LayoutPanelLeft } from 'lucide-react'

export function EditorWorkspace({ fileName }: { fileName: string }): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-50 p-4 dark:bg-zinc-900">
      <div className="flex h-8 items-center justify-between px-2.5 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <FilePlus2 size={14} />
          {fileName}.schema.json
        </span>
        <span>已保存</span>
      </div>
      <div className="grid min-h-0 flex-1 place-items-center rounded-lg border border-zinc-200 bg-white [background-image:radial-gradient(#e2e2e2_1px,transparent_1px)] [background-size:16px_16px] dark:border-zinc-700 dark:bg-zinc-950 dark:[background-image:radial-gradient(#3f3f46_1px,transparent_1px)]">
        <div className="flex flex-col items-center gap-2 rounded-xl border border-zinc-200 bg-white p-7 text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          <LayoutPanelLeft size={24} />
          <strong className="text-zinc-900 dark:text-zinc-100">页面编辑画布</strong>
          <span>Schema Runtime 将在此处渲染。</span>
        </div>
      </div>
    </div>
  )
}
