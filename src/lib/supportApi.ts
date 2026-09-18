import { supabase } from './supabase'
import type { SupportPlanKey } from './supportProducts'

export async function createCheckoutSession(options: {
  plan: SupportPlanKey
  successUrl: string
  cancelUrl: string
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke(
    'create-doctor-checkout',
    {
      body: {
        plan: options.plan,
        successUrl: options.successUrl,
        cancelUrl: options.cancelUrl,
      },
    },
  )

  if (error) throw error

  const url = (data as { url?: string } | null)?.url
  if (!url) throw new Error('Não foi possível iniciar o checkout.')
  return url
}

export async function createPortalSession(returnUrl: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke(
    'create-doctor-portal',
    {
      body: { returnUrl },
    },
  )

  if (error) throw error

  const url = (data as { url?: string } | null)?.url
  if (!url) throw new Error('Não foi possível abrir o portal de assinatura.')
  return url
}
