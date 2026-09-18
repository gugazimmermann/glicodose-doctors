import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { FullPageSpinner } from './ui/Spinner'

export function ProtectedRoute() {
  const { session, doctor, loading } = useAuth()

  if (loading) {
    return <FullPageSpinner />
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!doctor) {
    return <Navigate to="/login" replace state={{ needDoctorProfile: true }} />
  }

  return <Outlet />
}
