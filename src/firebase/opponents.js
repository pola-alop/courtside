import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, serverTimestamp
} from 'firebase/firestore'
import { db } from './config'

const opponentsRef = (userId) =>
  collection(db, 'users', userId, 'opponents')

export async function getOpponents(userId) {
  const q = query(opponentsRef(userId), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function addOpponent(userId, data) {
  return await addDoc(opponentsRef(userId), {
    ...data,
    createdAt: serverTimestamp(),
  })
}

export async function updateOpponent(userId, opponentId, data) {
  const ref = doc(db, 'users', userId, 'opponents', opponentId)
  return await updateDoc(ref, { ...data, updatedAt: serverTimestamp() })
}

// Nessun guard qui: il controllo "avversario con match collegati non
// eliminabile" vive lato UI (OpponentDetailModal.jsx + Matches.jsx), dove
// useOpponents e useMatches sono già entrambi disponibili — coerente con
// l'equivalente guard per l'attrezzatura (linkedMatchesCount in wear.js).
export async function deleteOpponent(userId, opponentId) {
  const ref = doc(db, 'users', userId, 'opponents', opponentId)
  return await deleteDoc(ref)
}
