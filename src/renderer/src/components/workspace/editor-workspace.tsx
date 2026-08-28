import { Button, Input, Spinner } from '@heroui/react'
import { FilePlus2, LayoutPanelLeft, RotateCcw, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { OrigamixPageSchema } from '../../../../shared/protocol/schema'
import { backendApi } from '../../services/backend-api'

interface EditorWorkspaceProps {
  projectId: string
  pageId: string
  fileName: string
}

export function EditorWorkspace({
  projectId,
  pageId,
  fileName
}: EditorWorkspaceProps): React.JSX.Element {
  const [schema, setSchema] = useState<OrigamixPageSchema | null>(null)
  const [revisionId, setRevisionId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    backendApi.schema
      .get(projectId, pageId)
      .then((result) => {
        if (!active) return
        setSchema(result.schema)
        setRevisionId(result.revisionId)
        setTitle(String(result.schema.elements.element_root?.props.title ?? ''))
      })
      .catch(
        (reason) => active && setError(reason instanceof Error ? reason.message : '无法读取 Schema')
      )
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [projectId, pageId])

  const saveTitle = async (): Promise<void> => {
    if (!revisionId) return
    setIsSaving(true)
    setError(null)
    try {
      const result = await backendApi.schema.updateProps(projectId, pageId, {
        baseRevisionId: revisionId,
        elementId: 'element_root',
        props: { title }
      })
      setSchema(result.schema)
      setRevisionId(result.revisionId)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  const undo = async (): Promise<void> => {
    setIsSaving(true)
    setError(null)
    try {
      const result = await backendApi.schema.undo(projectId, pageId)
      setSchema(result.schema)
      setRevisionId(result.revisionId)
      setTitle(String(result.schema.elements.element_root?.props.title ?? ''))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '撤销失败')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-50 p-4 dark:bg-zinc-900">
      <div className="flex h-8 items-center justify-between px-2.5 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <FilePlus2 size={14} />
          {fileName}.schema.json
        </span>
        <span>{revisionId ? '已保存' : '加载中'}</span>
      </div>
      <div className="grid min-h-0 flex-1 place-items-center rounded-lg border border-zinc-200 bg-white [background-image:radial-gradient(#e2e2e2_1px,transparent_1px)] [background-size:16px_16px] dark:border-zinc-700 dark:bg-zinc-950 dark:[background-image:radial-gradient(#3f3f46_1px,transparent_1px)]">
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : schema ? (
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-5 flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <LayoutPanelLeft size={20} />
              <strong className="text-zinc-900 dark:text-zinc-100">页面根容器</strong>
            </div>
            <label className="mb-2 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
              标题
            </label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="输入页面标题"
              aria-label="页面标题"
            />
            <div className="mt-4 flex justify-between gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onPress={undo}
                isDisabled={isSaving}
              >
                <RotateCcw size={14} />
                撤销
              </Button>
              <Button size="sm" className="gap-1.5" onPress={saveTitle} isDisabled={isSaving}>
                <Save size={14} />
                {isSaving ? '保存中…' : '保存变更'}
              </Button>
            </div>
            <p className="mt-4 mb-0 text-[11px] text-zinc-500 dark:text-zinc-400">
              每次保存均会创建 Revision，并以原子方式写入 schema.json。
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
