import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAuthMock,
  makeSession,
  type AuthMock,
} from '../test/renderWithProviders'
import { ProtectedRoute } from './ProtectedRoute'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../contexts/AuthContext'

const mockUseAuth = vi.mocked(useAuth)

function LoginLocation() {
  const location = useLocation()
  const state = location.state as { needDoctorProfile?: boolean } | null
  return (
    <div>
      <span data-testid="location-path">{location.pathname}</span>
      <span data-testid="need-doctor-profile">
        {String(Boolean(state?.needDoctorProfile))}
      </span>
    </div>
  )
}

function renderProtected(auth: AuthMock) {
  mockUseAuth.mockReturnValue(auth)
  return render(
    <MemoryRouter initialEntries={['/app']}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<div>Área protegida</div>} />
        </Route>
        <Route path="/login" element={<LoginLocation />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockUseAuth.mockReset()
  })

  it('shows a full-page spinner while auth is loading', () => {
    renderProtected(createAuthMock({ loading: true }))
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
  })

  it('redirects to /login when there is no session', () => {
    renderProtected(
      createAuthMock({ session: null, user: null, doctor: null }),
    )
    expect(screen.getByTestId('location-path')).toHaveTextContent('/login')
    expect(screen.getByTestId('need-doctor-profile')).toHaveTextContent('false')
    expect(screen.queryByText('Área protegida')).not.toBeInTheDocument()
  })

  it('redirects to /login with needDoctorProfile when session has no doctor', () => {
    renderProtected(
      createAuthMock({
        session: makeSession(),
        doctor: null,
      }),
    )
    expect(screen.getByTestId('location-path')).toHaveTextContent('/login')
    expect(screen.getByTestId('need-doctor-profile')).toHaveTextContent('true')
  })

  it('renders the Outlet child when session and doctor are present', () => {
    renderProtected(createAuthMock())
    expect(screen.getByText('Área protegida')).toBeInTheDocument()
  })
})
