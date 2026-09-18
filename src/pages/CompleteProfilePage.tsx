import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { AppHeader } from '../components/AppHeader'
import { DoctorProfileForm } from '../components/DoctorProfileForm'
import { PageHeader } from '../components/ui/PageHeader'
import { updateDoctorProfile } from '../lib/doctorsApi'
import {
  isDoctorProfileComplete,
  type DoctorProfileFields,
} from '../types/database'

export function CompleteProfilePage() {
  const { doctor, refreshDoctor } = useAuth()
  const navigate = useNavigate()

  // Session/doctor already guaranteed by ProtectedRoute parent.
  if (!doctor) return null

  if (isDoctorProfileComplete(doctor)) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(fields: DoctorProfileFields) {
    await updateDoctorProfile(doctor!, fields)
    await refreshDoctor()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden">
      <AppHeader showNav={false} brandAsLink={false} doctorName={doctor.full_name} />

      <main className="mx-auto w-full min-w-0 max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader
          title="Complete seu perfil"
          description="Informe seus dados profissionais e o endereço do consultório para continuar."
        />

        <DoctorProfileForm
          doctor={doctor}
          submitLabel="Salvar e continuar"
          onSubmit={handleSubmit}
        />
      </main>
    </div>
  )
}
