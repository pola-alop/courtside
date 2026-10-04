import { useState, useEffect, useCallback } from 'react'
import { useAuthState } from './useAuth'
import { getPlans, addPlan, updatePlan, deletePlan } from '../firebase/plans'

export function usePlans() {
  const { user } = useAuthState()
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const data = await getPlans(user.uid)
      setPlans(data)
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
    await addPlan(user.uid, data)
    await load()
  }

  const update = async (planId, data) => {
    await updatePlan(user.uid, planId, data)
    await load()
  }

  const remove = async (planId) => {
    await deletePlan(user.uid, planId)
    await load()
  }

  return { plans, loading, error, add, update, remove, reload: load }
}
