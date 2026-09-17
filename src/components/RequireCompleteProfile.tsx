import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isDoctorProfileComplete } from '../types/database'

export function RequireCompleteProfile() {
  const { doctor, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Carregando…
      </div>
    )
  }

  if (!isDoctorProfileComplete(doctor)) {
    return <Navigate to="/completar-perfil" replace />
  }

  return <Outlet />
}
