import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EntryDetailModal } from '../components/EntryDetailModal'
import { PatientCharts } from '../components/PatientCharts'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input, Label, Select } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Spinner } from '../components/ui/Spinner'
import { useAutoClear } from '../hooks/useAutoClear'
import { fetchPatientEntries } from '../lib/entriesApi'
import { supabase } from '../lib/supabase'
import {
  diabetesTypeLabel,
  formatBrazilDateTime,
  formatDose,
} from '../lib/format'
import {
  glucoseToneClass,
  resolveTargetMgdl,
} from '../lib/historyStats'
import type { Entry, Profile } from '../types/database'

type PrescriptionForm = {
  target_glucose_mgdl: string
  target_night_mgdl: string
  isf_mgdl_per_u: string
  ic_ratio: string
  rapid_insulin_name: string
}

type HistorySort = 'newest' | 'oldest'
type DetailTab = 'prescription' | 'history' | 'charts'

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

export function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const baseId = useId()
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
  const [detailTab, setDetailTab] = useState<DetailTab>('history')

  const totalPages = Math.max(
    1,
    Math.ceil(entriesTotal / HISTORY_PAGE_SIZE) || 1,
  )

  const loadHistory = useCallback(
    async (page: number, sort: HistorySort) => {
      setHistoryLoading(true)
      try {
        const { entries: rows, total } = await fetchPatientEntries(patientId!, {
          mode: 'page',
          page,
          pageSize: HISTORY_PAGE_SIZE,
          sort,
        })
        setEntries(rows)
        setEntriesTotal(total ?? 0)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar histórico.')
        setEntries([])
        setEntriesTotal(0)
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

  const clearSaveSuccess = () => setSaveSuccess(null)
  useAutoClear(saveSuccess, clearSaveSuccess, 5000)

  async function onSavePrescription(e: FormEvent) {
    e.preventDefault()
    const currentProfile = profile!
    const currentForm = form!

    setSaveError(null)
    setSaveSuccess(null)

    let targetDay: number
    let targetNight: number
    let isf: number
    let ic: number
    try {
      targetDay = parsePositiveNumber(currentForm.target_glucose_mgdl, 'Meta dia')
      targetNight = parsePositiveNumber(currentForm.target_night_mgdl, 'Meta noite')
      isf = parsePositiveNumber(currentForm.isf_mgdl_per_u, 'FSI')
      ic = parsePositiveNumber(currentForm.ic_ratio, 'I:C')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Dados inválidos.')
      return
    }

    const insulinName = currentForm.rapid_insulin_name.trim()
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
        .eq('id', currentProfile.id)
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
    return <Spinner label="Carregando paciente…" />
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
        <Alert variant="error">{error ?? 'Paciente não encontrado.'}</Alert>
      </div>
    )
  }

  const tabs = [
    { id: 'prescription' as const, label: 'Prescrição', panelId: `${baseId}-prescription` },
    {
      id: 'history' as const,
      label: `Histórico (${entriesTotal})`,
      panelId: `${baseId}-history`,
    },
    { id: 'charts' as const, label: 'Gráficos', panelId: `${baseId}-charts` },
  ]

  return (
    <div className="min-w-0 max-w-full space-y-6 sm:space-y-8">
      <PageHeader
        title={profile.full_name?.trim() || 'Paciente sem nome'}
        description={`${diabetesTypeLabel(profile.diabetes_type)} · código ${profile.share_code}`}
      >
        <Link
          to="/"
          className="mb-2 inline-block text-sm font-medium text-brand no-underline hover:underline"
        >
          ← Pacientes
        </Link>
      </PageHeader>

      <div className="min-w-0">
        <SegmentedControl
          variant="underline"
          ariaLabel="Paciente"
          value={detailTab}
          onChange={setDetailTab}
          items={tabs.map((tab) => ({ value: tab.id, label: tab.label }))}
          getTabId={(id) => `${baseId}-tab-${id}`}
          getPanelId={(id) => tabs.find((t) => t.id === id)?.panelId ?? `${baseId}-${id}`}
        />

        {detailTab === 'prescription' ? (
          <form
            id={`${baseId}-prescription`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-prescription`}
            onSubmit={onSavePrescription}
            className="mt-4"
          >
            <Card className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-ink">Prescrição</h2>
                <p className="mt-1 text-sm text-muted">
                  Parâmetros usados no cálculo de insulina do paciente.
                </p>
              </div>

              <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="min-w-0">
                  <Label
                    htmlFor={`${baseId}-target-day`}
                    density="stacked"
                    subtitle="mg/dL"
                  >
                    Meta dia
                  </Label>
                  <Input
                    id={`${baseId}-target-day`}
                    type="number"
                    min={1}
                    step="any"
                    value={form.target_glucose_mgdl}
                    onChange={(e) =>
                      setForm((f) =>
                        f ? { ...f, target_glucose_mgdl: e.target.value } : f,
                      )
                    }
                    className="mt-1.5 font-semibold"
                    required
                  />
                </div>
                <div className="min-w-0">
                  <Label
                    htmlFor={`${baseId}-target-night`}
                    density="stacked"
                    subtitle="mg/dL"
                  >
                    Meta noite
                  </Label>
                  <Input
                    id={`${baseId}-target-night`}
                    type="number"
                    min={1}
                    step="any"
                    value={form.target_night_mgdl}
                    onChange={(e) =>
                      setForm((f) =>
                        f ? { ...f, target_night_mgdl: e.target.value } : f,
                      )
                    }
                    className="mt-1.5 font-semibold"
                    required
                  />
                </div>
                <div className="min-w-0">
                  <Label
                    htmlFor={`${baseId}-isf`}
                    density="stacked"
                    subtitle="mg/dL por 1 U"
                  >
                    FSI
                  </Label>
                  <Input
                    id={`${baseId}-isf`}
                    type="number"
                    min={1}
                    step="any"
                    value={form.isf_mgdl_per_u}
                    onChange={(e) =>
                      setForm((f) =>
                        f ? { ...f, isf_mgdl_per_u: e.target.value } : f,
                      )
                    }
                    className="mt-1.5 font-semibold"
                    required
                  />
                </div>
                <div className="min-w-0">
                  <Label
                    htmlFor={`${baseId}-ic`}
                    density="stacked"
                    subtitle="g de carb por 1 U"
                  >
                    I:C
                  </Label>
                  <Input
                    id={`${baseId}-ic`}
                    type="number"
                    min={1}
                    step="any"
                    value={form.ic_ratio}
                    onChange={(e) =>
                      setForm((f) =>
                        f ? { ...f, ic_ratio: e.target.value } : f,
                      )
                    }
                    className="mt-1.5 font-semibold"
                    required
                  />
                </div>
                <div className="min-w-0 sm:col-span-2 lg:col-span-2">
                  <Label
                    htmlFor={`${baseId}-insulin`}
                    density="stacked"
                    subtitle="Nome comercial"
                  >
                    Insulina rápida
                  </Label>
                  <Input
                    id={`${baseId}-insulin`}
                    type="text"
                    value={form.rapid_insulin_name}
                    onChange={(e) =>
                      setForm((f) =>
                        f ? { ...f, rapid_insulin_name: e.target.value } : f,
                      )
                    }
                    className="mt-1.5 font-semibold"
                    required
                  />
                </div>
              </div>

              {saveError && (
                <Alert variant="error" onDismiss={() => setSaveError(null)}>
                  {saveError}
                </Alert>
              )}
              {saveSuccess && (
                <Alert variant="success" onDismiss={clearSaveSuccess}>
                  {saveSuccess}
                </Alert>
              )}

              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar prescrição'}
              </Button>
            </Card>
          </form>
        ) : detailTab === 'history' ? (
          <section
            id={`${baseId}-history`}
            className="mt-4 space-y-4"
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-history`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="sr-only">Histórico</h2>
              {historyLoading ? (
                <Spinner label="Atualizando…" />
              ) : (
                <span className="text-sm text-muted">
                  {entriesTotal} registro{entriesTotal === 1 ? '' : 's'}
                </span>
              )}
              {entriesTotal > 0 && (
                <label className="flex items-center gap-2 text-sm text-muted">
                  <span className="whitespace-nowrap">Ordenar</span>
                  <Select
                    value={historySort}
                    onChange={(e) => {
                      setHistorySort(e.target.value as HistorySort)
                      setHistoryPage(0)
                    }}
                    className="w-auto py-2"
                  >
                    <option value="newest">Mais recentes</option>
                    <option value="oldest">Mais antigos</option>
                  </Select>
                </label>
              )}
            </div>

            {entriesTotal === 0 && !historyLoading ? (
              <EmptyState muted title="Nenhum registro ainda." />
            ) : (
              <>
                <ul className="space-y-3 lg:hidden">
                  {entries.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedEntry(entry)}
                        className="w-full rounded-2xl border border-line bg-card p-4 text-left shadow-sm transition hover:border-brand/40 hover:bg-brand-softer/40"
                      >
                        <p className="text-xs font-medium text-muted">
                          {formatBrazilDateTime(entry.recorded_at)}
                        </p>
                        <p
                          className={`mt-1 text-lg font-bold ${glucoseToneClass(entry.glucose_mgdl, resolveTargetMgdl(profile, entry.recorded_at))}`}
                        >
                          {entry.glucose_mgdl}{' '}
                          <span className="text-sm font-medium text-muted">
                            mg/dL
                          </span>
                        </p>
                        {entry.food_text && (
                          <p className="mt-2 line-clamp-2 text-sm text-ink">
                            {entry.food_text}
                          </p>
                        )}
                        <div className="mt-3 flex gap-4 text-sm text-muted">
                          <span>
                            Rec:{' '}
                            <strong className="text-ink">
                              {formatDose(entry.recommended_insulin)} U
                            </strong>
                          </span>
                          <span>
                            Apl:{' '}
                            <strong className="text-ink">
                              {formatDose(entry.applied_insulin)} U
                            </strong>
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>

                <Card padded={false} className="hidden overflow-hidden lg:block">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[36rem] text-left text-sm">
                      <thead className="border-b border-line bg-brand-softer/80 text-xs uppercase tracking-wide text-muted">
                        <tr>
                          <th className="px-4 py-3 font-semibold">
                            Data / hora
                          </th>
                          <th className="px-4 py-3 font-semibold">Glicemia</th>
                          <th className="px-4 py-3 font-semibold">Comida</th>
                          <th className="px-4 py-3 font-semibold">
                            Recomendada
                          </th>
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
                            className="cursor-pointer border-b border-line/70 last:border-0 hover:bg-brand-softer/50"
                          >
                            <td className="whitespace-nowrap px-4 py-3 text-muted">
                              {formatBrazilDateTime(entry.recorded_at)}
                            </td>
                            <td
                              className={`px-4 py-3 font-semibold ${glucoseToneClass(entry.glucose_mgdl, resolveTargetMgdl(profile, entry.recorded_at))}`}
                            >
                              {entry.glucose_mgdl} mg/dL
                            </td>
                            <td className="max-w-xs truncate px-4 py-3 text-ink">
                              {entry.food_text?.trim() ||
                                (entry.food_image_path
                                  ? 'Foto anexada'
                                  : '—')}
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
                </Card>

                {entriesTotal > HISTORY_PAGE_SIZE && (
                  <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                    <p className="text-sm text-muted">
                      Página {historyPage + 1} de {totalPages} ·{' '}
                      {HISTORY_PAGE_SIZE} por página
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={historyPage <= 0 || historyLoading}
                        onClick={() =>
                          setHistoryPage((p) => Math.max(0, p - 1))
                        }
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={
                          historyPage + 1 >= totalPages || historyLoading
                        }
                        onClick={() => setHistoryPage((p) => p + 1)}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        ) : (
          <div
            id={`${baseId}-charts`}
            className="mt-4"
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-charts`}
          >
            <PatientCharts patientId={profile.id} profile={profile} />
          </div>
        )}
      </div>

      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  )
}
