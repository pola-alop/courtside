import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthState } from './useAuth'
import {
  getTeamCompetitions, addTeamCompetition, updateTeamCompetition, deleteTeamCompetition,
} from '../firebase/teamCompetitions'
import { readCompetition, withResult, withoutResult } from '../lib/teamCompetitions'

export function useTeamCompetitions() {
  const { user } = useAuthState()
  const [competitions, setCompetitions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // L'elenco più recente, letto da `setResult`/`clearResult`: due scritture
  // ravvicinate non devono partire dallo stesso array vecchio.
  const competitionsRef = useRef([])

  const load = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const data = await getTeamCompetitions(user.uid)
      const normalized = data.map(readCompetition)
      competitionsRef.current = normalized
      setCompetitions(normalized)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    ;(async () => { await load() })()
  }, [load])

  // Ritorna l'id della competizione creata, per aprirla subito.
  const add = async (data) => {
    const ref = await addTeamCompetition(user.uid, data)
    await load()
    return ref.id
  }

  const update = async (competitionId, data) => {
    await updateTeamCompetition(user.uid, competitionId, data)
    await load()
  }

  // Segna (o riscrive) il risultato di uno scontro tra altre squadre.
  // `entry`: { a, b, leg, scoreA, scoreB, sets, games }.
  const setResult = async (competitionId, entry) => {
    const competition = competitionsRef.current.find(c => c.id === competitionId)
    if (!competition) return
    await updateTeamCompetition(user.uid, competitionId, { results: withResult(competition.results, entry) })
    await load()
  }

  const clearResult = async (competitionId, a, b, leg) => {
    const competition = competitionsRef.current.find(c => c.id === competitionId)
    if (!competition) return
    await updateTeamCompetition(user.uid, competitionId, { results: withoutResult(competition.results, a, b, leg) })
    await load()
  }

  const remove = async (competitionId) => {
    await deleteTeamCompetition(user.uid, competitionId)
    await load()
  }

  return { competitions, loading, error, add, update, setResult, clearResult, remove, reload: load }
}
