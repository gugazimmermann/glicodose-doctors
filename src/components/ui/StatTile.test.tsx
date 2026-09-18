import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatTile } from './StatTile'

describe('StatTile', () => {
  it('renders comfortable density with hint', () => {
    render(
      <StatTile
        label="Média"
        value="120"
        hint="mg/dL"
        density="comfortable"
      />,
    )
    expect(screen.getByText('Média')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('mg/dL')).toBeInTheDocument()
    expect(screen.getByText('120')).toHaveClass('text-base')
  })

  it('renders compact density without hint even when provided', () => {
    render(
      <StatTile
        label="Dose"
        value="4 U"
        hint="não deve aparecer"
        density="compact"
      />,
    )
    expect(screen.getByText('Dose')).toBeInTheDocument()
    expect(screen.getByText('4 U')).toBeInTheDocument()
    expect(screen.queryByText('não deve aparecer')).not.toBeInTheDocument()
    expect(screen.getByText('4 U')).toHaveClass('text-sm')
  })
})
