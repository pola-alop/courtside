import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';

// Dettagli pesanti di un'attività importata da .FIT (serie sottocampionate,
// lap, traccia). Il riassunto leggero sta in `athletics` della sessione; qui
// vive ciò che non deve essere scaricato a ogni apertura delle liste. L'id del
// documento è il `fitId` del file (numero di serie + istante di creazione),
// quindi è deterministico: importare due volte lo stesso file scrive lo stesso
// documento. Nessun elenco: si legge sempre un documento per volta.
const ref = (userId, fitId) =>
  doc(db, 'users', userId, 'fitDetails', fitId);

export async function getFitDetails(userId, fitId) {
  const snap = await getDoc(ref(userId, fitId));
  return snap.exists() ? snap.data() : null;
}

export async function setFitDetails(userId, fitId, data) {
  return await setDoc(ref(userId, fitId), { ...data, createdAt: serverTimestamp() });
}

export async function deleteFitDetails(userId, fitId) {
  return await deleteDoc(ref(userId, fitId));
}
