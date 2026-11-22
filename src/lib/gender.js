// Modulo puro di src/lib/ (nessun React/Firestore, nessun import: si carica
// anche da Node per i collaudi). Genere di un giocatore e categoria del doppio.
//
// Il genere sta su `opponent.gender` e su `profile.gender` come 'M' | 'F'. Un
// documento che non lo ha (tutti quelli salvati prima della 2.2.0) vale `null`,
// «non indicato»: non si migra e non c'è un valore di ripiego, perché un genere
// inventato falserebbe la categoria dei doppi.

export const GENDERS = [
  { id: 'M', label: 'Uomo'  },
  { id: 'F', label: 'Donna' },
]

const GENDER_IDS = GENDERS.map(g => g.id)

// 'M' | 'F', oppure null per qualsiasi altra cosa (assente, vuoto, sporco).
export const readGender = value => (GENDER_IDS.includes(value) ? value : null)

export const genderLabel = value => GENDERS.find(g => g.id === value)?.label || null

// ── Categoria del doppio ───────────────────────────────────
// Ricavata dai generi dei quattro giocatori (utente, compagno, due avversari),
// mai salvata: se un genere viene corretto, la categoria segue.
//  · tutti uomini      → 'maschile'
//  · tutte donne       → 'femminile'
//  · qualsiasi miscela → 'misto' (anche tre contro uno)
//  · un genere mancante, o un numero di giocatori diverso da quattro → null
export const DOUBLES_PLAYERS = 4

export const DOUBLES_CATEGORIES = [
  { id: 'maschile',  label: 'Maschile'  },
  { id: 'femminile', label: 'Femminile' },
  { id: 'misto',     label: 'Misto'     },
]

export function doublesCategory(genders) {
  if (!Array.isArray(genders) || genders.length !== DOUBLES_PLAYERS) return null
  const read = genders.map(readGender)
  if (read.includes(null)) return null
  if (read.every(g => g === 'M')) return 'maschile'
  if (read.every(g => g === 'F')) return 'femminile'
  return 'misto'
}

export const doublesCategoryLabel = id => DOUBLES_CATEGORIES.find(c => c.id === id)?.label || null
