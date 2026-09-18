import { beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.fn()
vi.mock('./supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}))

import { createCheckoutSession, createPortalSession } from './supportApi'

describe('supportApi', () => {
  beforeEach(() => {
    invokeMock.mockReset()
  })

  it('createCheckoutSession returns checkout url', async () => {
    invokeMock.mockResolvedValue({
      data: { url: 'https://checkout.stripe.com/test' },
      error: null,
    })

    const url = await createCheckoutSession({
      plan: 'support_20',
      successUrl: 'http://localhost/apoiar?apoiar=sucesso',
      cancelUrl: 'http://localhost/apoiar?apoiar=cancelado',
    })

    expect(url).toBe('https://checkout.stripe.com/test')
    expect(invokeMock).toHaveBeenCalledWith('create-doctor-checkout', {
      body: {
        plan: 'support_20',
        successUrl: 'http://localhost/apoiar?apoiar=sucesso',
        cancelUrl: 'http://localhost/apoiar?apoiar=cancelado',
      },
    })
  })

  it('createCheckoutSession throws on missing url', async () => {
    invokeMock.mockResolvedValue({ data: {}, error: null })
    await expect(
      createCheckoutSession({
        plan: 'support_10',
        successUrl: 'a',
        cancelUrl: 'b',
      }),
    ).rejects.toThrow('Não foi possível iniciar o checkout.')
  })

  it('createCheckoutSession throws invoke error', async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: new Error('checkout failed'),
    })
    await expect(
      createCheckoutSession({
        plan: 'support_10',
        successUrl: 'a',
        cancelUrl: 'b',
      }),
    ).rejects.toThrow('checkout failed')
  })

  it('createPortalSession returns portal url', async () => {
    invokeMock.mockResolvedValue({
      data: { url: 'https://billing.stripe.com/test' },
      error: null,
    })

    const url = await createPortalSession('http://localhost/apoiar')
    expect(url).toBe('https://billing.stripe.com/test')
    expect(invokeMock).toHaveBeenCalledWith('create-doctor-portal', {
      body: { returnUrl: 'http://localhost/apoiar' },
    })
  })

  it('createPortalSession throws on missing url', async () => {
    invokeMock.mockResolvedValue({ data: null, error: null })
    await expect(createPortalSession('http://localhost/apoiar')).rejects.toThrow(
      'Não foi possível abrir o portal de assinatura.',
    )
  })

  it('createPortalSession throws invoke error', async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: new Error('portal failed'),
    })
    await expect(createPortalSession('http://localhost/apoiar')).rejects.toThrow(
      'portal failed',
    )
  })
})
