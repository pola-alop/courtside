import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthState } from './hooks/useAuth'
import BottomNav from './components/BottomNav'
import Login from './pages/Login'

// Pagine autenticate caricate on-demand: ogni pagina (e le sue dipendenze
// pesanti, es. `catalog.json` in Equipment) finisce in un chunk separato,
// fuori dal bundle iniziale.
const Home      = lazy(() => import('./pages/Home'))
const Matches   = lazy(() => import('./pages/Matches'))
const Equipment = lazy(() => import('./pages/Equipment'))
const Stats     = lazy(() => import('./pages/Stats'))
const Profile   = lazy(() => import('./pages/Profile'))

// `inShell`: dentro `main` riempie lo spazio che c'è, senza `min-h-screen`
// (altrimenti `main` scorrerebbe anche solo per mostrare il caricamento).
function Spinner({ inShell = false }) {
  return (
    <div className={`flex items-center justify-center ${inShell ? 'h-full' : 'min-h-screen'}`}
         style={{ background: 'var(--color-bg)' }}>
      <div className="text-center">
        <div className="w-8 h-8 rounded-full border-2 animate-spin mx-auto mb-3"
             style={{ borderColor: 'var(--color-teal-dark)', borderTopColor: 'transparent' }} />
        <p className="text-sm"
           style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          Loading...
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuthState()

  if (loading) return <Spinner />

  if (!user) return <Login />

  return (
    // La shell è alta quanto la finestra (`app-screen`, in index.css) e a scorrere è `main`, non il documento:
    // la barra di scorrimento nasce e muore tra il bordo alto e la nav, che è un
    // elemento normale in fondo alla colonna (non più `fixed` sopra il contenuto).
    <div className="app-screen flex flex-col overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <main className="flex-1 min-h-0 overflow-y-auto">
        <Suspense fallback={<Spinner inShell />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/matches" element={<Matches />} />
            <Route path="/equipment" element={<Equipment />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <BottomNav />
    </div>
  )
}