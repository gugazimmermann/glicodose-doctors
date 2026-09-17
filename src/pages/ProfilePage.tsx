import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { DoctorProfileForm } from '../components/DoctorProfileForm'
import type { DoctorProfileFields } from '../types/database'

export function ProfilePage() {
  const { doctor, refreshDoctor } = useAuth()

  if (!doctor) return null

  async function handleSubmit(fields: DoctorProfileFields) {
    if (!doctor) return
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('doctors')
      .update({
        crm: fields.crm,
        crm_uf: fields.crm_uf,
        rqe: fields.rqe || null,
        specialty: fields.specialty,
        phone: fields.phone,
        clinic_name: fields.clinic_name,
        address_cep: fields.address_cep,
        address_street: fields.address_street,
        address_number: fields.address_number,
        address_complement: fields.address_complement || null,
        address_neighborhood: fields.address_neighborhood,
        address_city: fields.address_city,
        address_state: fields.address_state,
        profile_completed_at: doctor.profile_completed_at ?? now,
        updated_at: now,
      })
      .eq('id', doctor.id)

    if (error) throw error
    await refreshDoctor()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Perfil</h1>
        <p className="mt-1 text-sm text-muted">
          Dados profissionais de {doctor.full_name}.
        </p>
      </div>

      <DoctorProfileForm
        key={doctor.updated_at}
        doctor={doctor}
        submitLabel="Salvar alterações"
        onSubmit={handleSubmit}
      />
    </div>
  )
}
