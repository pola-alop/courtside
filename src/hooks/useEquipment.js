import { useState, useEffect, useCallback } from 'react'
import { useAuthState } from './useAuth'
import {
  getEquipment, addEquipment, updateEquipment,
  archiveEquipment, deleteEquipment, updateStrings
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

  useEffect(() => { load() }, [load])

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

  // NUOVO
  const remove = async (itemId) => {
    await deleteEquipment(user.uid, itemId)
    await load()
  }

  const changeStrings = async (itemId, stringData) => {
    await updateStrings(user.uid, itemId, stringData)
    await load()
  }

  return { equipment, loading, error, add, update, archive, remove, changeStrings, reload: load }
}