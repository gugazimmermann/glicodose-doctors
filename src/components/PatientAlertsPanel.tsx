import { useEffect, useMemo, useState } from 'react'
import { Alert } from './ui/Alert'
import { Card } from './ui/Card'
import { Spinner } from './ui/Spinner'
import { fetchPatientEntries } from '../lib/entriesApi'
import {
  computeDeterministicAlerts,
  type ClinicalAlert,
} from '../lib/clinicalAlerts'
import type { Profile } from '../types/database'

const SEVERITY_CLASS: Record<ClinicalAlert['severity'], string> = {
  high: 'bg-danger-soft text-danger',
  medium: 'bg-warning-soft text-warning',
  low: 'bg-brand-soft text-brand-dark',
}

type PatientAlertsPanelProps = {
  patientId: string
  profile: Profile
}

export function PatientAlertsPanel({
  patientId,
  profile,
}: PatientAlertsPanelProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entries, setEntries] = useState<
    Awaited<ReturnType<typeof fetchPatientEntries>>['entries']
  >([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { entries: rows } = await fetchPatientEntries(patientId, {
          mode: 'series',
          period: 'days30',
        })
        if (!cancelled) setEntries(rows)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível carregar alertas.',
          )
          setEntries([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [patientId])

  const alerts = useMemo(
    () => computeDeterministicAlerts(entries, profile),
    [entries, profile],
  )

  return (
    <Card className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-ink">Alertas clínicos</h3>
        <p className="mt-1 text-sm text-muted">
          Regras locais (sem IA) sobre os últimos 30 dias.
        </p>
      </div>

      {loading && <Spinner label="Calculando alertas…" />}

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!loading && !error && alerts.length === 0 && (
        <p className="text-sm text-muted">Nenhum alerta no período.</p>
      )}

      {!loading && alerts.length > 0 && (
        <ul className="space-y-2">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className="rounded-xl border border-line bg-surface/60 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold ${SEVERITY_CLASS[alert.severity]}`}
                >
                  {alert.severity === 'high'
                    ? 'alta'
                    : alert.severity === 'medium'
                      ? 'média'
                      : 'baixa'}
                </span>
                <span className="text-sm font-semibold text-ink">
                  {alert.title}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink/90">{alert.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
