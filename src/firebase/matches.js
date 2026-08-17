import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, serverTimestamp
} from 'firebase/firestore'
import { db } from './config'

const matchesRef = (userId) =>
  collection(db, 'users', userId, 'matches')

// Ordinati per data del match (desc), non per createdAt: la lista è cronologica
// rispetto a quando si è giocato, non a quando si è registrato.
export async function getMatches(userId) {
  const q = query(matchesRef(userId), orderBy('date', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function addMatch(userId, data) {
  return await addDoc(matchesRef(userId), {
    ...data,
    createdAt: serverTimestamp(),
  })
}

export async function updateMatch(userId, matchId, data) {
  const ref = doc(db, 'users', userId, 'matches', matchId)
  return await updateDoc(ref, { ...data, updatedAt: serverTimestamp() })
}

export async function deleteMatch(userId, matchId) {
  const ref = doc(db, 'users', userId, 'matches', matchId)
  return await deleteDoc(ref)
}
