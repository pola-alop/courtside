import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, serverTimestamp
} from 'firebase/firestore';
import { db } from './config';

// Libreria delle schede di corsa (nome + struttura di fasi e ripetute),
// riutilizzabili da una sessione all'altra. L'ordinamento per ultimo uso è
// ricavato dalle sessioni (`sortWorkoutsByUse` in lib/running.js), quindi qui
// non serve una query ordinata.
const workoutsRef = (userId) =>
  collection(db, 'users', userId, 'runWorkouts');

export async function getRunWorkouts(userId) {
  const snap = await getDocs(workoutsRef(userId));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Ritorna l'id della nuova scheda: il wizard corsa deve poterla collegare alla
// sessione che sta salvando.
export async function addRunWorkout(userId, data) {
  const ref = await addDoc(workoutsRef(userId), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateRunWorkout(userId, workoutId, data) {
  const ref = doc(db, 'users', userId, 'runWorkouts', workoutId);
  return await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteRunWorkout(userId, workoutId) {
  const ref = doc(db, 'users', userId, 'runWorkouts', workoutId);
  return await deleteDoc(ref);
}
