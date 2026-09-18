import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandLogo } from './BrandLogo'

describe('BrandLogo', () => {
  it('renders the GlicoDose image with default size', () => {
    render(<BrandLogo />)
    const img = screen.getByRole('img', { name: 'GlicoDose' })
    expect(img).toHaveAttribute('src', '/glucosemeter.png')
    expect(img).toHaveAttribute('width', '40')
    expect(img).toHaveAttribute('height', '40')
  })

  it('applies custom size and className', () => {
    render(<BrandLogo size={64} className="shadow-sm" />)
    const img = screen.getByRole('img', { name: 'GlicoDose' })
    expect(img).toHaveAttribute('width', '64')
    expect(img).toHaveAttribute('height', '64')
    expect(img).toHaveClass('shadow-sm')
    expect(img).toHaveClass('rounded-xl')
  })
})
