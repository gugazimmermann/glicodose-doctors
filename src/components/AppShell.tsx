import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { BrandLogo } from './BrandLogo'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-lg px-3 py-1.5 text-sm font-medium no-underline transition',
    isActive
      ? 'bg-brand-soft text-brand-dark'
      : 'text-muted hover:bg-card hover:text-ink',
  ].join(' ')

export function AppShell() {
  const { doctor, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line/80 bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-6">
            <Link to="/" className="group flex shrink-0 items-center gap-3 no-underline">
              <BrandLogo size={36} className="shadow-sm" />
              <div className="hidden min-[400px]:block">
                <p className="text-sm font-semibold tracking-tight text-ink group-hover:text-brand-dark">
                  GlicoDose Médicos
                </p>
                <p className="text-xs text-muted">{doctor?.full_name}</p>
              </div>
            </Link>
            <nav className="flex flex-wrap items-center gap-1" aria-label="Principal">
              <NavLink to="/" end className={navLinkClass}>
                Pacientes
              </NavLink>
              <NavLink to="/vincular" className={navLinkClass}>
                Vincular
              </NavLink>
              <NavLink to="/perfil" className={navLinkClass}>
                Perfil
              </NavLink>
            </nav>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-medium text-muted transition hover:border-brand hover:text-brand"
          >
            Sair
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
