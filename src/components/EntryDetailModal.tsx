import { useEffect, useId, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  formatMetaLabel,
  formatU,
  parseEntryRecommendation,
} from '../lib/entryDetail'
import { formatBrazilDateTime, formatDose } from '../lib/format'
import type { Entry } from '../types/database'

type EntryDetailModalProps = {
  entry: Entry
  onClose: () => void
}

export function EntryDetailModal({ entry, onClose }: EntryDetailModalProps) {
  const titleId = useId()
  const rec = parseEntryRecommendation(entry)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoLoading, setPhotoLoading] = useState(Boolean(entry.food_image_path))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    const path = entry.food_image_path?.trim()
    if (!path) {
      setPhotoUrl(null)
      setPhotoError(null)
      setPhotoLoading(false)
      return
    }

    setPhotoLoading(true)
    setPhotoError(null)
    void supabase.storage
      .from('food-photos')
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data?.signedUrl) {
          setPhotoUrl(null)
          setPhotoError('Não foi possível carregar a foto.')
        } else {
          setPhotoUrl(data.signedUrl)
        }
        setPhotoLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [entry.food_image_path])

  const metaLabel = formatMetaLabel(rec)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-5 shadow-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id={titleId}
              className="text-lg font-bold tracking-tight text-ink"
            >
              Detalhe da dose
            </h2>
            <p className="mt-1 text-sm text-muted">
              {formatBrazilDateTime(entry.recorded_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-2.5 py-1 text-sm font-medium text-muted transition hover:border-brand hover:text-brand"
            aria-label="Fechar"
          >
            Fechar
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-xl bg-brand-soft/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Glicemia
            </p>
            <p className="mt-1 text-2xl font-bold text-ink">
              {entry.glucose_mgdl}{' '}
              <span className="text-base font-medium text-muted">mg/dL</span>
            </p>
            {metaLabel && (
              <p className="mt-1 text-sm text-muted">{metaLabel}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Metric
              label="Recomendada"
              value={formatU(entry.recommended_insulin)}
            />
            <Metric
              label="Aplicada"
              value={formatU(entry.applied_insulin)}
            />
          </div>

          {(rec.carboidratosG != null ||
            rec.correcaoU != null ||
            rec.bolusComidaU != null ||
            rec.iobU != null) && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {rec.carboidratosG != null && (
                <Metric
                  label="Carbs"
                  value={`${formatDose(rec.carboidratosG)} g`}
                />
              )}
              {rec.correcaoU != null && (
                <Metric label="Correção" value={formatU(rec.correcaoU)} />
              )}
              {rec.bolusComidaU != null && (
                <Metric label="Comida" value={formatU(rec.bolusComidaU)} />
              )}
              {rec.iobU != null && rec.iobU > 0 && (
                <Metric label="IOB" value={formatU(rec.iobU)} />
              )}
            </div>
          )}

          {rec.observacao && (
            <p className="rounded-xl border border-line bg-surface/50 px-3 py-2 text-sm text-muted">
              {rec.observacao}
            </p>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Alimentação
            </p>
            <p className="mt-1 text-sm text-ink">
              {entry.food_text?.trim() || '—'}
            </p>
          </div>

          {entry.food_image_path && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Foto do alimento
              </p>
              {photoLoading && (
                <p className="text-sm text-muted">Carregando foto…</p>
              )}
              {photoError && (
                <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                  {photoError}
                </p>
              )}
              {photoUrl && (
                <img
                  src={photoUrl}
                  alt="Foto do alimento"
                  className="max-h-80 w-full rounded-xl border border-line object-contain bg-surface"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface/40 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-ink">{value}</p>
    </div>
  )
}
