import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { DoctorProfileForm } from '../components/DoctorProfileForm'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { updateDoctorProfile } from '../lib/doctorsApi'
import { displayPlanLabel } from '../lib/supportProducts'
import {
  isDoctorSupporter,
  type DoctorProfileFields,
} from '../types/database'

export function ProfilePage() {
  const { doctor, refreshDoctor } = useAuth()
  const navigate = useNavigate()

  if (!doctor) return null

  async function handleSubmit(fields: DoctorProfileFields) {
    await updateDoctorProfile(doctor!, fields)
    await refreshDoctor()
  }

  const supporter = isDoctorSupporter(doctor)

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

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-semibold text-ink">Apoiar o GlicoDose</p>
            <p className="mt-1 text-sm text-muted">
              {supporter
                ? `Você é apoiador${
                    doctor.supporter_product_id
                      ? ` · ${displayPlanLabel(doctor.supporter_product_id)}`
                      : ''
                  }.`
                : 'Assinatura mensal opcional para manter o projeto funcionando.'}
            </p>
          </div>
          <Button
            variant={supporter ? 'secondary' : 'primary'}
            onClick={() => navigate('/apoiar')}
          >
            {supporter ? 'Ver planos' : 'Quero apoiar'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

