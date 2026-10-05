import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, serverTimestamp
} from 'firebase/firestore';
import { db } from './config';

// Esercizi PERSONALIZZATI dell'utente, in aggiunta al database fisso di
// `src/data/exercises.json`. Solo nome, modalità e muscoli: nelle schede e nelle
// sessioni si citano con id `custom:<docId>` (vedi `buildExerciseIndex`).
const exercisesRef = (userId) =>
  collection(db, 'users', userId, 'gymExercises');

export async function getGymExercises(userId) {
  const snap = await getDocs(exercisesRef(userId));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Ritorna l'id: creando un esercizio dentro l'editor della scheda lo si
// aggiunge subito, e serve l'id per costruire `custom:<id>`.
export async function addGymExercise(userId, data) {
  const ref = await addDoc(exercisesRef(userId), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateGymExercise(userId, exerciseId, data) {
  const ref = doc(db, 'users', userId, 'gymExercises', exerciseId);
  return await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteGymExercise(userId, exerciseId) {
  const ref = doc(db, 'users', userId, 'gymExercises', exerciseId);
  return await deleteDoc(ref);
}
