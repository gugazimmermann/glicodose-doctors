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
})
