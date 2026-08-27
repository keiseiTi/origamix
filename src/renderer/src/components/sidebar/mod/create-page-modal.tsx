import { Button, Input, Label, Modal, TextField } from '@heroui/react'
import { useState } from 'react'
import type { PageItem, ProjectItem } from '..'

interface CreatePageModalProps {
  project: ProjectItem | null
  onClose: () => void
  onCreated: (projectId: string, page: PageItem) => void
}

export function CreatePageModal({
  project,
  onClose,
  onCreated
}: CreatePageModalProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [fileName, setFileName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = (): void => {
    setName('')
    setFileName('')
    setError(null)
    onClose()
  }

  const createPage = async (): Promise<void> => {
    if (!project || !name.trim() || !fileName.trim()) {
      return setError('请填写页面名称和文件名称。')
    }
    setIsSubmitting(true)
    setError(null)
    try {
      if (project.path) {
        await window.api.page.create({
          projectPath: project.path,
          name: name.trim(),
          fileName: fileName.trim()
        })
      }
      const page = {
        id: `page_${crypto.randomUUID()}`,
        name: name.trim(),
        fileName: fileName.trim()
      }
      onCreated(project.id, page)
      close()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '页面创建失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={project !== null} onOpenChange={(open) => !open && close()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>新建页面</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="grid gap-4">
              <TextField fullWidth>
                <Label>页面名称</Label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例如：客户列表"
                  autoFocus
                />
              </TextField>
              <TextField fullWidth>
                <Label>文件名称</Label>
                <Input
                  value={fileName}
                  onChange={(event) => setFileName(event.target.value)}
                  placeholder="例如：customer-list"
                />
              </TextField>
              {error && <p className="text-sm text-danger">{error}</p>}
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                取消
              </Button>
              <Button isDisabled={isSubmitting} onPress={createPage}>
                {isSubmitting ? '创建中…' : '创建页面'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
