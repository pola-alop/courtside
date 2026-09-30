import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuthState } from './useAuth'
import { buildExerciseIndex } from '../lib/gym'
import {
  getGymExercises, addGymExercise, updateGymExercise, deleteGymExercise
} from '../firebase/gymExercises'

// Esercizi personalizzati + l'indice completo (fissi e personalizzati) già
// costruito: è l'indice che le schede e le sessioni usano per risolvere gli id.
export function useGymExercises() {
  const { user } = useAuthState()
  const [custom, setCustom] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const data = await getGymExercises(user.uid)
      setCustom(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    ;(async () => { await load() })()
  }, [load])

  const index = useMemo(() => buildExerciseIndex(custom), [custom])

  // Ritorna l'id creato (serve a costruire `custom:<id>` e usare subito
  // l'esercizio nell'editor).
  const add = async (data) => {
    const id = await addGymExercise(user.uid, data)
    await load()
    return id
  }

  const update = async (exerciseId, data) => {
    await updateGymExercise(user.uid, exerciseId, data)
    await load()
  }

  const remove = async (exerciseId) => {
    await deleteGymExercise(user.uid, exerciseId)
    await load()
  }

  return { custom, index, loading, error, add, update, remove, reload: load }
}
