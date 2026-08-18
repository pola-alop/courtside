import { useState, useEffect, useCallback } from 'react'
import { useAuthState } from './useAuth'
import {
  getOpponents, addOpponent, updateOpponent, deleteOpponent
} from '../firebase/opponents'
import { LEVEL_BY_ID, PLAYSTYLE_BY_ID } from '../lib/opponents'

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
      const cleaned = await sanitizeLegacyFields(user.uid, data)
      setOpponents(cleaned)
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

// Livello e stile di gioco erano campi di testo libero prima del passaggio al
// vocabolario controllato (src/lib/opponents.js): un valore salvato prima
// della migrazione non può comparire nei nuovi dropdown, quindi va azzerato
// una volta sola così l'utente lo rivalorizza dalle nuove liste — è la
// migrazione richiesta esplicitamente, non un caso limite da ignorare.
// Idempotente: dopo la pulizia i valori sono null o già dentro il
// vocabolario, quindi le chiamate successive non trovano più nulla da fare.
async function sanitizeLegacyFields(userId, opponents) {
  const isDirty = o => (o.level && !LEVEL_BY_ID[o.level]) || (o.playstyle && !PLAYSTYLE_BY_ID[o.playstyle])
  const dirty = opponents.filter(isDirty)
  if (dirty.length === 0) return opponents

  const cleanedFields = o => ({
    level:     LEVEL_BY_ID[o.level]         ? o.level     : null,
    playstyle: PLAYSTYLE_BY_ID[o.playstyle] ? o.playstyle : null,
  })

  await Promise.all(dirty.map(o => updateOpponent(userId, o.id, cleanedFields(o))))

  const dirtyIds = new Set(dirty.map(o => o.id))
  return opponents.map(o => dirtyIds.has(o.id) ? { ...o, ...cleanedFields(o) } : o)
}
