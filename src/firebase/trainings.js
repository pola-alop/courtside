import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { db } from './config';

const trainingsRef = (userId) =>
  collection(db, 'users', userId, 'trainings');

// Ordinati per data della sessione (desc), non per createdAt: come per i match,
// la lista è cronologica rispetto a quando ci si è allenati.
export async function getTrainings(userId) {
  const q = query(trainingsRef(userId), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addTraining(userId, data) {
  return await addDoc(trainingsRef(userId), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function updateTraining(userId, trainingId, data) {
  const ref = doc(db, 'users', userId, 'trainings', trainingId);
  return await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteTraining(userId, trainingId) {
  const ref = doc(db, 'users', userId, 'trainings', trainingId);
  return await deleteDoc(ref);
}
