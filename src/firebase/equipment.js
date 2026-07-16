import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc,
  getDocs, query, orderBy, serverTimestamp, arrayUnion
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

export async function unarchiveEquipment(userId, itemId) {
  const ref = doc(db, 'users', userId, 'equipment', itemId)
  return await updateDoc(ref, { active: true, updatedAt: serverTimestamp() })
}

export async function deleteEquipment(userId, itemId) {
  const ref = doc(db, 'users', userId, 'equipment', itemId)
  return await deleteDoc(ref)
}

// Registra una NUOVA incordatura: sposta quella attuale nello storico e
// imposta la nuova come corde attuali. Da usare solo per un vero cambio
// corde, non per correggere i dati dell'incordatura attuale (vedi updateEquipment).
export async function addStringsEntry(userId, itemId, stringData) {
  const ref = doc(db, 'users', userId, 'equipment', itemId)
  const snap = await getDoc(ref)
  const current = snap.data() || {}

  // Compatibilità con i vecchi campi flat (stringBrand/stringModel/...)
  const previousStrings = current.strings || (
    (current.stringBrand || current.stringModel || current.stringTension || current.stringDate)
      ? {
          brand:     current.stringBrand   || null,
          model:     current.stringModel   || null,
          tension:   current.stringTension ?? null,
          mountedAt: current.stringDate    || null,
        }
      : null
  )

  const newString = {
    brand:     stringData.brand   || null,
    model:     stringData.model   || null,
    tension:   stringData.tension ?? null,
    mountedAt: stringData.mountedAt || new Date().toISOString(),
  }

  const updates = { strings: newString, updatedAt: serverTimestamp() }
  if (previousStrings) {
    updates.stringsHistory = arrayUnion(previousStrings)
  }

  return await updateDoc(ref, updates)
}

// Rimuove una voce dallo storico incordature (identificata da mountedAt, unico per voce)
export async function deleteStringsHistoryEntry(userId, itemId, entry) {
  const ref = doc(db, 'users', userId, 'equipment', itemId)
  const snap = await getDoc(ref)
  const current = snap.data() || {}
  const history = current.stringsHistory || []
  const updated = history.filter(h => h.mountedAt !== entry.mountedAt)
  return await updateDoc(ref, { stringsHistory: updated, updatedAt: serverTimestamp() })
}