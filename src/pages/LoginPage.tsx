import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { BrandLogo } from '../components/BrandLogo'
import { isDoctorProfileComplete } from '../types/database'

type Mode = 'login' | 'signup'

function formatAuthError(err: unknown): string {
  if (!(err instanceof Error)) return 'Algo deu errado. Tente novamente.'
  const msg = err.message.toLowerCase()
  if (msg.includes('invalid login')) return 'E-mail ou senha incorretos.'
  if (msg.includes('already registered')) return 'Este e-mail já está cadastrado.'
  if (msg.includes('password')) return 'A senha precisa ter pelo menos 6 caracteres.'
  return err.message
}

export function LoginPage() {
  const { session, doctor, loading, signIn, signUp, refreshDoctor, signOut } =
    useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const needDoctor =
    Boolean(
      (location.state as { needDoctorProfile?: boolean } | null)
        ?.needDoctorProfile,
    ) || Boolean(session && !doctor && !loading)

  if (!loading && session && doctor) {
    return (
      <Navigate
        to={isDoctorProfileComplete(doctor) ? '/' : '/completar-perfil'}
        replace
      />
    )
  }

  async function completeDoctorProfile() {
    if (!session?.user?.id) return
    if (!fullName.trim()) {
      setError('Informe seu nome.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { error: doctorError } = await supabase.from('doctors').upsert({
        id: session.user.id,
        full_name: fullName.trim(),
        updated_at: new Date().toISOString(),
      })
      if (doctorError) throw doctorError
      await refreshDoctor()
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (needDoctor && session) {
        await completeDoctorProfile()
        return
      }
      if (mode === 'login') {
        await signIn(email.trim(), password)
      } else {
        if (!fullName.trim()) {
          setError('Informe seu nome.')
          return
        }
        await signUp(email.trim(), password, fullName.trim())
      }
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const showComplete = needDoctor && Boolean(session)

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 w-fit">
            <BrandLogo size={64} className="shadow-md" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            GlicoDose Médicos
          </h1>
          <p className="mt-1 text-sm text-muted">
            Acompanhe o histórico dos seus pacientes
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-card p-6 shadow-sm sm:p-8">
          {!showComplete && (
            <div className="mb-6 flex rounded-lg bg-surface p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setError(null)
                }}
                className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
                  mode === 'login'
                    ? 'bg-card text-brand shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup')
                  setError(null)
                }}
                className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
                  mode === 'signup'
                    ? 'bg-card text-brand shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Cadastrar
              </button>
            </div>
          )}

          {showComplete && (
            <p className="mb-4 rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand-dark">
              Conta autenticada. Informe seu nome para concluir o perfil de
              médico.
            </p>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            {(mode === 'signup' || showComplete) && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">
                  Nome completo
                </span>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  placeholder="Dr(a). Nome"
                  autoComplete="name"
                />
              </label>
            )}

            {!showComplete && (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink">
                    E-mail
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    placeholder="voce@clinica.com"
                    autoComplete="email"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink">
                    Senha
                  </span>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    placeholder="Mínimo 6 caracteres"
                    autoComplete={
                      mode === 'login' ? 'current-password' : 'new-password'
                    }
                  />
                </label>
              </>
            )}

            {error && (
              <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
            >
              {submitting
                ? 'Aguarde…'
                : showComplete
                  ? 'Concluir perfil'
                  : mode === 'login'
                    ? 'Entrar'
                    : 'Criar conta'}
            </button>

            {showComplete && (
              <button
                type="button"
                onClick={() => void signOut()}
                className="w-full text-sm font-medium text-muted hover:text-ink"
              >
                Usar outra conta
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
