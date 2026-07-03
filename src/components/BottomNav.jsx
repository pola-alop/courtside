import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/',          icon: '⬡',  label: 'Home'      },
  { to: '/matches',   icon: '🎾', label: 'Matches'   },
  { to: '/equipment', icon: '🎒', label: 'Gear'      },
  { to: '/stats',     icon: '📊', label: 'Stats'     },
  { to: '/profile',   icon: '👤', label: 'Profile'   },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-3"
         style={{ background: 'var(--color-bg)', borderTop: '1px solid var(--color-surface-2)' }}>
      <div className="flex justify-around items-center max-w-md mx-auto">
        {tabs.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1 rounded-2xl transition-all ${
                isActive ? 'opacity-100' : 'opacity-40'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="text-xl">{icon}</span>
                <span className="text-xs font-medium"
                      style={{
                        fontFamily: 'var(--font-display)',
                        color: isActive ? 'var(--color-volt)' : 'var(--color-slate)'
                      }}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}