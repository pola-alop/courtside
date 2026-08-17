import { useState, useEffect, useCallback } from 'react'
import { useAuthState } from './useAuth'
import {
  getOpponents, addOpponent, updateOpponent, deleteOpponent
} from '../firebase/opponents'

export function useOpponents() {
  const { user } = useAuthState()
  const [opponents, setOpponents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const data = await getOpponents(user.uid)
      setOpponents(data)
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
    await addOpponent(user.uid, data)
    await load()
  }

  const update = async (opponentId, data) => {
    await updateOpponent(user.uid, opponentId, data)
    await load()
  }

  const remove = async (opponentId) => {
    await deleteOpponent(user.uid, opponentId)
    await load()
  }

  return { opponents, loading, error, add, update, remove, reload: load }
}
