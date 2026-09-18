import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  formatMetaLabel,
  formatU,
  parseEntryRecommendation,
} from '../lib/entryDetail'
import { formatBrazilDateTime, formatDose } from '../lib/format'
import type { Entry } from '../types/database'
import { Alert } from './ui/Alert'
import { Modal } from './ui/Modal'
import { Spinner } from './ui/Spinner'
import { StatTile } from './ui/StatTile'

type EntryDetailModalProps = {
  entry: Entry
  onClose: () => void
}

export function EntryDetailModal({ entry, onClose }: EntryDetailModalProps) {
  const rec = parseEntryRecommendation(entry)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoLoading, setPhotoLoading] = useState(Boolean(entry.food_image_path))

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
    <Modal title="Detalhe da dose" onClose={onClose} size="lg">
      <p className="-mt-1 text-sm text-muted">
        {formatBrazilDateTime(entry.recorded_at)}
      </p>

      <div className="mt-5 space-y-4">
        <div className="rounded-2xl bg-gradient-to-br from-brand-soft to-brand-softer px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
            Glicemia
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-ink">
            {entry.glucose_mgdl}{' '}
            <span className="text-base font-medium text-muted">mg/dL</span>
          </p>
          {metaLabel && (
            <p className="mt-1.5 text-sm text-muted">{metaLabel}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatTile
            density="compact"
            label="Recomendada"
            value={formatU(entry.recommended_insulin)}
          />
          <StatTile
            density="compact"
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
              <StatTile
                density="compact"
                label="Carbs"
                value={`${formatDose(rec.carboidratosG)} g`}
              />
            )}
            {rec.correcaoU != null && (
              <StatTile
                density="compact"
                label="Correção"
                value={formatU(rec.correcaoU)}
              />
            )}
            {rec.bolusComidaU != null && (
              <StatTile
                density="compact"
                label="Comida"
                value={formatU(rec.bolusComidaU)}
              />
            )}
            {rec.iobU != null && rec.iobU > 0 && (
              <StatTile
                density="compact"
                label="IOB"
                value={formatU(rec.iobU)}
              />
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
            {photoLoading && <Spinner label="Carregando foto…" />}
            {photoError && <Alert variant="error">{photoError}</Alert>}
            {photoUrl && (
              <img
                src={photoUrl}
                alt="Foto do alimento"
                className="max-h-80 w-full rounded-xl border border-line bg-surface object-contain"
              />
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
