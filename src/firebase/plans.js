import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, serverTimestamp
} from 'firebase/firestore';
import { db } from './config';

// Programmi del calendario della Home: un'attività prevista in un giorno
// (`date` = 'YYYY-MM-DD' del giorno locale, vedi `dayKey` in lib/calendar.js).
// Lo stato fatto / da fare / non svolto NON si salva: lo ricava `buildCalendar`
// confrontando il programma con le sessioni di quel giorno. L'ordinamento per
// giorno e orario lo fa lo stesso modulo, quindi qui non serve una query
// ordinata. Si leggono tutti, anche quelli passati che la griglia non mostra:
// sono pochi e un giorno serviranno a un "programmato vs fatto".
const plansRef = (userId) =>
  collection(db, 'users', userId, 'plans');

export async function getPlans(userId) {
  const snap = await getDocs(plansRef(userId));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addPlan(userId, data) {
  return await addDoc(plansRef(userId), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function updatePlan(userId, planId, data) {
  const ref = doc(db, 'users', userId, 'plans', planId);
  return await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

export async function deletePlan(userId, planId) {
  const ref = doc(db, 'users', userId, 'plans', planId);
  return await deleteDoc(ref);
}
