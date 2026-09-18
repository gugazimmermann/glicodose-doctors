import type { Doctor, DoctorProfileFields, Entry, Profile } from '../types/database'

export function makeDoctor(overrides: Partial<Doctor> = {}): Doctor {
  return {
    id: 'doctor-1',
    full_name: 'Dr. Teste',
    crm: '123456',
    crm_uf: 'SP',
    rqe: null,
    specialty: 'Endocrinologia',
    phone: '11998887766',
    clinic_name: 'Clínica Teste',
    address_cep: '01310100',
    address_street: 'Av. Paulista',
    address_number: '1000',
    address_complement: null,
    address_neighborhood: 'Bela Vista',
    address_city: 'São Paulo',
    address_state: 'SP',
    profile_completed_at: '2024-01-01T00:00:00.000Z',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function makeDoctorFields(
  overrides: Partial<DoctorProfileFields> = {},
): DoctorProfileFields {
  return {
    crm: '123456',
    crm_uf: 'SP',
    rqe: '',
    specialty: 'Endocrinologia',
    phone: '(11) 99888-7766',
    clinic_name: 'Clínica Teste',
    address_cep: '01310100',
    address_street: 'Av. Paulista',
    address_number: '1000',
    address_complement: '',
    address_neighborhood: 'Bela Vista',
    address_city: 'São Paulo',
    address_state: 'SP',
    ...overrides,
  }
}

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'patient-1',
    full_name: 'Paciente Teste',
    target_glucose_mgdl: 110,
    target_night_mgdl: 120,
    isf_mgdl_per_u: 40,
    ic_ratio: 10,
    rapid_insulin_name: 'Humalog',
    diabetes_type: 'type_1',
    share_code: 'ABC123',
    dose_step: 0.5,
    insulin_duration_hours: 4,
    night_start_minute: 22 * 60,
    night_end_minute: 6 * 60,
    disclaimer_accepted_at: '2024-01-01T00:00:00.000Z',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'entry-1',
    user_id: 'patient-1',
    recorded_at: '2024-06-15T15:00:00.000Z',
    glucose_mgdl: 120,
    food_text: 'Almoço',
    food_image_path: null,
    recommended_insulin: 4,
    applied_insulin: 3.5,
    gpt_raw_response: {
      carboidratos_g: 45,
      correcao_u: 1,
      bolus_comida_u: 3,
      iob_u: 0.5,
      insulina_recomendada_u: 4,
      observacao: 'ok',
      meta_mgdl: 110,
      meta_periodo: 'dia',
      source: 'gpt',
    },
    created_at: '2024-06-15T15:00:00.000Z',
    ...overrides,
  }
}
