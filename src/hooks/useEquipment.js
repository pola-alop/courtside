import { useState, useEffect, useCallback } from 'react'
import { useAuthState } from './useAuth'
import {
  getEquipment, addEquipment, updateEquipment,
  archiveEquipment, unarchiveEquipment, deleteEquipment,
  addStringsEntry, deleteStringsHistoryEntry, updateStringsHistoryEntry
} from '../firebase/equipment'

export function useEquipment() {
  const { user } = useAuthState()
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const data = await getEquipment(user.uid)
      setEquipment(data)
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
    await addEquipment(user.uid, data)
    await load()
  }

  const update = async (itemId, data) => {
    await updateEquipment(user.uid, itemId, data)
    await load()
  }

  const archive = async (itemId) => {
    await archiveEquipment(user.uid, itemId)
    await load()
  }

  const unarchive = async (itemId) => {
    await unarchiveEquipment(user.uid, itemId)
    await load()
  }

  // NUOVO
  const remove = async (itemId) => {
    await deleteEquipment(user.uid, itemId)
    await load()
  }

  // Registra una nuova incordatura (l'attuale diventa storica)
  const addStrings = async (itemId, stringData) => {
    await addStringsEntry(user.uid, itemId, stringData)
    await load()
  }

  // Elimina una voce dallo storico incordature
  const deleteStringsHistory = async (itemId, entry) => {
    await deleteStringsHistoryEntry(user.uid, itemId, entry)
    await load()
  }

  // Corregge una voce già presente nello storico incordature
  const updateStringsHistory = async (itemId, originalEntry, data) => {
    await updateStringsHistoryEntry(user.uid, itemId, originalEntry, data)
    await load()
  }

  return {
    equipment, loading, error, add, update, archive, unarchive, remove,
    addStrings, deleteStringsHistory, updateStringsHistory, reload: load
  }
}