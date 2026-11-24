import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthState } from './useAuth'
import { getTeamTies, addTeamTie, updateTeamTie, deleteTeamTie } from '../firebase/teamTies'
import { readFormula, withRubberResult } from '../lib/teamTies'

export function useTeamTies() {
  const { user } = useAuthState()
  const [ties, setTies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // L'elenco più recente, letto da `setRubber`: due scritture ravvicinate su
  // incontri diversi non devono partire dallo stesso array vecchio.
  const tiesRef = useRef([])

  const load = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const data = await getTeamTies(user.uid)
      const normalized = data.map(t => ({
        ...t,
        formula: readFormula(t.formula),
        rubbers: Array.isArray(t.rubbers) ? t.rubbers : [],
        home: t.home === true || t.home === false ? t.home : null,
      }))
      tiesRef.current = normalized
      setTies(normalized)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    ;(async () => { await load() })()
  }, [load])

  // Ritorna l'id dello scontro creato, per aprirlo subito (come i gruppi).
  const add = async (data) => {
    const ref = await addTeamTie(user.uid, data)
    await load()
    return ref.id
  }

  const update = async (tieId, data) => {
    await updateTeamTie(user.uid, tieId, data)
    await load()
  }

  // Segna (o toglie, con `winner` null) l'esito di un incontro giocato da un
  // compagno. Riscrive l'array: è la sola scrittura che lo tocca.
  const setRubber = async (tieId, slot, winner, score = null) => {
    const tie = tiesRef.current.find(t => t.id === tieId)
    if (!tie) return
    await updateTeamTie(user.uid, tieId, { rubbers: withRubberResult(tie.rubbers, slot, winner, score) })
    await load()
  }

  const remove = async (tieId) => {
    await deleteTeamTie(user.uid, tieId)
    await load()
  }

  return { ties, loading, error, add, update, setRubber, remove, reload: load }
}
