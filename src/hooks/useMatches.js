import { useState, useEffect, useCallback } from 'react'
import { useAuthState } from './useAuth'
import {
  getMatches, addMatch, updateMatch, deleteMatch
} from '../firebase/matches'
import { getOpponents } from '../firebase/opponents'
import { getUserProfile } from '../firebase/profile'
import { opponentShortName, opponentSurname } from '../lib/opponents'
import { isDoubles, expectedOpponentName, joinNames, doublesGenders } from '../lib/doubles'
import { doublesCategory, readGender } from '../lib/gender'

export function useMatches() {
  const { user } = useAuthState()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      // Il profilo serve solo al genere dell'utente, per la categoria dei doppi
      // (letto in parallelo: un documento in più a ogni caricamento).
      const [data, opponents, profile] = await Promise.all([getMatches(user.uid), getOpponents(user.uid), getUserProfile(user.uid)])
      const synced = await syncOpponentNames(user.uid, data, opponents)
      setMatches(withDerivedNames(synced, opponents, readGender(profile?.gender)))
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
// le partite con un nome diverso da quello atteso vengono riallineate (e
// salvate). Il nome atteso è quello dell'avversario nel singolo e «Rossi /
// Bianchi» nel doppio (`expectedOpponentName`). Idempotente: dopo l'allineamento
// non c'è più nulla da fare. Le partite con un giocatore che l'anagrafica non
// conosce più restano com'erano.
async function syncOpponentNames(userId, matches, opponents) {
  const nameById = new Map(opponents.map(o => [o.id, o.name]))
  const fixes = new Map()
  matches.forEach(m => {
    const expected = expectedOpponentName(m, nameById)
    if (expected != null && expected !== m.opponentName) fixes.set(m.id, expected)
  })
  if (fixes.size === 0) return matches

  await Promise.all([...fixes].map(([id, opponentName]) => updateMatch(userId, id, { opponentName })))

  return matches.map(m => fixes.has(m.id) ? { ...m, opponentName: fixes.get(m.id) } : m)
}

// I nomi per il punteggio si derivano dall'anagrafica per id, come il nome
// aggiornato: non sono campi del documento e non vengono mai salvati (niente
// nuove copie da riallineare). Vivono solo sulle partite in memoria.
//  · singolo: `opponentShort` ("Di Gaetano M.");
//  · doppio: `opponentShort` ("Rossi / Bianchi", solo cognomi), `partnerShort`,
//    `partnerName` e `category` (maschile / femminile / misto, null se manca
//    un genere: serve anche quello dell'utente).
// Senza i giocatori in anagrafica i campi mancano e ScoreBoard ripiega su
// `opponentName`.
function withDerivedNames(matches, opponents, userGender) {
  const byId = new Map(opponents.map(o => [o.id, o]))
  const genderById = new Map(opponents.map(o => [o.id, readGender(o.gender)]))

  return matches.map(m => {
    if (!isDoubles(m)) {
      const opponent = byId.get(m.opponentId)
      return opponent ? { ...m, opponentShort: opponentShortName(opponent) } : m
    }
    const partner = byId.get(m.partnerId)
    const faced = (m.opponentIds || []).map(id => byId.get(id))
    return {
      ...m,
      opponentShort: faced.length > 0 && faced.every(Boolean) ? joinNames(faced.map(opponentSurname)) : undefined,
      partnerShort: partner ? opponentSurname(partner) : undefined,
      partnerName: partner?.name,
      category: doublesCategory(doublesGenders(m, genderById, userGender)),
    }
  })
}
