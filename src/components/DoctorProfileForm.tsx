import { useState, type FormEvent } from 'react'
import type { Doctor, DoctorProfileFields } from '../types/database'
import { useAutoClear } from '../hooks/useAutoClear'
import { Alert } from './ui/Alert'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Input, Label, Select } from './ui/Input'

const BRAZIL_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN',
  'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const

/** Brazilian phone: (11) 98888-8888 or (11) 3333-3333 */
function formatPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function doctorToFields(doctor: Doctor): DoctorProfileFields {
  return {
    crm: doctor.crm ?? '',
    crm_uf: doctor.crm_uf ?? '',
    rqe: doctor.rqe ?? '',
    specialty: doctor.specialty?.trim() || 'Endocrinologia',
    phone: formatPhoneMask(doctor.phone ?? ''),
    clinic_name: doctor.clinic_name ?? '',
    address_cep: doctor.address_cep ?? '',
    address_street: doctor.address_street ?? '',
    address_number: doctor.address_number ?? '',
    address_complement: doctor.address_complement ?? '',
    address_neighborhood: doctor.address_neighborhood ?? '',
    address_city: doctor.address_city ?? '',
    address_state: doctor.address_state ?? '',
  }
}

function validate(fields: DoctorProfileFields): string | null {
  if (!fields.crm.trim()) return 'Informe o CRM.'
  if (!/^[A-Z]{2}$/.test(fields.crm_uf)) return 'Selecione a UF do CRM.'
  const phoneDigits = fields.phone.replace(/\D/g, '')
  if (phoneDigits.length < 10 || phoneDigits.length > 11) {
    return 'Informe um telefone válido com DDD.'
  }
  if (!fields.clinic_name.trim()) return 'Informe o nome do consultório.'
  if (!fields.specialty.trim()) return 'Informe a especialidade.'
  const cep = fields.address_cep.replace(/\D/g, '')
  if (cep.length !== 8) return 'Informe um CEP válido (8 dígitos).'
  if (!fields.address_street.trim()) return 'Informe o logradouro.'
  if (!fields.address_number.trim()) return 'Informe o número.'
  if (!fields.address_neighborhood.trim()) return 'Informe o bairro.'
  if (!fields.address_city.trim()) return 'Informe a cidade.'
  if (!/^[A-Z]{2}$/.test(fields.address_state)) {
    return 'Selecione a UF do endereço.'
  }
  return null
}

export type DoctorProfileFormProps = {
  doctor: Doctor
  submitLabel: string
  onSubmit: (fields: DoctorProfileFields) => Promise<void>
}

