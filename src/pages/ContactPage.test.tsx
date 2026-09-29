import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  createAuthMock,
  makeSession,
  renderWithRouter,
} from '../test/renderWithProviders'
import { makeDoctor } from '../test/fixtures'

const useAuth = vi.fn()
const sendDoctorContactMessage = vi.fn()

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => useAuth(),
}))

vi.mock('../lib/contactApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/contactApi')>(
    '../lib/contactApi',
  )
  return {
    ...actual,
    sendDoctorContactMessage: (...args: unknown[]) =>
      sendDoctorContactMessage(...args),
  }
})

import { ContactPage } from './ContactPage'

describe('ContactPage', () => {
  beforeEach(() => {
    sendDoctorContactMessage.mockReset()
    useAuth.mockReturnValue(createAuthMock())
  })

  it('shows the signed-in doctor and sends type plus message', async () => {
    const user = userEvent.setup()
    sendDoctorContactMessage.mockResolvedValue(undefined)

    renderWithRouter(<ContactPage />, { route: '/contato' })

    expect(screen.getByRole('heading', { name: 'Contato' })).toBeInTheDocument()
    expect(screen.getByText('Dr. Teste')).toBeInTheDocument()
    expect(screen.getByText('doc@test.com')).toBeInTheDocument()
    expect(screen.getByText('123456/SP')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'contato@glicodose.app' }),
    ).toHaveAttribute('href', 'mailto:contato@glicodose.app')

    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()

    await user.selectOptions(screen.getByLabelText('Tipo'), 'Sugestão')
    await user.type(
      screen.getByLabelText('Mensagem'),
      'Um atalho no histórico.',
    )
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(sendDoctorContactMessage).toHaveBeenCalledWith({
      name: 'Dr. Teste',
      email: 'doc@test.com',
      category: 'Sugestão',
      message: 'Um atalho no histórico.',
      crm: '123456/SP',
    })
    expect(await screen.findByText(/Mensagem enviada/)).toBeInTheDocument()
    expect(screen.getByLabelText('Mensagem')).toHaveValue('')

    await user.click(screen.getByRole('button', { name: 'Enviar outra' }))
    expect(screen.queryByText(/Mensagem enviada/)).not.toBeInTheDocument()
  })

  it('ignores submit when the type is still empty', async () => {
    const user = userEvent.setup()
    renderWithRouter(<ContactPage />, { route: '/contato' })

    await user.selectOptions(screen.getByLabelText('Tipo'), 'Outro')
    await user.selectOptions(screen.getByLabelText('Tipo'), '')
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar' }).closest('form')!)

    expect(sendDoctorContactMessage).not.toHaveBeenCalled()
  })

  it('shows a spinner while the message is sending', async () => {
    const user = userEvent.setup()
    let finish: () => void = () => {}
    sendDoctorContactMessage.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )

    renderWithRouter(<ContactPage />, { route: '/contato' })

    await user.selectOptions(screen.getByLabelText('Tipo'), 'Dúvida')
    await user.type(screen.getByLabelText('Mensagem'), 'Como vinculo um paciente?')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
    finish()
    expect(await screen.findByText(/Mensagem enviada/)).toBeInTheDocument()
  })

  it('shows a generic error when the failure is not an Error', async () => {
    const user = userEvent.setup()
    sendDoctorContactMessage.mockRejectedValue('falhou')

    renderWithRouter(<ContactPage />, { route: '/contato' })

    await user.selectOptions(screen.getByLabelText('Tipo'), 'Ideia')
    await user.type(screen.getByLabelText('Mensagem'), 'Texto livre.')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(
      await screen.findByText(
        'Não foi possível enviar a mensagem. Tente novamente.',
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(
      screen.queryByText('Não foi possível enviar a mensagem. Tente novamente.'),
    ).not.toBeInTheDocument()
  })

  it('renders nothing without a doctor profile', () => {
    useAuth.mockReturnValue(createAuthMock({ doctor: null }))
    const { container } = renderWithRouter(<ContactPage />, { route: '/contato' })
    expect(container).toBeEmptyDOMElement()
  })

  it('omits CRM when the profile has none', () => {
    useAuth.mockReturnValue(
      createAuthMock({
        doctor: makeDoctor({ crm: null, crm_uf: null }),
      }),
    )

    renderWithRouter(<ContactPage />, { route: '/contato' })

    expect(screen.queryByText('CRM')).not.toBeInTheDocument()
  })

  it('shows the send error', async () => {
    const user = userEvent.setup()
    sendDoctorContactMessage.mockRejectedValue(
      new Error('Não foi possível enviar a mensagem. Tente novamente.'),
    )

    renderWithRouter(<ContactPage />, { route: '/contato' })

    await user.selectOptions(screen.getByLabelText('Tipo'), 'Reclamação')
    await user.type(screen.getByLabelText('Mensagem'), 'A lista não abre.')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(
      await screen.findByText(
        'Não foi possível enviar a mensagem. Tente novamente.',
      ),
    ).toBeInTheDocument()
  })

  it('blocks send when the account has no email', async () => {
    const user = userEvent.setup()
    const session = makeSession()
    session.user.email = undefined
    useAuth.mockReturnValue(createAuthMock({ session }))

    renderWithRouter(<ContactPage />, { route: '/contato' })

    expect(screen.getByText('Sem e-mail na conta')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()

    await user.selectOptions(screen.getByLabelText('Tipo'), 'Ideia')
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar' }).closest('form')!)
    expect(sendDoctorContactMessage).not.toHaveBeenCalled()
  })
})
