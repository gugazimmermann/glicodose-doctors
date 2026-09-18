import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createAuthMock, makeSession } from '../test/renderWithProviders'
import { makeDoctor } from '../test/fixtures'

const auth = createAuthMock({ session: null, doctor: null, user: null })
const fromMock = vi.fn()

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => auth,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

import { LoginPage } from './LoginPage'

function renderLogin(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>Home</div>} />
        <Route path="/completar-perfil" element={<div>Complete</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    Object.assign(auth, createAuthMock({ session: null, doctor: null, user: null }))
    fromMock.mockReset()
  })

  it('shows spinner while loading', () => {
    auth.loading = true
    renderLogin()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('redirects complete doctor to home', () => {
    Object.assign(auth, createAuthMock())
    renderLogin()
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('redirects incomplete doctor to completar-perfil', () => {
    Object.assign(
      auth,
      createAuthMock({
        doctor: makeDoctor({ profile_completed_at: null }),
      }),
    )
    renderLogin()
    expect(screen.getByText('Complete')).toBeInTheDocument()
  })

  it('signs in on submit', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText('E-mail'), 'a@b.com')
    await user.type(screen.getByLabelText('Senha'), 'secret1')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(auth.signIn).toHaveBeenCalledWith('a@b.com', 'secret1')
  })

  it('requires name on signup and maps auth errors', async () => {
    const user = userEvent.setup()
    auth.signUp.mockRejectedValueOnce(new Error('User already registered'))
    renderLogin()
    await user.click(screen.getByRole('tab', { name: 'Cadastrar' }))
    await user.type(screen.getByLabelText('E-mail'), 'a@b.com')
    await user.type(screen.getByLabelText('Senha'), 'secret1')
    fireEvent.submit(screen.getByRole('button', { name: 'Criar conta' }).closest('form')!)
    expect(screen.getByRole('alert')).toHaveTextContent('Informe seu nome.')

    await user.type(screen.getByLabelText('Nome completo'), 'Dr Test')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Este e-mail já está cadastrado.',
      )
    })
  })

  it('maps invalid login and password errors', async () => {
    const user = userEvent.setup()
    auth.signIn
      .mockRejectedValueOnce(new Error('Invalid login credentials'))
      .mockRejectedValueOnce(new Error('Password should be longer'))
      .mockRejectedValueOnce('weird')
      .mockRejectedValueOnce(new Error('custom message'))
    renderLogin()
    await user.type(screen.getByLabelText('E-mail'), 'a@b.com')
    await user.type(screen.getByLabelText('Senha'), 'secret1')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'E-mail ou senha incorretos.',
      ),
    )

    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'A senha precisa ter pelo menos 6 caracteres.',
      ),
    )

    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Algo deu errado. Tente novamente.',
      ),
    )

    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('custom message'),
    )
  })

  it('completes orphan doctor profile via upsert', async () => {
    const user = userEvent.setup()
    const session = makeSession()
    Object.assign(
      auth,
      createAuthMock({ session, doctor: null, user: session.user }),
    )
    const upsert = vi.fn().mockResolvedValue({ error: null })
    fromMock.mockReturnValue({ upsert })

    renderLogin({ needDoctorProfile: true })
    expect(screen.getByText(/Informe seu nome para concluir/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Nome completo'), 'Dr Novo')
    await user.click(screen.getByRole('button', { name: 'Concluir perfil' }))
    await waitFor(() => expect(auth.refreshDoctor).toHaveBeenCalled())
    expect(upsert).toHaveBeenCalled()
  })

  it('shows error when upsert fails and allows signOut', async () => {
    const user = userEvent.setup()
    const session = makeSession()
    Object.assign(
      auth,
      createAuthMock({ session, doctor: null, user: session.user }),
    )
    fromMock.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: new Error('db fail') }),
    })
    renderLogin({ needDoctorProfile: true })
    await user.type(screen.getByLabelText('Nome completo'), 'Dr Novo')
    await user.click(screen.getByRole('button', { name: 'Concluir perfil' }))
    await waitFor(() =>
      expect(screen.getByText('db fail')).toBeInTheDocument(),
    )
    await user.click(screen.getByRole('button', { name: 'Usar outra conta' }))
    expect(auth.signOut).toHaveBeenCalled()
  })

  it('validates empty name on complete profile', async () => {
    const session = makeSession()
    Object.assign(
      auth,
      createAuthMock({ session, doctor: null, user: session.user }),
    )
    renderLogin({ needDoctorProfile: true })
    fireEvent.submit(
      screen.getByRole('button', { name: 'Concluir perfil' }).closest('form')!,
    )
    expect(screen.getByText('Informe seu nome.')).toBeInTheDocument()
  })

  it('detects needDoctor from session without location state', () => {
    const session = makeSession()
    Object.assign(
      auth,
      createAuthMock({ session, doctor: null, user: session.user }),
    )
    renderLogin()
    expect(
      screen.getByText(/Informe seu nome para concluir/),
    ).toBeInTheDocument()
  })

  it('returns early when completing profile without user id', async () => {
    Object.assign(
      auth,
      createAuthMock({
        session: { ...makeSession(), user: undefined } as never,
        doctor: null,
        user: null,
      }),
    )
    renderLogin({ needDoctorProfile: true })
    fireEvent.submit(
      screen.getByRole('button', { name: 'Concluir perfil' }).closest('form')!,
    )
    expect(fromMock).not.toHaveBeenCalled()
  })
})
