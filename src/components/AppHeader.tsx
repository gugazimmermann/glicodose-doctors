import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { BrandLogo } from './BrandLogo'
import { Button } from './ui/Button'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-lg px-3 py-1.5 text-sm font-medium no-underline transition',
    isActive
      ? 'bg-brand-soft text-brand-dark'
      : 'text-muted hover:bg-card hover:text-ink',
  ].join(' ')

function MainNav({ className = '' }: { className?: string }) {
  return (
    <nav className={`flex flex-wrap gap-1 ${className}`.trim()} aria-label="Principal">
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
  )
}

type AppHeaderProps = {
  showNav?: boolean
  brandAsLink?: boolean
  doctorName?: string | null
}

export function AppHeader({
  showNav = true,
  brandAsLink = true,
  doctorName,
}: AppHeaderProps) {
  const { doctor, signOut } = useAuth()
  const navigate = useNavigate()
  const name = doctorName ?? doctor?.full_name

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const brandInner = (
    <>
      <BrandLogo size={40} className="shrink-0 shadow-sm" />
      <div className="min-w-0">
        <p
          className={[
            'truncate text-sm font-semibold tracking-tight text-ink sm:text-base',
            brandAsLink ? 'group-hover:text-brand-dark' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          GlicoDose Médicos
        </p>
        <p className="truncate text-xs text-muted">{name}</p>
      </div>
    </>
  )

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-card/90 backdrop-blur-md">
      <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          {brandAsLink ? (
            <Link
              to="/"
              className="group flex min-w-0 flex-1 items-center gap-3 no-underline lg:flex-none lg:max-w-xs"
            >
              {brandInner}
            </Link>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none lg:max-w-xs">
              {brandInner}
            </div>
          )}

          {showNav ? <MainNav className="hidden lg:flex" /> : null}

          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={() => void handleSignOut()}
          >
            Sair
          </Button>
        </div>

        {showNav ? <MainNav className="mt-3 lg:hidden" /> : null}
      </div>
    </header>
  )
}
