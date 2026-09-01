import { Modal } from '@heroui/react';
import type { ReactNode } from 'react';

export function WorkspaceDrawer({
  open,
  onClose,
  title,
  side,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  side: 'left' | 'right';
  children: ReactNode;
}): React.JSX.Element {
  return (
    <Modal isOpen={open} onOpenChange={(value) => !value && onClose()}>
      <Modal.Backdrop>
        <Modal.Container
          className={`w-full flex-row items-stretch p-0 sm:w-full sm:p-0 ${side === 'left' ? 'justify-start' : 'justify-end'}`}
        >
          <Modal.Dialog
            aria-label={title}
            className={`m-0 flex h-dvh max-h-dvh flex-col rounded-none p-0 ${side === 'left' ? 'w-64' : 'w-[min(480px,100vw)]'}`}
          >
            {side === 'right' && (
              <Modal.Header>
                <Modal.Heading>{title}</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
            )}
            {children}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
