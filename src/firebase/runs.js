import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { db } from './config';

// Sessioni di corsa eseguite. Collection separata da `trainings` di proposito:
// tutte le statistiche di tennis leggono `trainings`, e una corsa lì dentro
// finirebbe nelle ore in campo, nell'usura delle scarpe e nelle FC del tab
// Fisico. L'unione con gli allenamenti di tennis avviene solo nella lista.
const runsRef = (userId) =>
  collection(db, 'users', userId, 'runs');

// Ordinate per data della sessione (desc), come match e allenamenti.
export async function getRuns(userId) {
  const q = query(runsRef(userId), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addRun(userId, data) {
  return await addDoc(runsRef(userId), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function updateRun(userId, runId, data) {
  const ref = doc(db, 'users', userId, 'runs', runId);
  return await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteRun(userId, runId) {
  const ref = doc(db, 'users', userId, 'runs', runId);
  return await deleteDoc(ref);
}
