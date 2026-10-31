import { useState, useEffect, useCallback } from 'react'
import { useAuthState } from './useAuth'
import {
  getOpponentGroups, addOpponentGroup, renameOpponentGroup,
  addGroupMembers, removeGroupMembers, deleteOpponentGroup
} from '../firebase/opponentGroups'

export function useOpponentGroups() {
  const { user } = useAuthState()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const data = await getOpponentGroups(user.uid)
      const normalized = data.map(g => ({ ...g, memberIds: g.memberIds || [] }))
      setGroups(normalized.sort((a, b) => a.name.localeCompare(b.name)))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    ;(async () => { await load() })()
  }, [load])

  // Ritorna l'id del gruppo creato, per aprirlo subito (come `add` di useRunWorkouts).
  const add = async (name) => {
    const ref = await addOpponentGroup(user.uid, name)
    await load()
    return ref.id
  }

  const rename = async (groupId, name) => {
    await renameOpponentGroup(user.uid, groupId, name)
    await load()
  }

  // Aggiunge e toglie in un colpo solo (la modale dei membri passa la differenza):
  // sono due scritture, perché Firestore non permette arrayUnion e arrayRemove
  // sullo stesso campo nello stesso update.
  const setMembers = async (groupId, { add: toAdd = [], remove: toRemove = [] }) => {
    await addGroupMembers(user.uid, groupId, toAdd)
    await removeGroupMembers(user.uid, groupId, toRemove)
    await load()
  }

  const remove = async (groupId) => {
    await deleteOpponentGroup(user.uid, groupId)
    await load()
  }

  return { groups, loading, error, add, rename, setMembers, remove, reload: load }
}
