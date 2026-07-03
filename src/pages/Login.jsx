import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '../firebase/config'
import { initUserData } from '../firebase/initUser'

export default function Login() {
  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      await initUserData(result.user)
    } catch (error) {
      console.error('Login error:', error)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6"
         style={{ background: 'var(--color-bg)' }}>

      {/* Logo / Title */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-6"
             style={{ background: 'var(--color-volt)' }}>
          <span className="text-4xl">🎾</span>
        </div>
        <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-white)' }}>
          Courtside
        </h1>
        <p className="text-base" style={{ color: 'var(--color-slate)' }}>
          Your personal tennis companion
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm rounded-3xl p-8"
           style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
        <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          Welcome back
        </h2>
        <p className="text-sm mb-8" style={{ color: 'var(--color-slate)' }}>
          Sign in to access your matches, gear, and stats.
        </p>

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-base transition-transform active:scale-95"
          style={{
            background: 'var(--color-volt)',
            color: '#0A0A0A',
            fontFamily: 'var(--font-display)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#0A0A0A" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#0A0A0A" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#0A0A0A" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#0A0A0A" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
      </div>

      <p className="text-xs mt-8 text-center" style={{ color: 'var(--color-surface-2)' }}>
        Your data is stored privately in your Firebase account.
      </p>
    </div>
  )
}