export function DoctorProfileForm({
  doctor,
  submitLabel,
  onSubmit,
}: DoctorProfileFormProps) {
  const [fields, setFields] = useState<DoctorProfileFields>(() =>
    doctorToFields(doctor),
  )
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useAutoClear(success, () => setSuccess(null), 5000)

  function setField<K extends keyof DoctorProfileFields>(
    key: K,
    value: DoctorProfileFields[K],
  ) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const validationError = validate(fields)
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    try {
      await onSubmit({
        ...fields,
        crm: fields.crm.trim(),
        crm_uf: fields.crm_uf.trim().toUpperCase(),
        rqe: fields.rqe.trim(),
        specialty: fields.specialty.trim(),
        phone: formatPhoneMask(fields.phone),
        clinic_name: fields.clinic_name.trim(),
        address_cep: fields.address_cep.replace(/\D/g, ''),
        address_street: fields.address_street.trim(),
        address_number: fields.address_number.trim(),
        address_complement: fields.address_complement.trim(),
        address_neighborhood: fields.address_neighborhood.trim(),
        address_city: fields.address_city.trim(),
        address_state: fields.address_state.trim().toUpperCase(),
      })
      setSuccess('Dados salvos com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-0 max-w-full space-y-6">
      <Card className="min-w-0 space-y-5">
        <fieldset className="min-w-0 space-y-4">
          <legend className="text-sm font-semibold uppercase tracking-wide text-muted">
            Dados profissionais
          </legend>
          <div className="grid min-w-0 gap-4 sm:grid-cols-3">
            <div className="min-w-0 sm:col-span-2">
              <Label htmlFor="crm">CRM</Label>
              <Input
                id="crm"
                type="text"
                value={fields.crm}
                onChange={(e) =>
                  setField('crm', e.target.value.replace(/\D/g, '').slice(0, 10))
                }
                inputMode="numeric"
                autoComplete="off"
                required
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="crm_uf">UF do CRM</Label>
              <Select
                id="crm_uf"
                value={fields.crm_uf}
                onChange={(e) => setField('crm_uf', e.target.value)}
                required
              >
                <option value="">Selecione</option>
                {BRAZIL_UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <Label htmlFor="rqe" hint="opcional">
                RQE
              </Label>
              <Input
                id="rqe"
                type="text"
                value={fields.rqe}
                onChange={(e) => setField('rqe', e.target.value.slice(0, 20))}
                autoComplete="off"
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="specialty">Especialidade</Label>
              <Input
                id="specialty"
                type="text"
                value={fields.specialty}
                onChange={(e) => setField('specialty', e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <Label htmlFor="phone">Telefone / WhatsApp</Label>
              <Input
                id="phone"
                type="tel"
                value={fields.phone}
                onChange={(e) => setField('phone', formatPhoneMask(e.target.value))}
                placeholder="(11) 98888-8888"
                inputMode="numeric"
                autoComplete="tel-national"
                required
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="clinic_name">Consultório / clínica</Label>
              <Input
                id="clinic_name"
                type="text"
                value={fields.clinic_name}
                onChange={(e) => setField('clinic_name', e.target.value)}
                required
              />
            </div>
          </div>
        </fieldset>
      </Card>

      <Card className="min-w-0 space-y-5">
        <fieldset className="min-w-0 space-y-4">
          <legend className="text-sm font-semibold uppercase tracking-wide text-muted">
            Endereço do consultório
          </legend>
          <div className="grid min-w-0 gap-4 sm:grid-cols-3">
            <div className="min-w-0">
              <Label htmlFor="address_cep">CEP</Label>
              <Input
                id="address_cep"
                type="text"
                value={fields.address_cep}
                onChange={(e) =>
                  setField(
                    'address_cep',
                    e.target.value.replace(/\D/g, '').slice(0, 8),
                  )
                }
                inputMode="numeric"
                required
              />
            </div>
            <div className="min-w-0 sm:col-span-2">
              <Label htmlFor="address_street">Logradouro</Label>
              <Input
                id="address_street"
                type="text"
                value={fields.address_street}
                onChange={(e) => setField('address_street', e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-3">
            <div className="min-w-0">
              <Label htmlFor="address_number">Número</Label>
              <Input
                id="address_number"
                type="text"
                value={fields.address_number}
                onChange={(e) => setField('address_number', e.target.value)}
                required
              />
            </div>
            <div className="min-w-0 sm:col-span-2">
              <Label htmlFor="address_complement" hint="opcional">
                Complemento
              </Label>
              <Input
                id="address_complement"
                type="text"
                value={fields.address_complement}
                onChange={(e) => setField('address_complement', e.target.value)}
              />
            </div>
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-3">
            <div className="min-w-0">
              <Label htmlFor="address_neighborhood">Bairro</Label>
              <Input
                id="address_neighborhood"
                type="text"
                value={fields.address_neighborhood}
                onChange={(e) => setField('address_neighborhood', e.target.value)}
                required
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="address_city">Cidade</Label>
              <Input
                id="address_city"
                type="text"
                value={fields.address_city}
                onChange={(e) => setField('address_city', e.target.value)}
                required
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="address_state">UF</Label>
              <Select
                id="address_state"
                value={fields.address_state}
                onChange={(e) => setField('address_state', e.target.value)}
                required
              >
                <option value="">Selecione</option>
                {BRAZIL_UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </fieldset>
      </Card>

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" onDismiss={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <div className="sticky bottom-0 z-10 w-full max-w-full border-t border-line/80 bg-surface/95 py-3 backdrop-blur-md lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <Button type="submit" disabled={saving} className="w-full sm:w-auto">
          {saving ? 'Salvando…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
