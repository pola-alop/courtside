import { useState, useEffect, useCallback } from 'react'
import { useAuthState } from './useAuth'
import {
  getMatches, addMatch, updateMatch, deleteMatch
} from '../firebase/matches'

export function useMatches() {
  const { user } = useAuthState()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const data = await getMatches(user.uid)
      setMatches(data)
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
    await addMatch(user.uid, data)
    await load()
  }

  const update = async (matchId, data) => {
    await updateMatch(user.uid, matchId, data)
    await load()
  }

  const remove = async (matchId) => {
    await deleteMatch(user.uid, matchId)
    await load()
  }

  return { matches, loading, error, add, update, remove, reload: load }
}
