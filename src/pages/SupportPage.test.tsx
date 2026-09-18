import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createAuthMock, renderWithRouter } from '../test/renderWithProviders'
import { makeDoctor } from '../test/fixtures'

const useAuth = vi.fn()
const createCheckoutSession = vi.fn()
const createPortalSession = vi.fn()

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => useAuth(),
}))

vi.mock('../lib/supportApi', () => ({
  createCheckoutSession: (...args: unknown[]) => createCheckoutSession(...args),
  createPortalSession: (...args: unknown[]) => createPortalSession(...args),
}))

import { SupportPage, resolveAppBaseUrl } from './SupportPage'

describe('SupportPage', () => {
  beforeEach(() => {
    createCheckoutSession.mockReset()
    createPortalSession.mockReset()
    useAuth.mockReturnValue(createAuthMock())
  })

  it('renders four plans and calls checkout', async () => {
    const user = userEvent.setup()
    createCheckoutSession.mockResolvedValue('https://checkout.stripe.com/x')
    const assign = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign, origin: 'http://localhost:5173' },
    })

    renderWithRouter(<SupportPage />, { route: '/apoiar' })

    expect(screen.getByText('Apoiar o GlicoDose')).toBeInTheDocument()
    expect(screen.getByText('GlicoDose 10')).toBeInTheDocument()
    expect(screen.getByText('GlicoDose 100')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Assinar' })[1]!)

    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'support_20' }),
    )
    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/x')
  })

  it('shows supporter badge and manage button', async () => {
    const user = userEvent.setup()
    useAuth.mockReturnValue(
      createAuthMock({
        doctor: makeDoctor({
          supporter_status: 'active',
          supporter_product_id: 'support_50',
          stripe_customer_id: 'cus_123',
        }),
      }),
    )
    createPortalSession.mockResolvedValue('https://billing.stripe.com/x')
    const assign = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign, origin: 'http://localhost:5173' },
    })

    renderWithRouter(<SupportPage />, { route: '/apoiar' })

    expect(screen.getByText('Você é apoiador')).toBeInTheDocument()
    expect(screen.getByText('Plano: GlicoDose 50 · R$50/mês')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plano ativo' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Gerenciar assinatura' }))
    expect(createPortalSession).toHaveBeenCalled()
    expect(assign).toHaveBeenCalledWith('https://billing.stripe.com/x')
  })

  it('shows success banner from query param', async () => {
    const user = userEvent.setup()
    const auth = createAuthMock()
    useAuth.mockReturnValue(auth)

    renderWithRouter(<SupportPage />, { route: '/apoiar?apoiar=sucesso' })

    expect(
      await screen.findByText('Obrigado por apoiar o GlicoDose!'),
    ).toBeInTheDocument()
    expect(auth.refreshDoctor).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(
      screen.queryByText('Obrigado por apoiar o GlicoDose!'),
    ).not.toBeInTheDocument()
  })

  it('shows cancel banner from query param', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SupportPage />, { route: '/apoiar?apoiar=cancelado' })

    expect(
      await screen.findByText(
        'Checkout cancelado. Você pode apoiar quando quiser.',
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(
      screen.queryByText(
        'Checkout cancelado. Você pode apoiar quando quiser.',
      ),
    ).not.toBeInTheDocument()
  })

  it('returns null without doctor', () => {
    useAuth.mockReturnValue(createAuthMock({ doctor: null }))
    const { container } = renderWithRouter(<SupportPage />, {
      route: '/apoiar',
    })
    expect(container).toBeEmptyDOMElement()
  })

  it('shows fallback message for supporter without product', () => {
    useAuth.mockReturnValue(
      createAuthMock({
        doctor: makeDoctor({
          supporter_status: 'active',
          supporter_product_id: null,
        }),
      }),
    )

    renderWithRouter(<SupportPage />, { route: '/apoiar' })

    expect(screen.getByText('Você é apoiador')).toBeInTheDocument()
    expect(
      screen.getByText('Obrigado por manter o projeto.'),
    ).toBeInTheDocument()
  })

  it('shows checkout error and allows dismiss', async () => {
    const user = userEvent.setup()
    createCheckoutSession.mockRejectedValue(new Error('falha no checkout'))

    renderWithRouter(<SupportPage />, { route: '/apoiar' })

    await user.click(screen.getAllByRole('button', { name: 'Assinar' })[0]!)

    expect(await screen.findByText('falha no checkout')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByText('falha no checkout')).not.toBeInTheDocument()
  })

  it('shows generic checkout error for non-Error rejection', async () => {
    const user = userEvent.setup()
    createCheckoutSession.mockRejectedValue('boom')

    renderWithRouter(<SupportPage />, { route: '/apoiar' })

    await user.click(screen.getAllByRole('button', { name: 'Assinar' })[0]!)

    expect(
      await screen.findByText(
        'Não foi possível iniciar o checkout. Tente novamente.',
      ),
    ).toBeInTheDocument()
  })

  it('shows portal error and allows dismiss', async () => {
    const user = userEvent.setup()
    useAuth.mockReturnValue(
      createAuthMock({
        doctor: makeDoctor({
          supporter_status: 'active',
          supporter_product_id: 'support_20',
        }),
      }),
    )
    createPortalSession.mockRejectedValue(new Error('falha no portal'))

    renderWithRouter(<SupportPage />, { route: '/apoiar' })

    await user.click(screen.getByRole('button', { name: 'Gerenciar assinatura' }))

    expect(await screen.findByText('falha no portal')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByText('falha no portal')).not.toBeInTheDocument()
  })

  it('shows generic portal error for non-Error rejection', async () => {
    const user = userEvent.setup()
    useAuth.mockReturnValue(
      createAuthMock({
        doctor: makeDoctor({
          supporter_status: 'active',
          supporter_product_id: 'support_20',
        }),
      }),
    )
    createPortalSession.mockRejectedValue('boom')

    renderWithRouter(<SupportPage />, { route: '/apoiar' })

    await user.click(screen.getByRole('button', { name: 'Gerenciar assinatura' }))

    expect(
      await screen.findByText(
        'Não foi possível abrir o gerenciamento da assinatura.',
      ),
    ).toBeInTheDocument()
  })

  it('resolveAppBaseUrl prefers env url and strips trailing slash', () => {
    expect(resolveAppBaseUrl('https://app.example.com/', 'http://localhost')).toBe(
      'https://app.example.com',
    )
    expect(resolveAppBaseUrl(undefined, 'http://localhost:5173')).toBe(
      'http://localhost:5173',
    )
  })
})
