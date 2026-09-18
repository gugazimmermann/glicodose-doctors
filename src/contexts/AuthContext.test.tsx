import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { makeDoctor } from '../test/fixtures'
import { makeSession } from '../test/renderWithProviders'
import { createQueryBuilder } from '../test/supabaseMock'

const getSession = vi.fn()
const getUser = vi.fn()
const signInWithPassword = vi.fn()
const signUp = vi.fn()
const signOut = vi.fn()
const onAuthStateChange = vi.fn()
const fromMock = vi.fn()
const unsubscribe = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    auth: {
      getSession: (...args: unknown[]) => getSession(...args),
      getUser: (...args: unknown[]) => getUser(...args),
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      signUp: (...args: unknown[]) => signUp(...args),
      signOut: (...args: unknown[]) => signOut(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChange(...args),
    },
  },
}))

import { AuthProvider, useAuth } from './AuthContext'

function Probe() {
  const auth = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(auth.loading)}</span>
      <span data-testid="doctor">{auth.doctor?.full_name ?? 'none'}</span>
      <span data-testid="user">{auth.user?.id ?? 'none'}</span>
      <button type="button" onClick={() => void auth.signIn('a@b.com', 'x')}>
        in
      </button>
      <button
        type="button"
        onClick={() => void auth.signUp('a@b.com', 'secret1', 'Dr A')}
      >
        up
      </button>
      <button type="button" onClick={() => void auth.signOut()}>
        out
      </button>
      <button type="button" onClick={() => void auth.refreshDoctor()}>
        refresh
      </button>
    </div>
  )
}

