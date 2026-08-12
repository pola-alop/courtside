import { useState, useEffect, useCallback } from 'react'
import { useAuthState } from './useAuth'
import { getUserProfile, updateUserProfile } from '../firebase/profile'

export function useProfile() {
  const { user } = useAuthState()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const data = await getUserProfile(user.uid)
      setProfile(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    ;(async () => { await load() })()
  }, [load])

  const update = async (data) => {
    const merged = { ...profile, ...data }
    await updateUserProfile(user.uid, merged)
    await load()
  }

  return { profile, loading, error, update, reload: load }
}
