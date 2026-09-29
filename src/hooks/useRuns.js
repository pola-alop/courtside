import { useState, useEffect, useCallback } from 'react'
import { useAuthState } from './useAuth'
import { getRuns, addRun, updateRun, deleteRun } from '../firebase/runs'

export function useRuns() {
  const { user } = useAuthState()
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const data = await getRuns(user.uid)
      setRuns(data)
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
    await addRun(user.uid, data)
    await load()
  }

  const update = async (runId, data) => {
    await updateRun(user.uid, runId, data)
    await load()
  }

  const remove = async (runId) => {
    await deleteRun(user.uid, runId)
    await load()
  }

  return { runs, loading, error, add, update, remove, reload: load }
}
