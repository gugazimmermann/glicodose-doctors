import { useAuth } from '../contexts/AuthContext'
import { DoctorProfileForm } from '../components/DoctorProfileForm'
import { PageHeader } from '../components/ui/PageHeader'
import { updateDoctorProfile } from '../lib/doctorsApi'
import type { DoctorProfileFields } from '../types/database'

export function ProfilePage() {
  const { doctor, refreshDoctor } = useAuth()

  if (!doctor) return null

  async function handleSubmit(fields: DoctorProfileFields) {
    await updateDoctorProfile(doctor!, fields)
    await refreshDoctor()
  }

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <PageHeader
        title="Perfil"
        description={`Dados profissionais de ${doctor.full_name}.`}
      />

      <DoctorProfileForm
        key={doctor.updated_at}
        doctor={doctor}
        submitLabel="Salvar alterações"
        onSubmit={handleSubmit}
      />
    </div>
  )
}
