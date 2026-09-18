import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  it('renders title', () => {
    render(<PageHeader title="Pacientes" />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Pacientes' }),
    ).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(
      <PageHeader
        title="Pacientes"
        description="Lista de pacientes vinculados."
      />,
    )
    expect(
      screen.getByText('Lista de pacientes vinculados.'),
    ).toBeInTheDocument()
  })

  it('renders action when provided', () => {
    render(
      <PageHeader
        title="Pacientes"
        action={<button type="button">Novo</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Novo' })).toBeInTheDocument()
  })

  it('renders children above the title', () => {
    render(
      <PageHeader title="Detalhe">
        <p>Voltar</p>
      </PageHeader>,
    )
    expect(screen.getByText('Voltar')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Detalhe' }),
    ).toBeInTheDocument()
  })
})
