// Undicesimo modulo puro di src/lib/ (nessun React/Firestore): vocabolario
// controllato per Livello/classifica e Stile di gioco dell'anagrafica
// avversari, prima campi di testo libero. Sostituisce i valori arbitrari con
// un elenco fisso così i dropdown di AddOpponentModal/OpponentDetailModal e
// gli split di Stats condividono la stessa unica fonte di verità.

// Classificazione federale FITP: quarta categoria da 4.6 (ingresso) a 4.1,
// terza da 3.5 a 3.1, seconda da 2.8 a 2.1, poi la prima categoria
// (Nazionale). NC precede la classifica vera e propria. Elenco dal metodo di
// classificazione FITP (fitp.it, classifiche 2026).
export const LEVELS = [
  { id: 'nc',   label: 'NC (non classificato)' },
  { id: '4.6',  label: '4.6' },
  { id: '4.5',  label: '4.5' },
  { id: '4.4',  label: '4.4' },
  { id: '4.3',  label: '4.3' },
  { id: '4.2',  label: '4.2' },
  { id: '4.1',  label: '4.1' },
  { id: '3.5',  label: '3.5' },
  { id: '3.4',  label: '3.4' },
  { id: '3.3',  label: '3.3' },
  { id: '3.2',  label: '3.2' },
  { id: '3.1',  label: '3.1' },
  { id: '2.8',  label: '2.8' },
  { id: '2.7',  label: '2.7' },
  { id: '2.6',  label: '2.6' },
  { id: '2.5',  label: '2.5' },
  { id: '2.4',  label: '2.4' },
  { id: '2.3',  label: '2.3' },
  { id: '2.2',  label: '2.2' },
  { id: '2.1',  label: '2.1' },
  { id: '1cat', label: '1ª categoria (Nazionale)' },
]

export const LEVEL_BY_ID = Object.fromEntries(LEVELS.map(l => [l.id, l]))
export const levelLabel = id => LEVEL_BY_ID[id]?.label || null

// Le 5 tipologie di giocatore riconosciute dalla stessa FITP (fitp.it,
// "Giocare a tennis" › Tecnica e stili di gioco) più "Regolarista", termine
// amatoriale italiano molto diffuso per chi gioca di pura rimessa senza
// necessariamente contrattaccare — distinto dal contrattaccante da fondo.
export const PLAYSTYLES = [
  { id: 'regolarista',      label: 'Regolarista (di rimessa)' },
  { id: 'contrattaccante',  label: 'Contrattaccante da fondo' },
  { id: 'aggressivo-fondo', label: 'Aggressivo da fondo campo' },
  { id: 'attacco',          label: "Giocatore d'attacco (servizio potente)" },
  { id: 'serve-volley',     label: 'Serve & volley' },
  { id: 'completo',         label: 'Completo (a tutto campo)' },
]

export const PLAYSTYLE_BY_ID = Object.fromEntries(PLAYSTYLES.map(p => [p.id, p]))
export const playstyleLabel = id => PLAYSTYLE_BY_ID[id]?.label || null

// ── Nome e cognome ─────────────────────────────────────────
// Lo stesso modulo tiene tutto ciò che deriva da Nome/Cognome (iniziali, forma
// breve) così le card, i selettori e il punteggio non hanno più una propria
// copia dell'euristica "l'ultima parola è il cognome".
//
// Sul documento `firstName` (obbligatorio) e `lastName` (facoltativo) sono la
// fonte; `name` è la loro composizione, salvata a ogni scrittura, così ricerca,
// programmi, calendario e Stats continuano a leggere un'unica stringa.

// Divide un nome libero sul primo spazio: Nome = prima parola, Cognome = il
// resto (i cognomi composti, "Di Gaetano", restano interi). Serve alla
// migrazione dei documenti vecchi e come ripiego finché non sono migrati.
export function splitName(name) {
  const trimmed = (name || '').trim()
  const match = trimmed.match(/^(\S+)\s+(.+)$/)
  if (!match) return { firstName: trimmed, lastName: '' }
  return { firstName: match[1], lastName: match[2].replace(/\s+/g, ' ') }
}

// I tre campi da scrivere insieme. Cognome vuoto → null.
export function opponentNameFields(firstName, lastName) {
  const first = (firstName || '').trim().replace(/\s+/g, ' ')
  const last = (lastName || '').trim().replace(/\s+/g, ' ')
  return { firstName: first, lastName: last || null, name: last ? `${first} ${last}` : first }
}

// Nome e cognome di un avversario, anche se il documento è ancora quello vecchio.
export function opponentParts(opponent) {
  const first = (opponent?.firstName || '').trim()
  if (first) return { firstName: first, lastName: (opponent.lastName || '').trim() }
  return splitName(opponent?.name)
}

// "MR"; con il cognome vuoto le prime due lettere del nome; "?" se non c'è nulla.
export function opponentInitials(opponent) {
  const { firstName, lastName } = opponentParts(opponent)
  if (!firstName) return '?'
  if (!lastName) return firstName.slice(0, 2).toUpperCase()
  return (firstName[0] + lastName[0]).toUpperCase()
}

// "Di Gaetano M."; con il cognome vuoto il solo nome; null se non c'è nulla.
export function opponentShortName(opponent) {
  const { firstName, lastName } = opponentParts(opponent)
  if (!firstName) return null
  if (!lastName) return firstName
  return `${lastName} ${firstName[0].toUpperCase()}.`
}

// ── Gruppi di avversari ────────────────────────────────────
// `users/{uid}/opponentGroups`: { name, memberIds: [opponentId] }. L'appartenenza
// sta sul gruppo e non sull'avversario; gli id di avversari eliminati restano
// nell'array e si ignorano in lettura.

export const cleanGroupName = name => (name || '').trim().replace(/\s+/g, ' ')

// Il problema di un nome di gruppo, o null: vuoto, oppure già usato (senza
// distinguere le maiuscole). `excludeId` è il gruppo che si sta rinominando.
export function groupNameIssue(name, groups, excludeId = null) {
  const clean = cleanGroupName(name)
  if (!clean) return 'Il nome del gruppo non può essere vuoto.'
  const taken = groups.some(g => g.id !== excludeId && cleanGroupName(g.name).toLowerCase() === clean.toLowerCase())
  return taken ? 'Esiste già un gruppo con questo nome.' : null
}

// Gli avversari membri del gruppo, nell'ordine di `opponents`; gli id che non
// corrispondono più a un avversario si ignorano.
export function groupMembers(group, opponents) {
  const ids = new Set(group?.memberIds || [])
  return opponents.filter(o => ids.has(o.id))
}

// I gruppi di cui fa parte un avversario.
export function groupsOf(opponentId, groups) {
  return groups.filter(g => (g.memberIds || []).includes(opponentId))
}
