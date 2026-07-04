import { signOut } from 'firebase/auth'
import { auth } from '../firebase/config'

export default function Profile() {
  const handleLogout = async () => {
    await signOut(auth)
  }

  return (
    <div className="px-6 pt-8">
      <h1 className="text-2xl font-bold mb-8"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-white)' }}>
        Profile
      </h1>

      <button
        onClick={handleLogout}
        className="w-full py-4 rounded-2xl font-semibold text-base transition-transform active:scale-95"
        style={{
          background: 'var(--color-surface)',
          color: '#e05555',
          fontFamily: 'var(--font-display)',
          border: '1px solid var(--color-surface-2)'
        }}
      >
        Sign out
      </button>
    </div>
  )
}