import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './config'

const userRef = (userId) => doc(db, 'users', userId)

export async function getUserProfile(userId) {
  const snap = await getDoc(userRef(userId))
  return snap.exists() ? (snap.data().profile || {}) : {}
}

// `data` è già l'intera mappa `profile` risultante (l'hook fa il merge prima
// di chiamare questa funzione) — stesso stile "replace" di updateOpponent,
// dove il chiamante manda sempre il form completo.
export async function updateUserProfile(userId, data) {
  return await updateDoc(userRef(userId), { profile: data, updatedAt: serverTimestamp() })
}
