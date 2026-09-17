import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatBrazilDate } from '../lib/format'
import type { LinkedPatient } from '../types/database'
import { useAuth } from '../contexts/AuthContext'

type SortMode = 'name' | 'recent'

function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export function PatientsPage() {
  const { doctor } = useAuth()
  const [patients, setPatients] = useState<LinkedPatient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortMode>('name')

  const loadPatients = useCallback(async () => {
    if (!doctor) return
    setLoading(true)
    setError(null)

    const { data, error: qError } = await supabase
      .from('doctor_patients')
      .select(
        `
        id,
        linked_at,
        profiles (
          id,
          full_name,
          share_code,
          target_glucose_mgdl,
          target_night_mgdl,
          isf_mgdl_per_u,
          ic_ratio,
          rapid_insulin_name,
          diabetes_type
        )
      `,
      )
      .eq('doctor_id', doctor.id)
      .order('linked_at', { ascending: false })

    if (qError) {
      setError(qError.message)
      setPatients([])
    } else {
      const mapped: LinkedPatient[] = (data ?? [])
        .map((row) => {
          const raw = row as {
            id: string
            linked_at: string
            profiles:
              | LinkedPatient['patient']
              | LinkedPatient['patient'][]
              | null
          }
          const profile = raw.profiles
          const patient = Array.isArray(profile) ? profile[0] : profile
          if (!patient) return null
          return {
            linkId: raw.id,
            linkedAt: raw.linked_at,
            patient,
          }
        })
        .filter((p): p is LinkedPatient => p != null)
      setPatients(mapped)
    }
    setLoading(false)
  }, [doctor])

  useEffect(() => {
    void loadPatients()
  }, [loadPatients])

  const filteredPatients = useMemo(() => {
    const needle = normalizeSearch(query)
    const filtered = needle
      ? patients.filter(({ patient }) => {
          const name = normalizeSearch(patient.full_name ?? '')
          const share = normalizeSearch(patient.share_code)
          return name.includes(needle) || share.includes(needle)
        })
      : patients

    const sorted = [...filtered]
    if (sort === 'name') {
      sorted.sort((a, b) => {
        const nameA = normalizeSearch(a.patient.full_name ?? '') || 'zzzz'
        const nameB = normalizeSearch(b.patient.full_name ?? '') || 'zzzz'
        return nameA.localeCompare(nameB, 'pt-BR')
      })
    } else {
      sorted.sort(
        (a, b) =>
          new Date(b.linkedAt).getTime() - new Date(a.linkedAt).getTime(),
      )
    }
    return sorted
  }, [patients, query, sort])

  const searchActive = normalizeSearch(query).length > 0

  async function onUnlink(linkId: string) {
    if (!confirm('Remover este paciente da sua lista?')) return
    setUnlinkingId(linkId)
    setError(null)
    const { error: delError } = await supabase
      .from('doctor_patients')
      .delete()
      .eq('id', linkId)
    setUnlinkingId(null)
    if (delError) {
      setError(delError.message)
      return
    }
    await loadPatients()
  }

  const countLabel = searchActive
    ? `${filteredPatients.length} de ${patients.length}`
    : String(patients.length)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Pacientes</h1>
        <p className="mt-1 text-sm text-muted">
          Busque e acompanhe os pacientes vinculados à sua conta.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Pacientes vinculados ({countLabel})
        </h2>

        {loading ? (
          <p className="text-sm text-muted">Carregando…</p>
        ) : patients.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-card/60 px-5 py-10 text-center">
            <p className="text-sm font-medium text-ink">Nenhum paciente ainda</p>
            <p className="mt-1 text-sm text-muted">
              Vá em{' '}
              <Link
                to="/vincular"
                className="font-semibold text-brand no-underline hover:text-brand-dark"
              >
                Vincular
              </Link>{' '}
              e digite o código do paciente no app GlicoDose.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative block min-w-0 flex-1">
                <span className="sr-only">Buscar paciente</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nome ou código"
                  className="w-full rounded-xl border border-line bg-white py-2.5 pl-3.5 pr-10 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  autoComplete="off"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-muted transition hover:text-ink"
                    aria-label="Limpar busca"
                  >
                    Limpar
                  </button>
                )}
              </label>
              <label className="flex shrink-0 items-center gap-2 text-sm text-muted">
                <span className="whitespace-nowrap">Ordenar</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortMode)}
                  className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                >
                  <option value="name">Nome (A–Z)</option>
                  <option value="recent">Mais recentes</option>
                </select>
              </label>
            </div>

            {filteredPatients.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-card/60 px-5 py-10 text-center">
                <p className="text-sm font-medium text-ink">
                  Nenhum paciente encontrado
                </p>
                <p className="mt-1 text-sm text-muted">
                  Tente outro nome ou código, ou limpe a busca.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {filteredPatients.map(({ linkId, linkedAt, patient }) => (
                  <li
                    key={linkId}
                    className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5"
                  >
                    <div>
                      <Link
                        to={`/pacientes/${patient.id}`}
                        className="text-base font-semibold text-ink no-underline hover:text-brand"
                      >
                        {patient.full_name?.trim() || 'Paciente sem nome'}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted">
                        Código{' '}
                        <span className="font-mono font-semibold tracking-wider">
                          {patient.share_code}
                        </span>
                        {' · '}vinculado em {formatBrazilDate(linkedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/pacientes/${patient.id}`}
                        className="rounded-lg bg-brand-soft px-3 py-1.5 text-sm font-semibold text-brand-dark no-underline transition hover:bg-brand hover:text-white"
                      >
                        Ver histórico
                      </Link>
                      <button
                        type="button"
                        onClick={() => void onUnlink(linkId)}
                        disabled={unlinkingId === linkId}
                        className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition hover:border-danger hover:text-danger disabled:opacity-60"
                      >
                        {unlinkingId === linkId ? '…' : 'Remover'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  )
}
