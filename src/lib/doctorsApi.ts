import { supabase } from './supabase'
import type { Doctor, DoctorProfileFields } from '../types/database'

export async function updateDoctorProfile(
  doctor: Pick<Doctor, 'id' | 'profile_completed_at'>,
  fields: DoctorProfileFields,
): Promise<void> {
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
}
