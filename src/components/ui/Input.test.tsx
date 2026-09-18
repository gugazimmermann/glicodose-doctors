import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Input, Label, Select } from './Input'

describe('Label', () => {
  it('renders default density with optional hint', () => {
    render(
      <Label htmlFor="nome" hint="opcional">
        Nome
      </Label>,
    )
    expect(screen.getByText('Nome')).toBeInTheDocument()
    expect(screen.getByText('(opcional)')).toBeInTheDocument()
  })

  it('renders stacked density with subtitle', () => {
    render(
      <Label density="stacked" subtitle="mg/dL" htmlFor="meta">
        Meta
      </Label>,
    )
    expect(screen.getByText('Meta')).toBeInTheDocument()
    expect(screen.getByText('mg/dL')).toBeInTheDocument()
  })

  it('renders stacked density without subtitle', () => {
    render(
      <Label density="stacked" htmlFor="meta">
        Meta
      </Label>,
    )
    expect(screen.getByText('Meta')).toBeInTheDocument()
  })
})

describe('Input', () => {
  it('renders and accepts typed value', async () => {
    const user = userEvent.setup()
    render(<Input aria-label="CRM" defaultValue="" />)
    const input = screen.getByRole('textbox', { name: 'CRM' })
    await user.type(input, '123456')
    expect(input).toHaveValue('123456')
  })
})

describe('Select', () => {
  it('renders options and allows selection', async () => {
    const user = userEvent.setup()
    render(
      <Select aria-label="UF" defaultValue="SP">
        <option value="SP">SP</option>
        <option value="RJ">RJ</option>
      </Select>,
    )
    const select = screen.getByRole('combobox', { name: 'UF' })
    expect(select).toHaveValue('SP')
    await user.selectOptions(select, 'RJ')
    expect(select).toHaveValue('RJ')
  })
})
