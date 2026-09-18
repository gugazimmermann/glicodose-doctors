import { afterEach, describe, expect, it, vi } from 'vitest'

const createClient = vi.fn(() => ({ from: vi.fn() }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClient(...args),
}))

describe('supabase client module', () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    createClient.mockClear()
  })

  it('throws when env vars are missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    await expect(import('./supabase')).rejects.toThrow(
      /VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY/,
    )
  })

  it('creates client when env vars are set', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
    const mod = await import('./supabase')
    expect(createClient).toHaveBeenCalledWith('http://localhost:54321', 'anon')
    expect(mod.supabase).toBeTruthy()
  })
})
