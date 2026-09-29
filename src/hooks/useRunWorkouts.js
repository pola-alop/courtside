import { useState, useEffect, useCallback } from 'react'
import { useAuthState } from './useAuth'
import {
  getRunWorkouts, addRunWorkout, updateRunWorkout, deleteRunWorkout
} from '../firebase/runWorkouts'

export function useRunWorkouts() {
  const { user } = useAuthState()
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const data = await getRunWorkouts(user.uid)
      setWorkouts(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    ;(async () => { await load() })()
  }, [load])

  // Unica mutazione che ritorna qualcosa: l'id della scheda appena creata,
  // che il wizard corsa collega alla sessione.
  const add = async (data) => {
    const id = await addRunWorkout(user.uid, data)
    await load()
    return id
  }

  const update = async (workoutId, data) => {
    await updateRunWorkout(user.uid, workoutId, data)
    await load()
  }

  const remove = async (workoutId) => {
    await deleteRunWorkout(user.uid, workoutId)
    await load()
  }

  return { workouts, loading, error, add, update, remove, reload: load }
}
