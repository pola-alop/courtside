import { useState, useEffect, useCallback } from 'react'
import { useAuthState } from './useAuth'
import {
  getTrainings, addTraining, updateTraining, deleteTraining
} from '../firebase/trainings'

export function useTrainings() {
  const { user } = useAuthState()
  const [trainings, setTrainings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const data = await getTrainings(user.uid)
      setTrainings(data)
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
    await addTraining(user.uid, data)
    await load()
  }

  const update = async (trainingId, data) => {
    await updateTraining(user.uid, trainingId, data)
    await load()
  }

  const remove = async (trainingId) => {
    await deleteTraining(user.uid, trainingId)
    await load()
  }

  return { trainings, loading, error, add, update, remove, reload: load }
}
