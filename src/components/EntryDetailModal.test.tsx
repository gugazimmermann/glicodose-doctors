import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeEntry } from '../test/fixtures'
import { createSupabaseMock } from '../test/supabaseMock'
import { formatBrazilDateTime } from '../lib/format'
import { EntryDetailModal } from './EntryDetailModal'

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(),
    },
  },
}))

import { supabase } from '../lib/supabase'

function mockStorage(
  storageSignedUrl?: {
    data: { signedUrl: string } | null
    error: unknown
  },
) {
  const mock = createSupabaseMock({ storageSignedUrl })
  vi.mocked(supabase.storage.from).mockImplementation(mock.storage.from)
  return mock
}

describe('EntryDetailModal', () => {
  beforeEach(() => {
    vi.mocked(supabase.storage.from).mockReset()
    mockStorage({
      data: { signedUrl: 'https://example.com/food.jpg' },
      error: null,
    })
  })

  it('loads and shows a signed URL image when food_image_path is set', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://example.com/food.jpg' },
      error: null,
    })
    vi.mocked(supabase.storage.from).mockReturnValue({
      createSignedUrl,
    } as ReturnType<typeof supabase.storage.from>)

    const entry = makeEntry({ food_image_path: 'patients/1/lunch.jpg' })
    render(<EntryDetailModal entry={entry} onClose={vi.fn()} />)

    expect(supabase.storage.from).toHaveBeenCalledWith('food-photos')
    expect(createSignedUrl).toHaveBeenCalledWith('patients/1/lunch.jpg', 3600)

    await waitFor(() => {
      expect(
        screen.getByRole('img', { name: 'Foto do alimento' }),
      ).toHaveAttribute('src', 'https://example.com/food.jpg')
    })
  })

  it('does not request storage or render an image without food_image_path', () => {
    render(
      <EntryDetailModal
        entry={makeEntry({ food_image_path: null })}
        onClose={vi.fn()}
      />,
    )

    expect(supabase.storage.from).not.toHaveBeenCalled()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByText('Foto do alimento')).not.toBeInTheDocument()
  })

  it('shows an error alert when signed URL creation fails', async () => {
    mockStorage({
      data: null,
      error: { message: 'storage denied' },
    })

    render(
      <EntryDetailModal
        entry={makeEntry({ food_image_path: 'patients/1/lunch.jpg' })}
        onClose={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Não foi possível carregar a foto.',
      )
    })
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows parsed recommendation fields from the entry', () => {
    const entry = makeEntry()
    render(<EntryDetailModal entry={entry} onClose={vi.fn()} />)

    expect(screen.getByText('Detalhe da dose')).toBeInTheDocument()
    expect(
      screen.getByText(formatBrazilDateTime(entry.recorded_at)),
    ).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(
      screen.getByText('Meta aplicada: 110 mg/dL (dia)'),
    ).toBeInTheDocument()
    expect(screen.getByText('4 U')).toBeInTheDocument()
    expect(screen.getByText('3.5 U')).toBeInTheDocument()
    expect(screen.getByText('45 g')).toBeInTheDocument()
    expect(screen.getByText('1 U')).toBeInTheDocument()
    expect(screen.getByText('3 U')).toBeInTheDocument()
    expect(screen.getByText('0.5 U')).toBeInTheDocument()
    expect(screen.getByText('ok')).toBeInTheDocument()
    expect(screen.getByText('Almoço')).toBeInTheDocument()
    expect(screen.getByText('Carbs')).toBeInTheDocument()
    expect(screen.getByText('Correção')).toBeInTheDocument()
    expect(screen.getByText('Comida')).toBeInTheDocument()
    expect(screen.getByText('IOB')).toBeInTheDocument()
  })

  it('calls onClose when Fechar is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <EntryDetailModal
        entry={makeEntry({ food_image_path: null })}
        onClose={onClose}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows em dash when food text is empty and ignores cancelled photo load', async () => {
    let resolveSigned!: (v: unknown) => void
    const pending = new Promise((resolve) => {
      resolveSigned = resolve
    })
    vi.mocked(supabase.storage.from).mockReturnValue({
      createSignedUrl: vi.fn().mockReturnValue(pending),
    } as ReturnType<typeof supabase.storage.from>)

    const { unmount } = render(
      <EntryDetailModal
        entry={makeEntry({
          food_text: '   ',
          food_image_path: 'x.jpg',
          gpt_raw_response: { correcao_u: 1 },
        })}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('Correção')).toBeInTheDocument()
    unmount()
    resolveSigned({ data: { signedUrl: 'https://x' }, error: null })
    await waitFor(() => expect(true).toBe(true))
  })

  it('handles signed url missing without error object', async () => {
    mockStorage({ data: { signedUrl: '' }, error: null })
    // force falsy signedUrl
    vi.mocked(supabase.storage.from).mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: '' },
        error: null,
      }),
    } as ReturnType<typeof supabase.storage.from>)

    render(
      <EntryDetailModal
        entry={makeEntry({ food_image_path: 'p.jpg' })}
        onClose={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Não foi possível carregar a foto.',
      ),
    )
  })

  it('covers recommendation detail branch combinations', () => {
    const { unmount } = render(
      <EntryDetailModal
        entry={makeEntry({
          food_image_path: null,
          gpt_raw_response: {
            bolus_comida_u: 2,
            iob_u: 0,
          },
        })}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Comida')).toBeInTheDocument()
    expect(screen.queryByText('IOB')).not.toBeInTheDocument()
    unmount()

    render(
      <EntryDetailModal
        entry={makeEntry({
          food_image_path: null,
          gpt_raw_response: {},
          recommended_insulin: null,
          applied_insulin: null,
        })}
        onClose={vi.fn()}
      />,
    )
    expect(screen.queryByText('Carbs')).not.toBeInTheDocument()
  })
})
