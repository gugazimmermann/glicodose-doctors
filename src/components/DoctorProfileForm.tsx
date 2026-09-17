import { useState, type FormEvent } from 'react'
import type { Doctor, DoctorProfileFields } from '../types/database'

const BRAZIL_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN',
  'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const

const inputClass =
  'w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20'

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
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6"
    >
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold uppercase tracking-wide text-muted">
          Dados profissionais
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-ink">CRM</span>
            <input
              type="text"
              value={fields.crm}
              onChange={(e) =>
                setField('crm', e.target.value.replace(/\D/g, '').slice(0, 10))
              }
              className={inputClass}
              inputMode="numeric"
              autoComplete="off"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">
              UF do CRM
            </span>
            <select
              value={fields.crm_uf}
              onChange={(e) => setField('crm_uf', e.target.value)}
              className={inputClass}
              required
            >
              <option value="">Selecione</option>
              {BRAZIL_UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">
              RQE <span className="font-normal text-muted">(opcional)</span>
            </span>
            <input
              type="text"
              value={fields.rqe}
              onChange={(e) => setField('rqe', e.target.value.slice(0, 20))}
              className={inputClass}
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">
              Especialidade
            </span>
            <input
              type="text"
              value={fields.specialty}
              onChange={(e) => setField('specialty', e.target.value)}
              className={inputClass}
              required
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">
              Telefone / WhatsApp
            </span>
            <input
              type="tel"
              value={fields.phone}
              onChange={(e) => setField('phone', formatPhoneMask(e.target.value))}
              placeholder="(11) 98888-8888"
              className={inputClass}
              inputMode="numeric"
              autoComplete="tel-national"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">
              Consultório / clínica
            </span>
            <input
              type="text"
              value={fields.clinic_name}
              onChange={(e) => setField('clinic_name', e.target.value)}
              className={inputClass}
              required
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold uppercase tracking-wide text-muted">
          Endereço do consultório
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">CEP</span>
            <input
              type="text"
              value={fields.address_cep}
              onChange={(e) =>
                setField(
                  'address_cep',
                  e.target.value.replace(/\D/g, '').slice(0, 8),
                )
              }
              className={inputClass}
              inputMode="numeric"
              required
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-ink">
              Logradouro
            </span>
            <input
              type="text"
              value={fields.address_street}
              onChange={(e) => setField('address_street', e.target.value)}
              className={inputClass}
              required
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">
              Número
            </span>
            <input
              type="text"
              value={fields.address_number}
              onChange={(e) => setField('address_number', e.target.value)}
              className={inputClass}
              required
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-ink">
              Complemento{' '}
              <span className="font-normal text-muted">(opcional)</span>
            </span>
            <input
              type="text"
              value={fields.address_complement}
              onChange={(e) => setField('address_complement', e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">
              Bairro
            </span>
            <input
              type="text"
              value={fields.address_neighborhood}
              onChange={(e) => setField('address_neighborhood', e.target.value)}
              className={inputClass}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">
              Cidade
            </span>
            <input
              type="text"
              value={fields.address_city}
              onChange={(e) => setField('address_city', e.target.value)}
              className={inputClass}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">UF</span>
            <select
              value={fields.address_state}
              onChange={(e) => setField('address_state', e.target.value)}
              className={inputClass}
              required
            >
              <option value="">Selecione</option>
              {BRAZIL_UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      {error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand-dark">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
      >
        {saving ? 'Salvando…' : submitLabel}
      </button>
    </form>
  )
}
