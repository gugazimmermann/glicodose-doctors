import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AppShell } from './components/AppShell'
import { ProtectedRoute } from './components/ProtectedRoute'
import { RequireCompleteProfile } from './components/RequireCompleteProfile'
import { LoginPage } from './pages/LoginPage'
import { PatientsPage } from './pages/PatientsPage'
import { LinkPatientPage } from './pages/LinkPatientPage'
import { PatientDetailPage } from './pages/PatientDetailPage'
import { CompleteProfilePage } from './pages/CompleteProfilePage'
import { ProfilePage } from './pages/ProfilePage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="completar-perfil" element={<CompleteProfilePage />} />
            <Route element={<RequireCompleteProfile />}>
              <Route element={<AppShell />}>
                <Route index element={<PatientsPage />} />
                <Route path="vincular" element={<LinkPatientPage />} />
                <Route path="perfil" element={<ProfilePage />} />
                <Route
                  path="pacientes/:patientId"
                  element={<PatientDetailPage />}
                />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
