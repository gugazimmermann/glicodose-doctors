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
import { BrandLogo } from '../components/BrandLogo'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input, Select } from '../components/ui/Input'
import { ConfirmDialog } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { Skeleton, Spinner } from '../components/ui/Spinner'

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
  const [confirmUnlinkId, setConfirmUnlinkId] = useState<string | null>(null)
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

  async function confirmUnlink() {
    const linkId = confirmUnlinkId!
    setConfirmUnlinkId(null)
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

  const confirmPatient = patients.find((p) => p.linkId === confirmUnlinkId)

  return (
    <div className="min-w-0 max-w-full space-y-6 sm:space-y-8">
      <PageHeader
        title="Pacientes"
        description="Busque e acompanhe os pacientes vinculados à sua conta."
        action={
          patients.length > 0 ? (
            <Link to="/vincular" className="no-underline">
              <Button size="sm">Vincular</Button>
            </Link>
          ) : null
        }
      />

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Pacientes vinculados ({countLabel})
        </h2>

        {loading ? (
          <div className="space-y-3">
            <Spinner />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : patients.length === 0 ? (
          <EmptyState
            className="py-12"
            icon={<BrandLogo size={56} />}
            title="Nenhum paciente ainda"
            description="Vincule um paciente com o código de 6 dígitos do app GlicoDose."
            action={
              <Link to="/vincular" className="inline-block no-underline">
                <Button>Vincular paciente</Button>
              </Link>
            }
          />
        ) : (
          <>
            <div className="mb-4 flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
              <label className="relative block min-w-0 w-full flex-1">
                <span className="sr-only">Buscar paciente</span>
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nome ou código"
                  className="pr-16"
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
              <label className="flex min-w-0 w-full shrink-0 items-center gap-2 text-sm text-muted lg:w-auto">
                <span className="shrink-0">Ordenar</span>
                <Select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortMode)}
                  className="min-w-0 flex-1 lg:w-auto lg:min-w-40"
                >
                  <option value="name">Nome (A–Z)</option>
                  <option value="recent">Mais recentes</option>
                </Select>
              </label>
            </div>

            {filteredPatients.length === 0 ? (
              <EmptyState
                title="Nenhum paciente encontrado"
                description="Tente outro nome ou código, ou limpe a busca."
              />
            ) : (
              <ul className="space-y-3">
                {filteredPatients.map(({ linkId, linkedAt, patient }) => (
                  <li key={linkId}>
                    <Card
                      padded={false}
                      className="flex min-w-0 flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between lg:p-5"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/pacientes/${patient.id}`}
                            className="block truncate text-base font-semibold text-ink no-underline hover:text-brand"
                          >
                            {patient.full_name?.trim() || 'Paciente sem nome'}
                          </Link>
                          <p className="mt-0.5 break-words text-xs text-muted">
                            Código{' '}
                            <span className="font-mono font-semibold tracking-wider text-ink">
                              {patient.share_code}
                            </span>
                            {' · '}vinculado em {formatBrazilDate(linkedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/pacientes/${patient.id}`}
                          className="no-underline"
                        >
                          <Button size="sm">Ver histórico</Button>
                        </Link>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setConfirmUnlinkId(linkId)}
                          disabled={unlinkingId === linkId}
                        >
                          {unlinkingId === linkId ? '…' : 'Remover'}
                        </Button>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {confirmUnlinkId && (
        <ConfirmDialog
          title="Remover paciente?"
          description={
            <>
              {confirmPatient?.patient.full_name?.trim() || 'Este paciente'}{' '}
              será removido da sua lista. O histórico dele no app não é apagado.
            </>
          }
          confirmLabel="Remover"
          onCancel={() => setConfirmUnlinkId(null)}
          onConfirm={() => void confirmUnlink()}
          confirming={unlinkingId === confirmUnlinkId}
        />
      )}
    </div>
  )
}
