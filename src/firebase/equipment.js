import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, serverTimestamp
} from 'firebase/firestore'
import { db } from './config'

const equipmentRef = (userId) =>
  collection(db, 'users', userId, 'equipment')

export async function getEquipment(userId) {
  const q = query(equipmentRef(userId), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function addEquipment(userId, data) {
  return await addDoc(equipmentRef(userId), {
    ...data,
    active: true,
    createdAt: serverTimestamp(),
  })
}

export async function updateEquipment(userId, itemId, data) {
  const ref = doc(db, 'users', userId, 'equipment', itemId)
  return await updateDoc(ref, { ...data, updatedAt: serverTimestamp() })
}

export async function archiveEquipment(userId, itemId) {
  const ref = doc(db, 'users', userId, 'equipment', itemId)
  return await updateDoc(ref, { active: false, updatedAt: serverTimestamp() })
}

export async function deleteEquipment(userId, itemId) {
  const ref = doc(db, 'users', userId, 'equipment', itemId)
  return await deleteDoc(ref)
}

export async function updateStrings(userId, itemId, stringData) {
  const ref = doc(db, 'users', userId, 'equipment', itemId)
  const newString = { ...stringData, mountedAt: new Date().toISOString() }
  return await updateDoc(ref, {
    strings: newString,
    updatedAt: serverTimestamp(),
  })
}