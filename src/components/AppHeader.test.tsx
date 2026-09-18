import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDoctor } from '../test/fixtures'
import { createAuthMock } from '../test/renderWithProviders'
import { AppHeader } from './AppHeader'

const useAuth = vi.fn()

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => useAuth(),
}))

function renderHeader(
  ui: ReactElement,
  { route = '/' }: { route?: string } = {},
) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="*" element={ui} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppHeader', () => {
  const auth = createAuthMock()

  beforeEach(() => {
    auth.signOut.mockClear()
    useAuth.mockReturnValue(auth)
  })

  it('shows nav links when showNav is true', () => {
    renderHeader(<AppHeader showNav />)

    expect(screen.getAllByRole('link', { name: 'Pacientes' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Vincular' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Perfil' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Apoiar' }).length).toBeGreaterThan(0)
  })

  it('hides nav when showNav is false', () => {
    renderHeader(<AppHeader showNav={false} />)

    expect(screen.queryByRole('navigation', { name: 'Principal' })).not.toBeInTheDocument()
  })

  it('shows doctor name from auth', () => {
    renderHeader(<AppHeader />)
    expect(screen.getByText('Dr. Teste')).toBeInTheDocument()
  })

  it('signs out and navigates to login', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/perfil']}>
        <Routes>
          <Route path="/perfil" element={<AppHeader />} />
          <Route path="/login" element={<div>Página de login</div>} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Sair' }))
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Página de login')).toBeInTheDocument()
  })

  it('highlights Apoiar CTA and hides badge when not a supporter', () => {
    useAuth.mockReturnValue(
      createAuthMock({
        doctor: makeDoctor({ supporter_status: 'none' }),
      }),
    )

    renderHeader(<AppHeader showNav />)

    expect(screen.getAllByRole('link', { name: 'Apoiar' }).length).toBeGreaterThan(
      0,
    )
    expect(screen.queryByText('Apoiador')).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Apoiar' })[0]).toHaveClass(
      'bg-brand',
    )
  })

  it('uses active CTA style for Apoiar when on support route', () => {
    useAuth.mockReturnValue(
      createAuthMock({
        doctor: makeDoctor({ supporter_status: 'none' }),
      }),
    )

    renderHeader(<AppHeader showNav />, { route: '/apoiar' })

    expect(screen.getAllByRole('link', { name: 'Apoiar' })[0]).toHaveClass(
      'bg-brand-dark',
    )
  })

  it('shows Apoiador badge and keeps Apoiar nav when supporter', () => {
    useAuth.mockReturnValue(
      createAuthMock({
        doctor: makeDoctor({
          supporter_status: 'active',
          supporter_product_id: 'support_50',
        }),
      }),
    )

    renderHeader(<AppHeader showNav />)

    expect(screen.getByText('Apoiador')).toBeInTheDocument()
    expect(screen.getByText('Apoiador')).toHaveAttribute(
      'title',
      'GlicoDose 50 · R$50/mês',
    )
    expect(screen.getAllByRole('link', { name: 'Apoiar' }).length).toBeGreaterThan(
      0,
    )
    expect(screen.getAllByRole('link', { name: 'Apoiar' })[0]).not.toHaveClass(
      'bg-brand',
    )
  })
})
