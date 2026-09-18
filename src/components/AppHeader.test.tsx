import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
})
