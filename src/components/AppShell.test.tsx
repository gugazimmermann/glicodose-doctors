import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAuthMock } from '../test/renderWithProviders'
import { AppShell } from './AppShell'

const useAuth = vi.fn()

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => useAuth(),
}))

describe('AppShell', () => {
  beforeEach(() => {
    useAuth.mockReturnValue(createAuthMock())
  })

  it('renders header and outlet content', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<div>Conteúdo da página</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('GlicoDose Médicos')).toBeInTheDocument()
    expect(screen.getByText('Conteúdo da página')).toBeInTheDocument()
    expect(screen.getByRole('main')).toContainElement(
      screen.getByText('Conteúdo da página'),
    )
  })
})
