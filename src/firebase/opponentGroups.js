import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, serverTimestamp, arrayUnion, arrayRemove
} from 'firebase/firestore';
import { db } from './config';

const groupsRef = (userId) =>
  collection(db, 'users', userId, 'opponentGroups');

const groupDoc = (userId, groupId) =>
  doc(db, 'users', userId, 'opponentGroups', groupId);

export async function getOpponentGroups(userId) {
  const q = query(groupsRef(userId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addOpponentGroup(userId, name) {
  return await addDoc(groupsRef(userId), {
    name,
    memberIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function renameOpponentGroup(userId, groupId, name) {
  return await updateDoc(groupDoc(userId, groupId), { name, updatedAt: serverTimestamp() });
}

// L'appartenenza sta sul gruppo, non sull'avversario: aggiungere o togliere un
// membro tocca un solo documento, e un avversario può stare in più gruppi.
export async function addGroupMembers(userId, groupId, opponentIds) {
  if (opponentIds.length === 0) return;
  return await updateDoc(groupDoc(userId, groupId), {
    memberIds: arrayUnion(...opponentIds),
    updatedAt: serverTimestamp(),
  });
}

export async function removeGroupMembers(userId, groupId, opponentIds) {
  if (opponentIds.length === 0) return;
  return await updateDoc(groupDoc(userId, groupId), {
    memberIds: arrayRemove(...opponentIds),
    updatedAt: serverTimestamp(),
  });
}

// Eliminare un gruppo è una sola cancellazione: gli avversari non si toccano.
export async function deleteOpponentGroup(userId, groupId) {
  return await deleteDoc(groupDoc(userId, groupId));
}
