import { Button, Input, Label, Modal, TextField } from '@heroui/react'
import { useState } from 'react'
import type { ProjectItem } from '..'

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (project: ProjectItem) => void
}

export function CreateProjectModal({
  isOpen,
  onClose,
  onCreated
}: CreateProjectModalProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [directory, setDirectory] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = (): void => {
    setName('')
    setDirectory('')
    setError(null)
    onClose()
  }

  const chooseDirectory = async (): Promise<void> => {
    const selected = await window.api.project.chooseDirectory()
    if (selected) setDirectory(selected)
  }

  const createProject = async (): Promise<void> => {
    if (!name.trim() || !directory) return setError('请填写项目名称并选择生成地址。')
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await window.api.project.create({
        name: name.trim(),
        parentDirectory: directory
      })
      onCreated({
        id: `project_${crypto.randomUUID()}`,
        name: name.trim(),
        path: result.projectPath,
        pages: []
      })
      close()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '项目创建失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && close()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>新建项目</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="grid gap-4">
              <TextField fullWidth>
                <Label>项目名称</Label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例如：客户管理系统"
                  autoFocus
                />
              </TextField>
              <TextField fullWidth>
                <Label>生成地址</Label>
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    value={directory}
                    readOnly
                    placeholder="选择项目生成目录"
                  />
                  <Button variant="secondary" onPress={chooseDirectory}>
                    选择…
                  </Button>
                </div>
              </TextField>
              {error && <p className="text-sm text-danger">{error}</p>}
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                取消
              </Button>
              <Button onPress={createProject} isDisabled={isSubmitting}>
                {isSubmitting ? '创建中…' : '创建项目'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
