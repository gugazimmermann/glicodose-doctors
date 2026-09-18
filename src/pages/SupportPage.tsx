import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { createCheckoutSession, createPortalSession } from '../lib/supportApi'
import {
  SUPPORT_PLAN_KEYS,
  SUPPORT_PLAN_LABELS,
  displayPlanLabel,
  displayPriceLabel,
  type SupportPlanKey,
} from '../lib/supportProducts'
import { isDoctorSupporter } from '../types/database'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'

function BusyDot() {
  return (
    <span
      className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-brand-soft border-t-brand"
      aria-hidden
    />
  )
}

/** Prefer VITE_APP_URL when set; otherwise the current origin. */
export function resolveAppBaseUrl(
  envUrl: string | undefined,
  fallbackOrigin: string,
): string {
  if (envUrl) return envUrl.replace(/\/$/, '')
  return fallbackOrigin
}

function appBaseUrl(): string {
  return resolveAppBaseUrl(
    import.meta.env.VITE_APP_URL as string | undefined,
    window.location.origin,
  )
}

export function SupportPage() {
  const { doctor, refreshDoctor } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [busyPlan, setBusyPlan] = useState<SupportPlanKey | null>(null)
  const [portalBusy, setPortalBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [banner, setBanner] = useState<'sucesso' | 'cancelado' | null>(null)

  const isSupporter = isDoctorSupporter(doctor)
  const activeProductId = doctor?.supporter_product_id ?? null

  useEffect(() => {
    const result = searchParams.get('apoiar')
    if (result !== 'sucesso' && result !== 'cancelado') return

    setBanner(result)
    const next = new URLSearchParams(searchParams)
    next.delete('apoiar')
    setSearchParams(next, { replace: true })

    if (result === 'sucesso') {
      void refreshDoctor()
    }
  }, [searchParams, setSearchParams, refreshDoctor])

  async function handleCheckout(plan: SupportPlanKey) {
    setError(null)
    setBusyPlan(plan)
    try {
      const base = appBaseUrl()
      const url = await createCheckoutSession({
        plan,
        successUrl: `${base}/apoiar?apoiar=sucesso`,
        cancelUrl: `${base}/apoiar?apoiar=cancelado`,
      })
      window.location.assign(url)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Não foi possível iniciar o checkout. Tente novamente.',
      )
      setBusyPlan(null)
    }
  }

  async function handlePortal() {
    setError(null)
    setPortalBusy(true)
    try {
      const url = await createPortalSession(`${appBaseUrl()}/apoiar`)
      window.location.assign(url)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Não foi possível abrir o gerenciamento da assinatura.',
      )
      setPortalBusy(false)
    }
  }

  if (!doctor) return null

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <PageHeader
        title="Apoiar o GlicoDose"
        description="O portal é gratuito. Se quiser, uma assinatura mensal opcional ajuda a manter infraestrutura e IA."
      />

      {banner === 'sucesso' ? (
        <Alert variant="success" onDismiss={() => setBanner(null)}>
          Obrigado por apoiar o GlicoDose!
        </Alert>
      ) : null}
      {banner === 'cancelado' ? (
        <Alert variant="info" onDismiss={() => setBanner(null)}>
          Checkout cancelado. Você pode apoiar quando quiser.
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      {isSupporter ? (
        <Card className="border-brand-soft bg-brand-softer/60">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-brand-dark">
                Você é apoiador
              </p>
              <p className="mt-1 text-sm text-muted">
                {activeProductId
                  ? `Plano: ${displayPlanLabel(activeProductId)}`
                  : 'Obrigado por manter o projeto.'}
              </p>
            </div>
            <Button
              variant="secondary"
              disabled={portalBusy}
              onClick={() => void handlePortal()}
            >
              {portalBusy ? <BusyDot /> : null}
              Gerenciar assinatura
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {SUPPORT_PLAN_KEYS.map((plan) => {
          const selected = activeProductId === plan
          const busy = busyPlan === plan
          return (
            <Card
              key={plan}
              className={
                selected
                  ? 'border-brand ring-2 ring-brand/30'
                  : 'hover:border-brand/50'
              }
            >
              <p className="text-lg font-semibold tracking-tight text-ink">
                {SUPPORT_PLAN_LABELS[plan]}
              </p>
              <p className="mt-1 text-2xl font-bold text-brand-dark">
                {displayPriceLabel(plan)}
              </p>
              <p className="mt-2 text-sm text-muted">
                Renovação automática. Cancele quando quiser no portal Stripe.
              </p>
              <Button
                className="mt-4 w-full"
                variant={selected ? 'secondary' : 'primary'}
                disabled={busy || selected || busyPlan !== null}
                onClick={() => void handleCheckout(plan)}
              >
                {busy ? <BusyDot /> : null}
                {selected ? 'Plano ativo' : 'Assinar'}
              </Button>
            </Card>
          )
        })}
      </div>

      <p className="text-center text-sm text-muted">
        Prefere ajustar o perfil?{' '}
        <Link to="/perfil" className="font-medium text-brand hover:text-brand-dark">
          Ir para Perfil
        </Link>
      </p>
    </div>
  )
}
