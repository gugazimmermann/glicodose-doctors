import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { BrandLogo } from '../components/BrandLogo'
import { DoctorProfileForm } from '../components/DoctorProfileForm'
import {
  isDoctorProfileComplete,
  type DoctorProfileFields,
} from '../types/database'

export function CompleteProfilePage() {
  const { session, doctor, loading, refreshDoctor, signOut } = useAuth()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Carregando…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!doctor) {
    return <Navigate to="/login" replace state={{ needDoctorProfile: true }} />
  }

  if (isDoctorProfileComplete(doctor)) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(fields: DoctorProfileFields) {
    if (!doctor) return
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('doctors')
      .update({
        crm: fields.crm,
        crm_uf: fields.crm_uf,
        rqe: fields.rqe || null,
        specialty: fields.specialty,
        phone: fields.phone,
        clinic_name: fields.clinic_name,
        address_cep: fields.address_cep,
        address_street: fields.address_street,
        address_number: fields.address_number,
        address_complement: fields.address_complement || null,
        address_neighborhood: fields.address_neighborhood,
        address_city: fields.address_city,
        address_state: fields.address_state,
        profile_completed_at: doctor.profile_completed_at ?? now,
        updated_at: now,
      })
      .eq('id', doctor.id)

    if (error) throw error
    await refreshDoctor()
    navigate('/', { replace: true })
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line/80 bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <BrandLogo size={36} className="shadow-sm" />
            <div>
              <p className="text-sm font-semibold tracking-tight text-ink">
                GlicoDose Médicos
              </p>
              <p className="text-xs text-muted">{doctor.full_name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-medium text-muted transition hover:border-brand hover:text-brand"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Complete seu perfil
          </h1>
          <p className="mt-1 text-sm text-muted">
            Informe seus dados profissionais e o endereço do consultório para
            continuar.
          </p>
        </div>

        <DoctorProfileForm
          doctor={doctor}
          submitLabel="Salvar e continuar"
          onSubmit={handleSubmit}
        />
      </main>
    </div>
  )
}
