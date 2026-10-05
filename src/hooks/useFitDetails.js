import { useCallback } from 'react'
import { useAuthState } from './useAuth'
import { setFitDetails, deleteFitDetails } from '../firebase/fitDetails'

// Scrittura dei dettagli di un file .FIT importato. Nessuno stato e nessuna
// lista: i dettagli si salvano insieme alla sessione (vedi `commitFit` in
// Matches.jsx) e si leggono un documento alla volta con `useFitDetail`.
export function useFitDetails() {
  const { user } = useAuthState()

  const save = useCallback(async (details) => {
    await setFitDetails(user.uid, details.fitId, details)
  }, [user])

  const remove = useCallback(async (fitId) => {
    await deleteFitDetails(user.uid, fitId)
  }, [user])

  return { save, remove }
}
