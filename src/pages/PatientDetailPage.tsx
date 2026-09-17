import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EntryDetailModal } from '../components/EntryDetailModal'
import { supabase } from '../lib/supabase'
import {
  diabetesTypeLabel,
  formatBrazilDateTime,
  formatDose,
} from '../lib/format'
import type { Entry, Profile } from '../types/database'

type PrescriptionForm = {
  target_glucose_mgdl: string
  target_night_mgdl: string
  isf_mgdl_per_u: string
  ic_ratio: string
  rapid_insulin_name: string
}

type HistorySort = 'newest' | 'oldest'

const HISTORY_PAGE_SIZE = 50

function profileToForm(profile: Profile): PrescriptionForm {
  return {
    target_glucose_mgdl:
      profile.target_glucose_mgdl != null
        ? String(profile.target_glucose_mgdl)
        : '',
    target_night_mgdl:
      profile.target_night_mgdl != null
        ? String(profile.target_night_mgdl)
        : '',
    isf_mgdl_per_u:
      profile.isf_mgdl_per_u != null ? String(profile.isf_mgdl_per_u) : '',
    ic_ratio: profile.ic_ratio != null ? String(profile.ic_ratio) : '',
    rapid_insulin_name: profile.rapid_insulin_name?.trim() ?? '',
  }
}

