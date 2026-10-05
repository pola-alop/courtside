import { useState, useEffect, useCallback } from 'react'
import { useAuthState } from './useAuth'
import {
  getMatches, addMatch, updateMatch, deleteMatch
} from '../firebase/matches'
import { getOpponents } from '../firebase/opponents'

export function useMatches() {
  const { user } = useAuthState()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const [data, opponents] = await Promise.all([getMatches(user.uid), getOpponents(user.uid)])
      setMatches(await syncOpponentNames(user.uid, data, opponents))
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

// opponentName è copiato nella partita al momento del salvataggio, quindi
// rinominare un avversario nell'anagrafica lascerebbe il vecchio nome sulle
// partite già registrate. L'anagrafica è la fonte di verità: a ogni caricamento
// le partite con un nome diverso da quello dell'avversario collegato vengono
// riallineate (e salvate). Idempotente: dopo l'allineamento non c'è più nulla
// da fare. Le partite il cui avversario è stato eliminato restano com'erano.
async function syncOpponentNames(userId, matches, opponents) {
  const nameById = new Map(opponents.map(o => [o.id, o.name]))
  const stale = matches.filter(m => nameById.has(m.opponentId) && nameById.get(m.opponentId) !== m.opponentName)
  if (stale.length === 0) return matches

  await Promise.all(stale.map(m => updateMatch(userId, m.id, { opponentName: nameById.get(m.opponentId) })))

  const staleIds = new Set(stale.map(m => m.id))
  return matches.map(m => staleIds.has(m.id) ? { ...m, opponentName: nameById.get(m.opponentId) } : m)
}
