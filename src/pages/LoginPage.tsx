import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { BrandLogo } from '../components/BrandLogo'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input, Label } from '../components/ui/Input'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { FullPageSpinner } from '../components/ui/Spinner'
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

  if (loading) {
    return <FullPageSpinner />
  }

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
    <div className="flex min-h-screen max-w-full items-center justify-center overflow-x-hidden px-4 py-10">
      <div className="w-full min-w-0 max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 w-fit">
            <BrandLogo size={80} className="shadow-lg ring-4 ring-white/70" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            GlicoDose Médicos
          </h1>
          <p className="mt-2 text-sm text-muted">
            Acompanhe o histórico dos seus pacientes
          </p>
        </div>

        <Card className="sm:p-8">
          {!showComplete && (
            <SegmentedControl
              className="mb-6"
              variant="pills"
              ariaLabel="Modo de acesso"
              value={mode}
              onChange={(next) => {
                setMode(next)
                setError(null)
              }}
              items={[
                { value: 'login', label: 'Entrar' },
                { value: 'signup', label: 'Cadastrar' },
              ]}
            />
          )}

          {showComplete && (
            <Alert variant="info" className="mb-4">
              Conta autenticada. Informe seu nome para concluir o perfil de
              médico.
            </Alert>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            {(mode === 'signup' || showComplete) && (
              <div>
                <Label htmlFor="login-name">Nome completo</Label>
                <Input
                  id="login-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dr(a). Nome"
                  autoComplete="name"
                />
              </div>
            )}

            {!showComplete && (
              <>
                <div>
                  <Label htmlFor="login-email">E-mail</Label>
                  <Input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@clinica.com"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete={
                      mode === 'login' ? 'current-password' : 'new-password'
                    }
                  />
                </div>
              </>
            )}

            {error && <Alert variant="error">{error}</Alert>}

            <Button type="submit" disabled={submitting} className="w-full" size="lg">
              {submitting
                ? 'Aguarde…'
                : showComplete
                  ? 'Concluir perfil'
                  : mode === 'login'
                    ? 'Entrar'
                    : 'Criar conta'}
            </Button>

            {showComplete && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => void signOut()}
              >
                Usar outra conta
              </Button>
            )}
          </form>
        </Card>
      </div>
    </div>
  )
}
