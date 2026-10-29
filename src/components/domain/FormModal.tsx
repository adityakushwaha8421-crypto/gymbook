import { useState, type ReactNode } from 'react'
import { Modal, type ModalProps } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

/**
 * Modal wrapper for forms: closing with unsaved edits asks for confirmation,
 * and closing is blocked while a save is in flight.
 */
export function FormModal({ dirty, saving, onClose, children, footer, ...rest }: Omit<ModalProps, 'onClose' | 'footer'> & { dirty: boolean; saving?: boolean; onClose: () => void; children: ReactNode; footer?: ReactNode | ((requestClose: () => void) => ReactNode) }) {
  const [confirm, setConfirm] = useState(false)
  const requestClose = () => {
    if (saving) return
    if (dirty) setConfirm(true)
    else onClose()
  }
  return (
    <>
      <Modal {...rest} onClose={requestClose} footer={typeof footer === 'function' ? footer(requestClose) : footer}>
        {children}
      </Modal>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Discard unsaved changes?"
        description="Your edits in this form haven’t been saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        danger
        onConfirm={() => {
          setConfirm(false)
          onClose()
        }}
      />
    </>
  )
}
