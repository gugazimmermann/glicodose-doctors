import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function mapRpcError(err: unknown): string {
  if (!(err instanceof Error)) return 'Não foi possível vincular o paciente.'
  const msg = err.message.toLowerCase()
  if (msg.includes('patient not found')) return 'Código não encontrado.'
  if (msg.includes('invalid share code')) {
    return 'Código inválido. Use 6 caracteres (letras e números).'
  }
  if (msg.includes('cannot link to yourself')) {
    return 'Não é possível vincular o próprio código.'
  }
  if (msg.includes('doctor profile required')) {
    return 'Perfil de médico necessário. Faça logout e cadastre-se novamente.'
  }
  return err.message
}

export function LinkPatientPage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)

  async function onLink(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const normalized = code.trim().toUpperCase()
    if (!/^[A-Z0-9]{6}$/.test(normalized)) {
      setError('Digite um código de 6 caracteres (letras e números).')
      return
    }

    setLinking(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('link_patient_by_code', {
        p_code: normalized,
      })
      if (rpcError) throw rpcError

      const rows = data as { id: string; full_name: string | null }[] | null
      const linked = Array.isArray(rows) ? rows[0] : null
      const name = linked?.full_name ?? null
      setSuccess(
        name
          ? `Paciente ${name} vinculado.`
          : 'Paciente vinculado com sucesso.',
      )
      setCode('')
    } catch (err) {
      setError(mapRpcError(err))
    } finally {
      setLinking(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Vincular paciente
        </h1>
        <p className="mt-1 text-sm text-muted">
          Digite o código de 6 dígitos do perfil do paciente no app GlicoDose.
        </p>
      </div>

      <form
        onSubmit={onLink}
        className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6"
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">
            Código do paciente
          </span>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={code}
              onChange={(e) =>
                setCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, '')
                    .slice(0, 6),
                )
              }
              maxLength={6}
              placeholder="ABC123"
              className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 font-mono text-lg font-semibold tracking-[0.2em] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 sm:max-w-xs"
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
            <button
              type="submit"
              disabled={linking}
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
            >
              {linking ? 'Vinculando…' : 'Salvar código'}
            </button>
          </div>
        </label>

        {error && (
          <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {success && (
          <div className="mt-3 space-y-2">
            <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand-dark">
              {success}
            </p>
            <Link
              to="/"
              className="inline-block text-sm font-semibold text-brand no-underline hover:text-brand-dark"
            >
              Ver lista de pacientes →
            </Link>
          </div>
        )}
      </form>
    </div>
  )
}
