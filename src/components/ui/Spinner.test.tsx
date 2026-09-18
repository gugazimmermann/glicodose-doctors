import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FullPageSpinner, Skeleton, Spinner } from './Spinner'

describe('Spinner', () => {
  it('renders default Portuguese label', () => {
    render(<Spinner />)
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
  })

  it('renders a custom label', () => {
    render(<Spinner label="Aguarde…" />)
    expect(screen.getByRole('status')).toHaveTextContent('Aguarde…')
  })
})

describe('FullPageSpinner', () => {
  it('wraps Spinner in a full-page container', () => {
    const { container } = render(<FullPageSpinner />)
    expect(container.firstChild).toHaveClass('min-h-screen')
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
  })
})

describe('Skeleton', () => {
  it('renders a decorative pulse block', () => {
    const { container } = render(<Skeleton className="h-8" />)
    const el = container.firstChild as HTMLElement
    expect(el).toHaveAttribute('aria-hidden')
    expect(el).toHaveClass('animate-pulse')
    expect(el).toHaveClass('h-8')
  })
})
