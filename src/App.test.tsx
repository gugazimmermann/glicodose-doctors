import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createAuthMock, makeSession } from './test/renderWithProviders'
import { makeDoctor } from './test/fixtures'

const auth = createAuthMock({ session: null, doctor: null, user: null, loading: true })

vi.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => auth,
}))

vi.mock('./lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => unknown) =>
        resolve({ data: [], error: null }),
    })),
  },
}))

import App from './App'

describe('App', () => {
  it('shows login when unauthenticated after loading', async () => {
    Object.assign(
      auth,
      createAuthMock({ session: null, doctor: null, user: null, loading: false }),
    )
    render(<App />)
    expect(await screen.findByText('GlicoDose Médicos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('shows patients shell when authenticated with complete profile', async () => {
    Object.assign(
      auth,
      createAuthMock({
        session: makeSession(),
        doctor: makeDoctor(),
        loading: false,
      }),
    )
    render(<App />)
    await waitFor(() =>
      expect(screen.getAllByText('Pacientes').length).toBeGreaterThan(0),
    )
  })
})
