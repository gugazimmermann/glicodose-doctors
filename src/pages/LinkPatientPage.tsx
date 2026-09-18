import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAutoClear } from '../hooks/useAutoClear'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input, Label } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'

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

  function clearSuccess() {
    setSuccess(null)
  }

  useAutoClear(success, clearSuccess, 8000)

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
    <div className="mx-auto w-full min-w-0 max-w-md space-y-6 sm:space-y-8">
      <PageHeader
        title="Vincular paciente"
        description="Digite o código de 6 dígitos do perfil do paciente no app GlicoDose."
      />

      <Card className="min-w-0">
        <form onSubmit={onLink} className="min-w-0 space-y-4">
          <div className="min-w-0">
            <Label htmlFor="share-code">Código do paciente</Label>
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
              <Input
                id="share-code"
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
                className="w-full min-w-0 text-center font-mono text-xl font-bold tracking-wider sm:max-w-[14rem]"
                autoComplete="off"
                spellCheck={false}
                autoFocus
                aria-describedby="share-code-hint"
              />
              <Button type="submit" disabled={linking} className="sm:shrink-0">
                {linking ? 'Vinculando…' : 'Vincular'}
              </Button>
            </div>
            <p id="share-code-hint" className="mt-2 text-xs text-muted">
              6 caracteres — letras e números, sem espaços.
            </p>
          </div>

          {error && (
            <Alert variant="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}
          {success && (
            <div className="space-y-3">
              <Alert variant="success" onDismiss={clearSuccess}>
                {success}
              </Alert>
              <Link to="/" className="inline-block no-underline">
                <Button variant="secondary" size="sm">
                  Ver lista de pacientes
                </Button>
              </Link>
            </div>
          )}
        </form>
      </Card>
    </div>
  )
}
