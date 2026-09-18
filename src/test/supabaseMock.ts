import { vi } from 'vitest'

type ThenableResult = {
  data: unknown
  error: unknown
  count?: number | null
}

/** Build a thenable query chain used by Supabase client mocks. */
export function createQueryBuilder(result: ThenableResult = { data: [], error: null, count: 0 }) {
  const builder: Record<string, unknown> = {}
  const methods = [
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    'eq',
    'neq',
    'gte',
    'lte',
    'order',
    'range',
    'limit',
    'maybeSingle',
    'single',
  ]

  for (const method of methods) {
    builder[method] = vi.fn(() => builder)
  }

  builder.then = (onFulfilled: (value: ThenableResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)

  return builder
}

export function createSupabaseMock(options?: {
  fromResult?: ThenableResult
  auth?: Partial<{
    getSession: ReturnType<typeof vi.fn>
    getUser: ReturnType<typeof vi.fn>
    signInWithPassword: ReturnType<typeof vi.fn>
    signUp: ReturnType<typeof vi.fn>
    signOut: ReturnType<typeof vi.fn>
    onAuthStateChange: ReturnType<typeof vi.fn>
  }>
  rpcResult?: ThenableResult
  storageSignedUrl?: { data: { signedUrl: string } | null; error: unknown }
}) {
  const fromBuilder = createQueryBuilder(options?.fromResult ?? { data: [], error: null, count: 0 })
  const unsubscribe = vi.fn()

  return {
    from: vi.fn(() => fromBuilder),
    rpc: vi.fn().mockResolvedValue(options?.rpcResult ?? { data: null, error: null }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe } },
      })),
      ...options?.auth,
    },
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn().mockResolvedValue(
          options?.storageSignedUrl ?? {
            data: { signedUrl: 'https://example.com/photo.jpg' },
            error: null,
          },
        ),
      })),
    },
    _fromBuilder: fromBuilder,
    _unsubscribe: unsubscribe,
  }
}
