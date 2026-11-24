import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { db } from './config';

const tiesRef = (userId) =>
  collection(db, 'users', userId, 'teamTies');

const tieDoc = (userId, tieId) =>
  doc(db, 'users', userId, 'teamTies', tieId);

// Ordinati per data dello scontro (desc), come le partite.
export async function getTeamTies(userId) {
  const q = query(tiesRef(userId), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// `data`: { date, opponentTeam, home, formula }. Gli esiti dei compagni
// (`rubbers`) partono vuoti: si segnano dal dettaglio dello scontro.
export async function addTeamTie(userId, data) {
  return await addDoc(tiesRef(userId), {
    ...data,
    rubbers: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTeamTie(userId, tieId, data) {
  return await updateDoc(tieDoc(userId, tieId), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteTeamTie(userId, tieId) {
  return await deleteDoc(tieDoc(userId, tieId));
}
