import { Button, FieldError, Form, Input, Label, Modal, TextField, Tooltip } from '@heroui/react';
import { Info } from 'lucide-react';
import { useState } from 'react';
import type { PendingProjectInitialization } from '../../../hooks/use-project-actions';

interface OpenProjectModalProps {
  pendingInitialization: PendingProjectInitialization;
  initializing: boolean;
  onCancel: () => void;
  onInitialize: (input: { name: string; code: string; pageDirectory: string }) => Promise<void>;
}

const inputClassName =
  'focus:!ring-0 data-[focused=true]:!ring-0 data-[focus-visible=true]:!ring-0';

const suggestedProjectIdentity = (displayPath: string): { name: string; code: string } => {
  const directoryName = displayPath.split(/[\\/]/).filter(Boolean).at(-1) ?? '';
  const code =
    directoryName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'imported-project';
  return { name: directoryName, code };
};

export const OpenProjectModal = ({
  pendingInitialization,
  initializing,
  onCancel,
  onInitialize,
}: OpenProjectModalProps): React.JSX.Element => {
  const suggested = suggestedProjectIdentity(pendingInitialization.displayPath);
  const [name, setName] = useState(suggested.name);
  const [code, setCode] = useState(suggested.code);
  const [pageDirectory, setPageDirectory] = useState('pages');
  const [error, setError] = useState<string | null>(null);

  const initialize = async (): Promise<void> => {
    if (!name.trim() || !code.trim() || !pageDirectory.trim())
      return setError('请填写所有必填项。');
    setError(null);
    try {
      await onInitialize({
        name: name.trim(),
        code: code.trim(),
        pageDirectory: pageDirectory.trim(),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '初始化失败');
    }
  };

  return (
    <Modal isOpen onOpenChange={(open) => !open && onCancel()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Form
              onSubmit={(event) => {
                event.preventDefault();
                void initialize();
              }}
            >
              <Modal.Header>
                <Modal.Heading>初始化项目</Modal.Heading>
              </Modal.Header>
              <Modal.Body className='grid gap-4'>
                <p className='text-sm text-zinc-700 dark:text-zinc-300'>
                  选择的目录尚未初始化为 Origamix 项目。确认以下信息后将创建项目清单。
                </p>
                <p className='break-all text-xs text-zinc-400 dark:text-zinc-500'>
                  {pendingInitialization?.displayPath}
                </p>
                <TextField fullWidth isRequired>
                  <Label>项目名称</Label>
                  <Input
                    className={inputClassName}
                    name='projectName'
                    value={name}
                    placeholder='请输入'
                    onChange={(event) => setName(event.target.value)}
                    autoFocus
                    required
                  />
                  <FieldError>请输入项目名称</FieldError>
                </TextField>
                <TextField fullWidth isRequired>
                  <Label>项目标识</Label>
                  <Input
                    className={inputClassName}
                    name='projectCode'
                    value={code}
                    placeholder='请输入'
                    pattern='[a-z0-9]+(?:-[a-z0-9]+)*'
                    onChange={(event) => setCode(event.target.value)}
                    required
                  />
                  <FieldError>仅支持小写字母、数字和连字符</FieldError>
                </TextField>
                <TextField fullWidth isRequired>
                  <div className='flex items-center gap-1.5'>
                    <Label>页面目录路径</Label>
                    <Tooltip>
                      <Button
                        isIconOnly
                        size='sm'
                        variant='tertiary'
                        className='size-5 min-h-5 min-w-5 text-zinc-500 dark:text-zinc-400'
                        aria-label='页面目录路径说明'
                      >
                        <Info size={14} />
                      </Button>
                      <Tooltip.Content placement='top'>页面默认创建在 src 路径下</Tooltip.Content>
                    </Tooltip>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Input
                      className={inputClassName}
                      name='pageDirectory'
                      value={pageDirectory}
                      placeholder='pages'
                      pattern='[a-zA-Z0-9_-]+(?:/[a-zA-Z0-9_-]+)*'
                      onChange={(event) => setPageDirectory(event.target.value)}
                      required
                    />
                  </div>
                  <FieldError>请输入 src 下的页面目录，例如 pages 或 modules/pages</FieldError>
                </TextField>
                {error && <p className='text-sm text-danger'>{error}</p>}
              </Modal.Body>
              <Modal.Footer>
                <Button variant='tertiary' type='button' onPress={onCancel}>
                  取消
                </Button>
                <Button type='submit' isDisabled={initializing}>
                  {initializing ? '初始化中…' : '初始化并打开'}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
