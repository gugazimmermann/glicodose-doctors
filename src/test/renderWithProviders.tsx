import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom'
import type { ReactElement, ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { vi } from 'vitest'
import type { Doctor } from '../types/database'
import { makeDoctor } from './fixtures'

export type AuthMock = {
  session: Session | null
  user: User | null
  doctor: Doctor | null
  loading: boolean
  signIn: ReturnType<typeof vi.fn>
  signUp: ReturnType<typeof vi.fn>
  signOut: ReturnType<typeof vi.fn>
  refreshDoctor: ReturnType<typeof vi.fn>
}

export function makeSession(userId = 'doctor-1'): Session {
  return {
    access_token: 'token',
    refresh_token: 'refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: userId,
      email: 'doc@test.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2024-01-01T00:00:00.000Z',
    } as User,
  } as Session
}

export function createAuthMock(overrides: Partial<AuthMock> = {}): AuthMock {
  const session = overrides.session ?? makeSession()
  return {
    session,
    user: overrides.user ?? session?.user ?? null,
    doctor: overrides.doctor === undefined ? makeDoctor() : overrides.doctor,
    loading: false,
    signIn: vi.fn().mockResolvedValue(undefined),
    signUp: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    refreshDoctor: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

export function renderWithRouter(
  ui: ReactElement,
  {
    route = '/',
    routerProps,
    ...options
  }: RenderOptions & {
    route?: string
    routerProps?: Omit<MemoryRouterProps, 'children'>
  } = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[route]} {...routerProps}>
        {children}
      </MemoryRouter>
    )
  }

  return render(ui, { wrapper: Wrapper, ...options })
}
