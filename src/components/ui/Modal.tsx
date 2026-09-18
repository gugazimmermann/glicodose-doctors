import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type MouseEvent,
} from 'react'
import { Card } from './Card'
import { Button } from './Button'

type ModalProps = {
  title: string
  onClose: () => void
  children: ReactNode
  /** Wider panel for detail views; default is compact confirm size. */
  size?: 'sm' | 'lg'
  /** When false, omit the header close button (confirm dialogs). Default: size === 'lg'. */
  showCloseButton?: boolean
}

export function Modal({
  title,
  onClose,
  children,
  size = 'sm',
  showCloseButton = size === 'lg',
}: ModalProps) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null
    if (closeRef.current) {
      closeRef.current.focus()
    } else {
      const first = dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      first?.focus()
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previousFocus.current?.focus()
    }
  }, [onClose])

  function stopPropagation(e: MouseEvent) {
    e.stopPropagation()
  }

  const overlayPad = size === 'lg' ? 'p-0 sm:p-4' : 'p-4'

  const header = (
    <div className="flex items-start justify-between gap-3">
      <h2
        id={titleId}
        className="text-lg font-bold tracking-tight text-ink"
      >
        {title}
      </h2>
      {showCloseButton ? (
        <Button
          ref={closeRef}
          variant="secondary"
          size="sm"
          onClick={onClose}
          aria-label="Fechar"
        >
          Fechar
        </Button>
      ) : null}
    </div>
  )

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center ${overlayPad}`}
      role="presentation"
      onClick={onClose}
    >
      {size === 'lg' ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-card p-5 shadow-xl sm:rounded-2xl sm:p-6"
          onClick={stopPropagation}
        >
          <div
            className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden"
            aria-hidden
          />
          {header}
          {children}
        </div>
      ) : (
        <Card
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="w-full max-w-sm"
          onClick={stopPropagation}
        >
          {header}
          {children}
        </Card>
      )}
    </div>
  )
}

type ConfirmDialogProps = {
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  confirming?: boolean
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  confirming = false,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel} size="sm" showCloseButton={false}>
      <p className="mt-2 text-sm text-muted">{description}</p>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={confirming}>
          {cancelLabel}
        </Button>
        <Button
          className="border-danger bg-danger text-white hover:bg-danger hover:brightness-95"
          onClick={onConfirm}
          disabled={confirming}
        >
          {confirming ? '…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
