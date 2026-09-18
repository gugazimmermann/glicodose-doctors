import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isDoctorProfileComplete } from '../types/database'
import { FullPageSpinner } from './ui/Spinner'

export function RequireCompleteProfile() {
  const { doctor, loading } = useAuth()

  if (loading) {
    return <FullPageSpinner />
  }

  if (!isDoctorProfileComplete(doctor)) {
    return <Navigate to="/completar-perfil" replace />
  }

  return <Outlet />
}
