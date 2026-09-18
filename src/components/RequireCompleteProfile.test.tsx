import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDoctor } from '../test/fixtures'
import { createAuthMock, type AuthMock } from '../test/renderWithProviders'
import { RequireCompleteProfile } from './RequireCompleteProfile'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../contexts/AuthContext'

const mockUseAuth = vi.mocked(useAuth)

function CompletarPerfilLocation() {
  const location = useLocation()
  return <span data-testid="location-path">{location.pathname}</span>
}

function renderGate(auth: AuthMock) {
  mockUseAuth.mockReturnValue(auth)
  return render(
    <MemoryRouter initialEntries={['/pacientes']}>
      <Routes>
        <Route element={<RequireCompleteProfile />}>
          <Route path="/pacientes" element={<div>Lista de pacientes</div>} />
        </Route>
        <Route path="/completar-perfil" element={<CompletarPerfilLocation />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireCompleteProfile', () => {
  beforeEach(() => {
    mockUseAuth.mockReset()
  })

  it('shows a full-page spinner while auth is loading', () => {
    renderGate(createAuthMock({ loading: true }))
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
  })

  it('redirects incomplete doctor profiles to /completar-perfil', () => {
    renderGate(
      createAuthMock({
        doctor: makeDoctor({ profile_completed_at: null }),
      }),
    )
    expect(screen.getByTestId('location-path')).toHaveTextContent(
      '/completar-perfil',
    )
    expect(screen.queryByText('Lista de pacientes')).not.toBeInTheDocument()
  })

  it('renders the Outlet child when the doctor profile is complete', () => {
    renderGate(createAuthMock({ doctor: makeDoctor() }))
    expect(screen.getByText('Lista de pacientes')).toBeInTheDocument()
  })
})
