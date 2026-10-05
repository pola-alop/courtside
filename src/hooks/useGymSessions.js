import { useState, useEffect, useCallback } from 'react'
import { useAuthState } from './useAuth'
import { getGymSessions, addGymSession, updateGymSession, deleteGymSession } from '../firebase/gymSessions'

export function useGymSessions() {
  const { user } = useAuthState()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const data = await getGymSessions(user.uid)
      setSessions(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    ;(async () => { await load() })()
  }, [load])

  const add = async (data) => {
    await addGymSession(user.uid, data)
    await load()
  }

  const update = async (sessionId, data) => {
    await updateGymSession(user.uid, sessionId, data)
    await load()
  }

  const remove = async (sessionId) => {
    await deleteGymSession(user.uid, sessionId)
    await load()
  }

  return { sessions, loading, error, add, update, remove, reload: load }
}
