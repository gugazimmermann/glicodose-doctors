import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeDoctor } from '../test/fixtures'
import { DoctorProfileForm } from './DoctorProfileForm'

function disableNativeValidation() {
  const form = document.querySelector('form')
  if (form) form.noValidate = true
}

async function renderForm(
  doctor = makeDoctor(),
  onSubmit: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(undefined),
) {
  const user = userEvent.setup()
  render(
    <DoctorProfileForm
      doctor={doctor}
      submitLabel="Salvar perfil"
      onSubmit={onSubmit}
    />,
  )
  disableNativeValidation()
  return { user, onSubmit }
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Salvar perfil' }))
}

describe('DoctorProfileForm', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows Informe o CRM when CRM is empty', async () => {
    const { user } = await renderForm()
    await user.clear(screen.getByLabelText(/^CRM$/))
    await submit(user)
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o CRM.')
  })

  it('shows Selecione a UF do CRM when CRM UF is empty', async () => {
    const { user } = await renderForm(makeDoctor({ crm_uf: '' }))
    await user.selectOptions(screen.getByLabelText('UF do CRM'), '')
    await submit(user)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Selecione a UF do CRM.',
    )
  })

  it('shows phone validation error for short numbers', async () => {
    const { user } = await renderForm()
    const phone = screen.getByLabelText('Telefone / WhatsApp')
    await user.clear(phone)
    await user.type(phone, '11999')
    await submit(user)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Informe um telefone válido com DDD.',
    )
  })

  it('shows clinic name validation error when empty', async () => {
    const { user } = await renderForm()
    await user.clear(screen.getByLabelText('Consultório / clínica'))
    await submit(user)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Informe o nome do consultório.',
    )
  })

  it('shows specialty validation error when empty', async () => {
    const { user } = await renderForm()
    await user.clear(screen.getByLabelText('Especialidade'))
    await submit(user)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Informe a especialidade.',
    )
  })

  it('shows CEP validation error for incomplete CEP', async () => {
    const { user } = await renderForm()
    const cep = screen.getByLabelText('CEP')
    await user.clear(cep)
    await user.type(cep, '01310')
    await submit(user)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Informe um CEP válido (8 dígitos).',
    )
  })

  it('shows street validation error when empty', async () => {
    const { user } = await renderForm()
    await user.clear(screen.getByLabelText('Logradouro'))
    await submit(user)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Informe o logradouro.',
    )
  })

  it('shows number validation error when empty', async () => {
    const { user } = await renderForm()
    await user.clear(screen.getByLabelText('Número'))
    await submit(user)
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o número.')
  })

  it('shows neighborhood validation error when empty', async () => {
    const { user } = await renderForm()
    await user.clear(screen.getByLabelText('Bairro'))
    await submit(user)
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o bairro.')
  })

  it('shows city validation error when empty', async () => {
    const { user } = await renderForm()
    await user.clear(screen.getByLabelText('Cidade'))
    await submit(user)
    expect(screen.getByRole('alert')).toHaveTextContent('Informe a cidade.')
  })

  it('shows address UF validation error when empty', async () => {
    const { user } = await renderForm(makeDoctor({ address_state: '' }))
    await user.selectOptions(screen.getByLabelText(/^UF$/), '')
    await submit(user)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Selecione a UF do endereço.',
    )
  })

  it('applies phone mask while typing', async () => {
    const { user } = await renderForm(makeDoctor({ phone: '' }))
    const phone = screen.getByLabelText('Telefone / WhatsApp')
    await user.type(phone, '11988887766')
    expect(phone).toHaveValue('(11) 98888-7766')
  })

  it('maps null doctor fields and empty specialty to defaults', async () => {
    await renderForm(
      makeDoctor({
        crm: null,
        crm_uf: null,
        rqe: null,
        specialty: '   ',
        phone: null,
        clinic_name: null,
        address_cep: null,
        address_street: null,
        address_number: null,
        address_complement: null,
        address_neighborhood: null,
        address_city: null,
        address_state: null,
      }),
    )
    expect(screen.getByLabelText('Especialidade')).toHaveValue('Endocrinologia')
    expect(screen.getByLabelText(/^CRM$/)).toHaveValue('')
  })

  it('strips non-digits from CEP and limits to 8 digits', async () => {
    const { user } = await renderForm(makeDoctor({ address_cep: '' }))
    const cep = screen.getByLabelText('CEP')
    await user.type(cep, '01310-10099')
    expect(cep).toHaveValue('01310100')
  })

  it('calls onSubmit with trimmed fields on success', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { user } = await renderForm(
      makeDoctor({
        clinic_name: '',
        address_street: '',
        address_city: '',
      }),
      onSubmit,
    )

    await user.type(
      screen.getByLabelText('Consultório / clínica'),
      '  Clínica Nova  ',
    )
    await user.type(screen.getByLabelText('Logradouro'), '  Rua A  ')
    await user.type(screen.getByLabelText('Cidade'), '  Campinas  ')
    await submit(user)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        clinic_name: 'Clínica Nova',
        address_street: 'Rua A',
        address_city: 'Campinas',
        address_cep: '01310100',
        phone: '(11) 99888-7766',
      }),
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Dados salvos com sucesso.',
    )
  })

  it('shows onSubmit rejection message', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new Error('Falha ao salvar no servidor'))
    const { user } = await renderForm(makeDoctor(), onSubmit)
    await submit(user)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Falha ao salvar no servidor',
    )
  })

  it('shows generic error when onSubmit rejects with a non-Error', async () => {
    const onSubmit = vi.fn().mockRejectedValue('boom')
    const { user } = await renderForm(makeDoctor(), onSubmit)
    await submit(user)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível salvar.',
    )
  })

  it('clears the success message via useAutoClear after 5s', async () => {
    vi.useFakeTimers()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <DoctorProfileForm
        doctor={makeDoctor()}
        submitLabel="Salvar perfil"
        onSubmit={onSubmit}
      />,
    )
    disableNativeValidation()

    await act(async () => {
      fireEvent.submit(document.querySelector('form')!)
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Dados salvos com sucesso.',
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(
      screen.queryByText('Dados salvos com sucesso.'),
    ).not.toBeInTheDocument()
  })

  it('types optional RQE and complement, and dismisses success alert', async () => {
    const { user } = await renderForm()
    await user.type(screen.getByLabelText(/^RQE/), '12345')
    await user.type(screen.getByLabelText(/Complemento/), 'Sala 2')
    await submit(user)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Dados salvos com sucesso.',
    )
    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(
      screen.queryByText('Dados salvos com sucesso.'),
    ).not.toBeInTheDocument()
  })

  it('dismisses error alert', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('x'))
    const { user } = await renderForm(makeDoctor(), onSubmit)
    await submit(user)
    expect(screen.getByRole('alert')).toHaveTextContent('x')
    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByText('x')).not.toBeInTheDocument()
  })

  it('defaults specialty and applies landline phone mask', async () => {
    const { user } = await renderForm(
      makeDoctor({ specialty: null, phone: '' }),
    )
    expect(screen.getByLabelText('Especialidade')).toHaveValue(
      'Endocrinologia',
    )
    const phone = screen.getByLabelText('Telefone / WhatsApp')
    await user.type(phone, '1133334444')
    expect(phone).toHaveValue('(11) 3333-4444')
  })
})
