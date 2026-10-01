import { useState, useEffect } from 'react'
import { useAuthState } from './useAuth'
import { getFitDetails } from '../firebase/fitDetails'

// Dettagli di UN file importato (serie, lap, traccia), letti quando si apre il
// dettaglio di una sessione. Senza `fitId` non fa niente. Una sessione
// importata prima che i dettagli esistessero, o con i dettagli persi, mostra
// semplicemente il riassunto: `details` resta null.
export function useFitDetail(fitId) {
  const { user } = useAuthState()
  const [state, setState] = useState({ fitId: null, details: null })

  useEffect(() => {
    if (!user || !fitId) return
    let cancelled = false
    ;(async () => {
      let details
      try { details = await getFitDetails(user.uid, fitId) } catch { details = null }
      if (!cancelled) setState({ fitId, details })
    })()
    return () => { cancelled = true }
  }, [user, fitId])

  // Il risultato appartiene al fitId richiesto: cambiando sessione non si
  // mostrano per un istante i dettagli della precedente.
  const ready = Boolean(fitId) && state.fitId === fitId
  return { details: ready ? state.details : null, loading: Boolean(fitId) && !ready }
}
