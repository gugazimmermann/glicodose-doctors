import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Doctor } from '../types/database'

type AuthContextValue = {
  session: Session | null
  user: User | null
  doctor: Doctor | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => Promise<void>
  refreshDoctor: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchDoctor(userId: string): Promise<Doctor | null> {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data as Doctor | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshDoctor = useCallback(async () => {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) {
      setDoctor(null)
      return
    }
    setDoctor(await fetchDoctor(userId))
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) {
        try {
          setDoctor(await fetchDoctor(data.session.user.id))
        } catch {
          setDoctor(null)
        }
      }
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        setSession(nextSession)
        if (nextSession?.user) {
          try {
            setDoctor(await fetchDoctor(nextSession.user.id))
          } catch {
            setDoctor(null)
          }
        } else {
          setDoctor(null)
        }
        setLoading(false)
      },
    )

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error

      const userId = data.user?.id
      if (!userId || !data.session) {
        throw new Error(
          'Conta criada. Confirme o e-mail (se exigido) e faça login para concluir o cadastro médico.',
        )
      }

      const { error: doctorError } = await supabase.from('doctors').insert({
        id: userId,
        full_name: fullName.trim(),
      })
      if (doctorError) throw doctorError

      setDoctor(await fetchDoctor(userId))
    },
    [],
  )

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setDoctor(null)
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      doctor,
      loading,
      signIn,
      signUp,
      signOut,
      refreshDoctor,
    }),
    [session, doctor, loading, signIn, signUp, signOut, refreshDoctor],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
