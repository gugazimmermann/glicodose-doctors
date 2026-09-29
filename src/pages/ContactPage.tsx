import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  CONTACT_CATEGORIES,
  formatDoctorCrm,
  isContactCategory,
  sendDoctorContactMessage,
  type ContactCategory,
} from '../lib/contactApi'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Label, Select, controlClass } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'

const MESSAGE_MAX = 5000

function BusyDot() {
  return (
    <span
      className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-brand-soft border-t-brand"
      aria-hidden
    />
  )
}

export function ContactPage() {
  const { doctor, user } = useAuth()
  const [category, setCategory] = useState<ContactCategory | ''>('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  if (!doctor) return null

  const name = doctor.full_name
  const email = user?.email?.trim() ?? ''
  const crm = formatDoctorCrm(doctor)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isContactCategory(category) || !email) return
    setError(null)
    setBusy(true)
    try {
      await sendDoctorContactMessage({
        name,
        email,
        category,
        message: message.trim(),
        crm,
      })
      setSent(true)
      setCategory('')
      setMessage('')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível enviar a mensagem. Tente novamente.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-w-0 max-w-2xl space-y-6">
      <PageHeader
        title="Contato"
        description="Reclamações, ideias, sugestões e dúvidas sobre o portal."
      />

      {sent ? (
        <Alert variant="success">
          Mensagem enviada. Obrigado pelo contato!
          <button
            type="button"
            className="ml-3 font-semibold underline-offset-2 hover:underline"
            onClick={() => setSent(false)}
          >
            Enviar outra
          </button>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <Card>
        <p className="text-sm leading-relaxed text-muted">
          A mensagem chega em{' '}
          <a
            href="mailto:contato@glicodose.app"
            className="font-medium text-brand hover:text-brand-dark"
          >
            contato@glicodose.app
          </a>
          . Respondemos no e-mail da sua conta.
        </p>

        <dl className="mt-5 grid gap-3 rounded-xl bg-brand-softer/50 px-4 py-3 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
              Nome
            </dt>
            <dd className="mt-0.5 break-words font-medium text-ink">{name}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
              E-mail
            </dt>
            <dd className="mt-0.5 break-all font-medium text-ink">
              {email || 'Sem e-mail na conta'}
            </dd>
          </div>
          {crm ? (
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                CRM
              </dt>
              <dd className="mt-0.5 font-medium text-ink">{crm}</dd>
            </div>
          ) : null}
        </dl>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="mt-6 space-y-5"
        >
          <div>
            <Label htmlFor="contact-category">Tipo</Label>
            <Select
              id="contact-category"
              name="category"
              required
              value={category}
              onChange={(e) => {
                const next = e.target.value
                setCategory(isContactCategory(next) ? next : '')
              }}
              disabled={busy}
            >
              <option value="">Selecione</option>
              {CONTACT_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="contact-message">Mensagem</Label>
            <textarea
              id="contact-message"
              name="message"
              required
              maxLength={MESSAGE_MAX}
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Conte o que aconteceu ou o que você gostaria de ver no portal."
              className={`${controlClass} resize-y`}
              disabled={busy}
            />
          </div>

          {!email ? (
            <p className="text-sm text-danger">
              A conta não tem e-mail. Entre de novo para enviar a mensagem.
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={busy || !category || !message.trim() || !email}
          >
            {busy ? <BusyDot /> : null}
            Enviar
          </Button>
        </form>
      </Card>
    </div>
  )
}
