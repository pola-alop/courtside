import { useState, useEffect, useMemo } from 'react'
import { useAuthState } from './useAuth'
import { getFitDetails } from '../firebase/fitDetails'

// Dettagli di PIÙ file .FIT, letti a lotti per le statistiche di lap e serie
// (vedi src/lib/fitStats.js). Non fa nulla finché `enabled` è falso: il blocco
// che lo usa si apre con un tap, e solo allora parte la lettura.
//
// ── La cache è la fonte di verità ──
// Sta a livello di modulo, per utente e per `fitId`: cambiare periodo, tab o
// riaprire il blocco non rilegge i documenti già scaricati. Lo stato React è
// solo un contatore che fa rifare il render a ogni documento arrivato, così
// «n su m» avanza. Un documento assente vale `null` (la sessione ha il riassunto
// ma non i dettagli); un errore di rete vale FAILED e si ritenta alla prossima
// apertura, non resta in cache per sempre.

const CONCURRENCY = 6
const FAILED = Symbol('failed')
const cache = new Map()

const keyOf = (uid, fitId) => `${uid}/${fitId}`

export function useFitDetailsBatch(fitIds, enabled) {
  const { user } = useAuthState()
  const [, setTick] = useState(0)

  // Una chiave stringa e non l'array: il chiamante ne costruisce uno nuovo a ogni
  // render, e come dipendenza dell'effetto rilancerebbe la lettura all'infinito.
  const idsKey = (fitIds || []).join('|')
  const ids = useMemo(() => (idsKey ? idsKey.split('|') : []), [idsKey])

  useEffect(() => {
    if (!enabled || !user || ids.length === 0) return
    let cancelled = false
    const todo = ids.filter(id => {
      const k = keyOf(user.uid, id)
      if (cache.get(k) === FAILED) cache.delete(k)
      return !cache.has(k)
    })
    let next = 0
    const worker = async () => {
      while (!cancelled && next < todo.length) {
        const id = todo[next++]
        let value
        try { value = await getFitDetails(user.uid, id) } catch { value = FAILED }
        cache.set(keyOf(user.uid, id), value)
        if (!cancelled) setTick(t => t + 1)
      }
    }
    for (let i = 0; i < Math.min(CONCURRENCY, todo.length); i++) worker()
    return () => { cancelled = true }
  }, [enabled, user, ids])

  const byId = {}
  let done = 0, failed = 0
  if (enabled && user) {
    ids.forEach(id => {
      const v = cache.get(keyOf(user.uid, id))
      if (v === undefined) return
      done++
      if (v === FAILED) failed++
      else byId[id] = v
    })
  }
  return { byId, done, total: ids.length, failed, loading: enabled && done < ids.length }
}
