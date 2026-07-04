import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthState } from './hooks/useAuth'
import BottomNav from './components/BottomNav'
import Home from './pages/Home'
import Matches from './pages/Matches'
import Equipment from './pages/Equipment'
import Stats from './pages/Stats'
import Profile from './pages/Profile'
import Login from './pages/Login'

export default function App() {
  const { user, loading } = useAuthState()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen"
           style={{ background: 'var(--color-bg)' }}>
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-2 animate-spin mx-auto mb-3"
               style={{
                 borderColor: 'var(--color-teal-dark)',
                 borderTopColor: 'transparent'
               }} />
          <p className="text-sm"
             style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
            Loading...
          </p>
        </div>
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <main className="flex-1 pb-24">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/equipment" element={<Equipment />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}