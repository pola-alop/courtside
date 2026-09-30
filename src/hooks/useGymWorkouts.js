import { useState, useEffect, useCallback } from 'react'
import { useAuthState } from './useAuth'
import {
  getGymWorkouts, addGymWorkout, updateGymWorkout, deleteGymWorkout
} from '../firebase/gymWorkouts'

export function useGymWorkouts() {
  const { user } = useAuthState()
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const data = await getGymWorkouts(user.uid)
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

  // Ritorna l'id della scheda appena creata, che il wizard collega alla
  // sessione (stessa eccezione di useRunWorkouts).
  const add = async (data) => {
    const id = await addGymWorkout(user.uid, data)
    await load()
    return id
  }

  const update = async (workoutId, data) => {
    await updateGymWorkout(user.uid, workoutId, data)
    await load()
  }

  const remove = async (workoutId) => {
    await deleteGymWorkout(user.uid, workoutId)
    await load()
  }

  return { workouts, loading, error, add, update, remove, reload: load }
}
