import { Button, Modal, Radio, RadioGroup } from '@heroui/react'
import type { AppTheme } from '..'

interface SettingsModalProps {
  isOpen: boolean
  theme: AppTheme
  onThemeChange: (theme: AppTheme) => void
  onClose: () => void
}

export function SettingsModal({
  isOpen,
  theme,
  onThemeChange,
  onClose
}: SettingsModalProps): React.JSX.Element {
  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>设置</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="mb-2 text-sm font-medium">外观主题</p>
              <RadioGroup
                aria-label="外观主题"
                value={theme}
                onChange={(value) => onThemeChange(value as AppTheme)}
                orientation="horizontal"
                className="flex items-center gap-6"
              >
                <Radio value="light">
                  <Radio.Content className="flex cursor-pointer items-center gap-2 text-sm">
                    <Radio.Control>
                      <Radio.Indicator />
                    </Radio.Control>
                    Light
                  </Radio.Content>
                </Radio>
                <Radio value="dark">
                  <Radio.Content className="flex cursor-pointer items-center gap-2 text-sm">
                    <Radio.Control>
                      <Radio.Indicator />
                    </Radio.Control>
                    Dark
                  </Radio.Content>
                </Radio>
              </RadioGroup>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close">完成</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
