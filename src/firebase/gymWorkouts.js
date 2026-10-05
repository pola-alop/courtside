import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, serverTimestamp
} from 'firebase/firestore';
import { db } from './config';

// Libreria delle schede di palestra (nome + esercizi con le serie),
// riutilizzabili da una sessione all'altra. L'ordinamento per ultimo uso è
// ricavato dalle sessioni (`sortWorkoutsByUse`), quindi qui non serve una query
// ordinata.
const workoutsRef = (userId) =>
  collection(db, 'users', userId, 'gymWorkouts');

export async function getGymWorkouts(userId) {
  const snap = await getDocs(workoutsRef(userId));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Ritorna l'id della nuova scheda: il wizard deve poterla collegare alla
// sessione che sta salvando.
export async function addGymWorkout(userId, data) {
  const ref = await addDoc(workoutsRef(userId), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateGymWorkout(userId, workoutId, data) {
  const ref = doc(db, 'users', userId, 'gymWorkouts', workoutId);
  return await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteGymWorkout(userId, workoutId) {
  const ref = doc(db, 'users', userId, 'gymWorkouts', workoutId);
  return await deleteDoc(ref);
}
