import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createAuthMock } from '../test/renderWithProviders'
import { makeDoctor, makeDoctorFields } from '../test/fixtures'

const auth = createAuthMock({
  doctor: makeDoctor({ profile_completed_at: null }),
})
const updateDoctorProfile = vi.fn().mockResolvedValue(undefined)

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => auth,
}))

vi.mock('../lib/doctorsApi', () => ({
  updateDoctorProfile: (...args: unknown[]) => updateDoctorProfile(...args),
}))

vi.mock('../components/DoctorProfileForm', () => ({
  DoctorProfileForm: ({
    submitLabel,
    onSubmit,
  }: {
    submitLabel: string
    onSubmit: (f: ReturnType<typeof makeDoctorFields>) => Promise<void>
  }) => (
    <button
      type="button"
      onClick={() => void onSubmit(makeDoctorFields())}
    >
      {submitLabel}
    </button>
  ),
}))

import { CompleteProfilePage } from './CompleteProfilePage'
import { ProfilePage } from './ProfilePage'

describe('CompleteProfilePage', () => {
  beforeEach(() => {
    Object.assign(
      auth,
      createAuthMock({ doctor: makeDoctor({ profile_completed_at: null }) }),
    )
    updateDoctorProfile.mockClear()
  })

  it('returns null without doctor', () => {
    auth.doctor = null
    const { container } = render(
      <MemoryRouter>
        <CompleteProfilePage />
      </MemoryRouter>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('redirects when already complete', () => {
    auth.doctor = makeDoctor()
    render(
      <MemoryRouter initialEntries={['/completar-perfil']}>
        <Routes>
          <Route path="/completar-perfil" element={<CompleteProfilePage />} />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('submits profile and navigates home', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/completar-perfil']}>
        <Routes>
          <Route path="/completar-perfil" element={<CompleteProfilePage />} />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Salvar e continuar' }))
    expect(updateDoctorProfile).toHaveBeenCalled()
    expect(auth.refreshDoctor).toHaveBeenCalled()
    expect(await screen.findByText('Home')).toBeInTheDocument()
  })
})

describe('ProfilePage', () => {
  beforeEach(() => {
    Object.assign(auth, createAuthMock())
    updateDoctorProfile.mockClear()
  })

  it('returns null without doctor', () => {
    auth.doctor = null
    const { container } = render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('saves profile changes', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Dados profissionais de/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(updateDoctorProfile).toHaveBeenCalled()
    expect(auth.refreshDoctor).toHaveBeenCalled()
  })

  it('navigates to support page for non-supporter', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/perfil']}>
        <Routes>
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/apoiar" element={<div>Página apoiar</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(
      screen.getByText(
        'Assinatura mensal opcional para manter o projeto funcionando.',
      ),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quero apoiar' }))
    expect(await screen.findByText('Página apoiar')).toBeInTheDocument()
  })

  it('shows supporter copy with plan and navigates to plans', async () => {
    const user = userEvent.setup()
    Object.assign(
      auth,
      createAuthMock({
        doctor: makeDoctor({
          supporter_status: 'active',
          supporter_product_id: 'support_50',
        }),
      }),
    )

    render(
      <MemoryRouter initialEntries={['/perfil']}>
        <Routes>
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/apoiar" element={<div>Página apoiar</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(
      screen.getByText('Você é apoiador · GlicoDose 50 · R$50/mês.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver planos' }))
    expect(await screen.findByText('Página apoiar')).toBeInTheDocument()
  })

  it('shows supporter copy without plan when product is missing', () => {
    Object.assign(
      auth,
      createAuthMock({
        doctor: makeDoctor({
          supporter_status: 'active',
          supporter_product_id: null,
        }),
      }),
    )

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Você é apoiador.')).toBeInTheDocument()
  })
})
