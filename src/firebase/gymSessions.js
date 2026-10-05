import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { db } from './config';

// Sessioni di palestra eseguite. Collection separata da `trainings` (e da
// `runs`) di proposito: le statistiche di tennis leggono `trainings`, e una
// sessione di pesi lì dentro finirebbe nelle ore in campo e nelle FC del tab
// Fisico. L'unione con le altre attività avviene solo dove serve (lista).
const sessionsRef = (userId) =>
  collection(db, 'users', userId, 'gymSessions');

// Ordinate per data della sessione (desc), come match, allenamenti e corse.
export async function getGymSessions(userId) {
  const q = query(sessionsRef(userId), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addGymSession(userId, data) {
  return await addDoc(sessionsRef(userId), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function updateGymSession(userId, sessionId, data) {
  const ref = doc(db, 'users', userId, 'gymSessions', sessionId);
  return await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteGymSession(userId, sessionId) {
  const ref = doc(db, 'users', userId, 'gymSessions', sessionId);
  return await deleteDoc(ref);
}
