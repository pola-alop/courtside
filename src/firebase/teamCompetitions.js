import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { db } from './config';

const competitionsRef = (userId) =>
  collection(db, 'users', userId, 'teamCompetitions');

const competitionDoc = (userId, competitionId) =>
  doc(db, 'users', userId, 'teamCompetitions', competitionId);

// Ordinate per data di creazione (la lista vera si riordina in memoria per
// ultima attività, vedi `sortCompetitions`).
export async function getTeamCompetitions(userId) {
  const q = query(competitionsRef(userId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// `data`: { name, season, teams, myTeamId, legs, formula, points, qualifiers }.
// I risultati delle altre squadre (`results`) partono vuoti: si segnano dal
// calendario della competizione.
export async function addTeamCompetition(userId, data) {
  return await addDoc(competitionsRef(userId), {
    ...data,
    results: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTeamCompetition(userId, competitionId, data) {
  return await updateDoc(competitionDoc(userId, competitionId), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteTeamCompetition(userId, competitionId) {
  return await deleteDoc(competitionDoc(userId, competitionId));
}