function parsePositiveNumber(value: string, label: string): number {
  const n = Number(value.replace(',', '.').trim())
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${label} deve ser um número maior que zero.`)
  }
  return n
}

const inputClass =
  'mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20'

export function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState<PrescriptionForm | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [entriesTotal, setEntriesTotal] = useState(0)
  const [historyPage, setHistoryPage] = useState(0)
  const [historySort, setHistorySort] = useState<HistorySort>('newest')
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)

  const totalPages = Math.max(
    1,
    Math.ceil(entriesTotal / HISTORY_PAGE_SIZE) || 1,
  )

  const loadHistory = useCallback(
    async (page: number, sort: HistorySort) => {
      if (!patientId) return
      setHistoryLoading(true)
      const from = page * HISTORY_PAGE_SIZE
      const to = from + HISTORY_PAGE_SIZE - 1

      const { data, error: entriesError, count } = await supabase
        .from('entries')
        .select('*', { count: 'exact' })
        .eq('user_id', patientId)
        .order('recorded_at', { ascending: sort === 'oldest' })
        .range(from, to)

      if (entriesError) {
        setError(entriesError.message)
        setEntries([])
        setEntriesTotal(0)
      } else {
        setEntries((data ?? []) as Entry[])
        setEntriesTotal(count ?? 0)
      }
      setHistoryLoading(false)
    },
    [patientId],
  )

  useEffect(() => {
    if (!patientId) return
    let cancelled = false

    async function loadProfile() {
      setLoading(true)
      setError(null)
      setHistoryPage(0)

      const profileRes = await supabase
        .from('profiles')
        .select('*')
        .eq('id', patientId!)
        .maybeSingle()

      if (cancelled) return

      if (profileRes.error) {
        setError(profileRes.error.message)
        setProfile(null)
        setForm(null)
        setLoading(false)
        return
      }
      if (!profileRes.data) {
        setError('Paciente não encontrado ou sem vínculo.')
        setProfile(null)
        setForm(null)
        setLoading(false)
        return
      }

      const loaded = profileRes.data as Profile
      setProfile(loaded)
      setForm(profileToForm(loaded))
      setLoading(false)
    }

    void loadProfile()
    return () => {
      cancelled = true
    }
  }, [patientId])

  useEffect(() => {
    if (!patientId || !profile) return
    void loadHistory(historyPage, historySort)
  }, [patientId, profile, historyPage, historySort, loadHistory])

  async function onSavePrescription(e: FormEvent) {
    e.preventDefault()
    if (!profile || !form) return

    setSaveError(null)
    setSaveSuccess(null)

    let targetDay: number
    let targetNight: number
    let isf: number
    let ic: number
    try {
      targetDay = parsePositiveNumber(form.target_glucose_mgdl, 'Meta dia')
      targetNight = parsePositiveNumber(form.target_night_mgdl, 'Meta noite')
      isf = parsePositiveNumber(form.isf_mgdl_per_u, 'FSI')
      ic = parsePositiveNumber(form.ic_ratio, 'I:C')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Dados inválidos.')
      return
    }

    const insulinName = form.rapid_insulin_name.trim()
    if (!insulinName) {
      setSaveError('Informe o nome da insulina rápida.')
      return
    }

    setSaving(true)
    try {
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({
          target_glucose_mgdl: targetDay,
          target_night_mgdl: targetNight,
          isf_mgdl_per_u: isf,
          ic_ratio: ic,
          rapid_insulin_name: insulinName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)
        .select('*')
        .maybeSingle()

      if (updateError) throw updateError
      if (!data) throw new Error('Não foi possível salvar. Verifique o vínculo.')

      const updated = data as Profile
      setProfile(updated)
      setForm(profileToForm(updated))
      setSaveSuccess('Prescrição atualizada.')
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Não foi possível salvar.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Carregando histórico…</p>
  }

  if (error || !profile || !form) {
    return (
      <div className="space-y-4">
        <Link
          to="/"
          className="text-sm font-medium text-brand no-underline hover:underline"
        >
          ← Voltar
        </Link>
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error ?? 'Paciente não encontrado.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          to="/"
          className="text-sm font-medium text-brand no-underline hover:underline"
        >
          ← Pacientes
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">
          {profile.full_name?.trim() || 'Paciente sem nome'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Código{' '}
          <span className="font-mono font-semibold tracking-wider text-ink">
            {profile.share_code}
          </span>
          {' · '}
          {diabetesTypeLabel(profile.diabetes_type)}
        </p>
      </div>

      <form
        onSubmit={onSavePrescription}
        className="space-y-4 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6"
      >
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Prescrição
          </h2>
          <p className="mt-1 text-sm text-muted">
            Altere os parâmetros usados no cálculo de insulina do paciente.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Meta dia (mg/dL)
            </span>
            <input
              type="number"
              min={1}
              step="any"
              value={form.target_glucose_mgdl}
              onChange={(e) =>
                setForm((f) =>
                  f ? { ...f, target_glucose_mgdl: e.target.value } : f,
                )
              }
              className={inputClass}
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Meta noite (mg/dL)
            </span>
            <input
              type="number"
              min={1}
              step="any"
              value={form.target_night_mgdl}
              onChange={(e) =>
                setForm((f) =>
                  f ? { ...f, target_night_mgdl: e.target.value } : f,
                )
              }
              className={inputClass}
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              FSI (mg/dL/U)
            </span>
            <input
              type="number"
              min={1}
              step="any"
              value={form.isf_mgdl_per_u}
              onChange={(e) =>
                setForm((f) =>
                  f ? { ...f, isf_mgdl_per_u: e.target.value } : f,
                )
              }
              className={inputClass}
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              I:C (g por 1 U)
            </span>
            <input
              type="number"
              min={1}
              step="any"
              value={form.ic_ratio}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, ic_ratio: e.target.value } : f))
              }
              className={inputClass}
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Insulina rápida
            </span>
            <input
              type="text"
              value={form.rapid_insulin_name}
              onChange={(e) =>
                setForm((f) =>
                  f ? { ...f, rapid_insulin_name: e.target.value } : f,
                )
              }
              className={inputClass}
              required
            />
          </label>
        </div>

        {saveError && (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {saveError}
          </p>
        )}
        {saveSuccess && (
          <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand-dark">
            {saveSuccess}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          {saving ? 'Salvando…' : 'Salvar prescrição'}
        </button>
      </form>

      <section>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Histórico ({entriesTotal})
            {historyLoading ? ' · atualizando…' : ''}
          </h2>
          {entriesTotal > 0 && (
            <label className="flex items-center gap-2 text-sm text-muted">
              <span className="whitespace-nowrap">Ordenar</span>
              <select
                value={historySort}
                onChange={(e) => {
                  setHistorySort(e.target.value as HistorySort)
                  setHistoryPage(0)
                }}
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="newest">Mais recentes</option>
                <option value="oldest">Mais antigos</option>
              </select>
            </label>
          )}
        </div>

        {entriesTotal === 0 && !historyLoading ? (
          <div className="rounded-2xl border border-dashed border-line bg-card/60 px-5 py-10 text-center">
            <p className="text-sm text-muted">Nenhum registro ainda.</p>
          </div>
        ) : (
          <>
            <ul className="space-y-3 md:hidden">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedEntry(entry)}
                    className="w-full rounded-2xl border border-line bg-card p-4 text-left shadow-sm transition hover:border-brand/40 hover:bg-brand-soft/20"
                  >
                    <p className="text-xs font-medium text-muted">
                      {formatBrazilDateTime(entry.recorded_at)}
                    </p>
                    <p className="mt-1 text-lg font-bold text-ink">
                      {entry.glucose_mgdl}{' '}
                      <span className="text-sm font-medium text-muted">
                        mg/dL
                      </span>
                    </p>
                    {entry.food_text && (
                      <p className="mt-2 text-sm text-ink">{entry.food_text}</p>
                    )}
                    <div className="mt-3 flex gap-4 text-sm">
                      <span>
                        Rec:{' '}
                        <strong>
                          {formatDose(entry.recommended_insulin)} U
                        </strong>
                      </span>
                      <span>
                        Apl:{' '}
                        <strong>{formatDose(entry.applied_insulin)} U</strong>
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-hidden rounded-2xl border border-line bg-card shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-line bg-brand-soft/50 text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Data / hora</th>
                      <th className="px-4 py-3 font-semibold">Glicemia</th>
                      <th className="px-4 py-3 font-semibold">Comida</th>
                      <th className="px-4 py-3 font-semibold">Recomendada</th>
                      <th className="px-4 py-3 font-semibold">Aplicada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr
                        key={entry.id}
                        tabIndex={0}
                        role="button"
                        onClick={() => setSelectedEntry(entry)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedEntry(entry)
                          }
                        }}
                        className="cursor-pointer border-b border-line/70 last:border-0 hover:bg-brand-soft/30"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-muted">
                          {formatBrazilDateTime(entry.recorded_at)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-ink">
                          {entry.glucose_mgdl} mg/dL
                        </td>
                        <td className="max-w-xs truncate px-4 py-3 text-ink">
                          {entry.food_text?.trim() ||
                            (entry.food_image_path ? 'Foto anexada' : '—')}
                        </td>
                        <td className="px-4 py-3">
                          {formatDose(entry.recommended_insulin)} U
                        </td>
                        <td className="px-4 py-3">
                          {formatDose(entry.applied_insulin)} U
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {entriesTotal > HISTORY_PAGE_SIZE && (
              <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                <p className="text-sm text-muted">
                  Página {historyPage + 1} de {totalPages} · {HISTORY_PAGE_SIZE}{' '}
                  por página
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={historyPage <= 0 || historyLoading}
                    onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={
                      historyPage + 1 >= totalPages || historyLoading
                    }
                    onClick={() => setHistoryPage((p) => p + 1)}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  )
}