describe('AuthContext', () => {
  let authCallback: (event: string, session: unknown) => void

  beforeEach(() => {
    getSession.mockReset()
    getUser.mockReset()
    signInWithPassword.mockReset()
    signUp.mockReset()
    signOut.mockReset()
    fromMock.mockReset()
    unsubscribe.mockReset()
    authCallback = () => {}
    onAuthStateChange.mockImplementation((cb) => {
      authCallback = cb
      return { data: { subscription: { unsubscribe } } }
    })
    getSession.mockResolvedValue({ data: { session: null } })
    getUser.mockResolvedValue({ data: { user: null } })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('throws outside provider', () => {
    expect(() => render(<Probe />)).toThrow(
      'useAuth must be used within AuthProvider',
    )
  })

  it('loads session and doctor', async () => {
    const session = makeSession()
    const doctor = makeDoctor()
    getSession.mockResolvedValue({ data: { session } })
    fromMock.mockReturnValue(createQueryBuilder({ data: doctor, error: null }))

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    )
    expect(screen.getByTestId('doctor')).toHaveTextContent('Dr. Teste')
    expect(screen.getByTestId('user')).toHaveTextContent('doctor-1')
  })

  it('sets doctor null when fetch fails', async () => {
    const session = makeSession()
    getSession.mockResolvedValue({ data: { session } })
    fromMock.mockReturnValue(
      createQueryBuilder({ data: null, error: { message: 'x' } }),
    )

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    )
    expect(screen.getByTestId('doctor')).toHaveTextContent('none')
  })

  it('handles auth state changes and sign methods', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    signInWithPassword.mockResolvedValue({ error: null })
    signOut.mockResolvedValue({ error: null })
    getUser.mockResolvedValue({
      data: { user: { id: 'doctor-1' } },
    })
    fromMock.mockReturnValue(
      createQueryBuilder({ data: makeDoctor(), error: null }),
    )

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    )

    await act(async () => {
      await authCallback('SIGNED_IN', makeSession())
    })
    await waitFor(() =>
      expect(screen.getByTestId('doctor')).toHaveTextContent('Dr. Teste'),
    )

    await act(async () => {
      await authCallback('SIGNED_OUT', null)
    })
    await waitFor(() =>
      expect(screen.getByTestId('doctor')).toHaveTextContent('none'),
    )

    await act(async () => {
      screen.getByText('in').click()
    })
    expect(signInWithPassword).toHaveBeenCalled()

    await act(async () => {
      screen.getByText('out').click()
    })
    expect(signOut).toHaveBeenCalled()

    await act(async () => {
      screen.getByText('refresh').click()
    })
    await waitFor(() => expect(getUser).toHaveBeenCalled())
  })

  it('signUp inserts doctor or throws when confirmation required', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    signUp.mockResolvedValueOnce({
      data: { user: { id: 'u1' }, session: null },
      error: null,
    })

    let caught: unknown
    function Catcher() {
      const { signUp: doSignUp } = useAuth()
      return (
        <button
          type="button"
          onClick={() => {
            void doSignUp('a@b.com', 'secret1', 'Dr A').catch((e) => {
              caught = e
            })
          }}
        >
          up
        </button>
      )
    }

    render(
      <AuthProvider>
        <Catcher />
      </AuthProvider>,
    )
    await waitFor(() => screen.getByText('up'))

    await act(async () => {
      screen.getByText('up').click()
    })
    await waitFor(() =>
      expect(String(caught)).toMatch(/Confirme o e-mail/),
    )

    const session = makeSession('u2')
    signUp.mockResolvedValueOnce({
      data: { user: session.user, session },
      error: null,
    })
    const insertBuilder = createQueryBuilder({ data: null, error: null })
    fromMock.mockReturnValue(insertBuilder)

    caught = undefined
    await act(async () => {
      screen.getByText('up').click()
    })
    await waitFor(() => expect(insertBuilder.insert).toHaveBeenCalled())
  })

  it('refreshDoctor clears doctor when there is no user', async () => {
    getSession.mockResolvedValue({ data: { session: makeSession() } })
    fromMock.mockReturnValue(
      createQueryBuilder({ data: makeDoctor(), error: null }),
    )
    getUser.mockResolvedValue({ data: { user: null } })

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() =>
      expect(screen.getByTestId('doctor')).toHaveTextContent('Dr. Teste'),
    )

    await act(async () => {
      screen.getByText('refresh').click()
    })
    await waitFor(() =>
      expect(screen.getByTestId('doctor')).toHaveTextContent('none'),
    )
  })

  it('sets doctor null when auth change fetch fails', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    fromMock.mockReturnValue(
      createQueryBuilder({ data: null, error: { message: 'fail' } }),
    )

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    )

    await act(async () => {
      await authCallback('SIGNED_IN', makeSession())
    })
    await waitFor(() =>
      expect(screen.getByTestId('doctor')).toHaveTextContent('none'),
    )
  })

  it('throws on signUp auth error and doctor insert error', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    signUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: new Error('signup fail'),
    })

    let caught: unknown
    function Catcher() {
      const { signUp: doSignUp } = useAuth()
      return (
        <button
          type="button"
          onClick={() => {
            void doSignUp('a@b.com', 'x', 'N').catch((e) => {
              caught = e
            })
          }}
        >
          failup
        </button>
      )
    }

    render(
      <AuthProvider>
        <Catcher />
      </AuthProvider>,
    )
    await waitFor(() => screen.getByText('failup'))
    await act(async () => {
      screen.getByText('failup').click()
    })
    await waitFor(() => expect(caught).toEqual(new Error('signup fail')))

    const session = makeSession('u3')
    signUp.mockResolvedValueOnce({
      data: { user: session.user, session },
      error: null,
    })
    fromMock.mockReturnValue(
      createQueryBuilder({ data: null, error: new Error('insert fail') }),
    )
    caught = undefined
    await act(async () => {
      screen.getByText('failup').click()
    })
    await waitFor(() => expect(caught).toEqual(new Error('insert fail')))
  })

  it('throws on signOut error', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    signOut.mockResolvedValue({ error: new Error('out fail') })
    let caught: unknown
    function Catcher() {
      const { signOut: doOut } = useAuth()
      return (
        <button
          type="button"
          onClick={() => {
            void doOut().catch((e) => {
              caught = e
            })
          }}
        >
          failout
        </button>
      )
    }
    render(
      <AuthProvider>
        <Catcher />
      </AuthProvider>,
    )
    await waitFor(() => screen.getByText('failout'))
    await act(async () => {
      screen.getByText('failout').click()
    })
    await waitFor(() => expect(caught).toEqual(new Error('out fail')))
  })

  it('ignores getSession result after unmount', async () => {
    let resolveSession!: (v: unknown) => void
    getSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve
      }),
    )
    const { unmount } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    unmount()
    await act(async () => {
      resolveSession({ data: { session: makeSession() } })
    })
    expect(unsubscribe).toHaveBeenCalled()
  })

  it('throws on signIn error', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    signInWithPassword.mockResolvedValue({ error: new Error('bad') })
    let caught: unknown
    function Catcher() {
      const { signIn } = useAuth()
      return (
        <button
          type="button"
          onClick={() => {
            void signIn('a', 'b').catch((e) => {
              caught = e
            })
          }}
        >
          failin
        </button>
      )
    }
    render(
      <AuthProvider>
        <Catcher />
      </AuthProvider>,
    )
    await waitFor(() => screen.getByText('failin'))
    await act(async () => {
      screen.getByText('failin').click()
    })
    await waitFor(() => expect(caught).toEqual(new Error('bad')))
  })
})
