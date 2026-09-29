import { supabase } from './supabase'
import type { Doctor } from '../types/database'

export const CONTACT_CATEGORIES = [
  'Reclamação',
  'Ideia',
  'Sugestão',
  'Dúvida',
  'Outro',
] as const

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number]

export type DoctorContactPayload = {
  name: string
  email: string
  category: ContactCategory
  message: string
  /** CRM with UF when the profile has them, e.g. "123456/SP". */
  crm?: string
}

export function formatDoctorCrm(
  doctor: Pick<Doctor, 'crm' | 'crm_uf'> | null,
): string | undefined {
  const crm = doctor?.crm?.trim() ?? ''
  const uf = doctor?.crm_uf?.trim() ?? ''
  if (crm && uf) return `${crm}/${uf}`
  if (crm) return crm
  if (uf) return uf
  return undefined
}

export function isContactCategory(value: string): value is ContactCategory {
  return (CONTACT_CATEGORIES as readonly string[]).includes(value)
}

export async function sendDoctorContactMessage(
  payload: DoctorContactPayload,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('send-contact', {
    body: {
      source: 'medicos',
      name: payload.name,
      email: payload.email,
      category: payload.category,
      message: payload.message,
      crm: payload.crm ?? '',
    },
  })

  if (error) throw error

  const apiError = (data as { error?: string } | null)?.error
  if (apiError) throw new Error(apiError)
}
