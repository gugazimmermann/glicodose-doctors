export type Doctor = {
  id: string
  full_name: string
  crm: string | null
  crm_uf: string | null
  rqe: string | null
  specialty: string | null
  phone: string | null
  clinic_name: string | null
  address_cep: string | null
  address_street: string | null
  address_number: string | null
  address_complement: string | null
  address_neighborhood: string | null
  address_city: string | null
  address_state: string | null
  profile_completed_at: string | null
  created_at: string
  updated_at: string
}

export type DoctorProfileFields = {
  crm: string
  crm_uf: string
  rqe: string
  specialty: string
  phone: string
  clinic_name: string
  address_cep: string
  address_street: string
  address_number: string
  address_complement: string
  address_neighborhood: string
  address_city: string
  address_state: string
}

export function isDoctorProfileComplete(
  doctor: Pick<Doctor, 'profile_completed_at'> | null,
): boolean {
  return Boolean(doctor?.profile_completed_at)
}

export type Profile = {
  id: string
  full_name: string | null
  target_glucose_mgdl: number | null
  target_night_mgdl: number | null
  isf_mgdl_per_u: number | null
  ic_ratio: number | null
  rapid_insulin_name: string | null
  diabetes_type: string | null
  share_code: string
  dose_step: number
  insulin_duration_hours: number
  night_start_minute: number
  night_end_minute: number
  disclaimer_accepted_at: string | null
  created_at: string
  updated_at: string
}

export type Entry = {
  id: string
  user_id: string
  recorded_at: string
  glucose_mgdl: number
  food_text: string | null
  food_image_path: string | null
  recommended_insulin: number | null
  applied_insulin: number | null
  gpt_raw_response: unknown
  created_at: string
}

export type LinkedPatient = {
  linkId: string
  linkedAt: string
  patient: Pick<
    Profile,
    | 'id'
    | 'full_name'
    | 'share_code'
    | 'target_glucose_mgdl'
    | 'target_night_mgdl'
    | 'isf_mgdl_per_u'
    | 'ic_ratio'
    | 'rapid_insulin_name'
    | 'diabetes_type'
  >
}
