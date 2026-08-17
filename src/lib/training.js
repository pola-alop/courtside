// ── Dominio Allenamenti ─────────────────────────────────────
// Quarto modulo puro di src/lib/ (nessun React, nessun Firestore), dopo
// tennis.js, wear.js e athletics.js. Contiene la tassonomia dei colpi/schemi,
// i tipi di blocco di una sessione, le intensità e gli helper derivati
// (progressi per colpo, focus recenti, formattazione durate).
//
// Una SESSIONE è composta da BLOCCHI: un allenamento reale è quasi sempre
// misto ("30' di cesto + 30' di set"), e un solo tipo per sessione modellerebbe
// male sia la realtà sia l'usura dell'attrezzatura. Ogni blocco ha un tipo e
// una durata in minuti; la durata della sessione è la somma dei blocchi.
//
// Il FOCUS è un array PIATTO di id (`['dritto', 'rovescio-back', ...]`): le
// categorie qui sotto servono solo a raggruppare le voci nell'accordion del
// selettore. Un'unica lista significa un solo filtro, un solo meccanismo di
// valutazione e una sola heatmap, invece di tre meccanismi paralleli.

// ── Tassonomia colpi e schemi ───────────────────────────────
// Fonti: glossario ITF, tassonomia dei colpi di Wikipedia, letteratura sugli
// schemi di gioco (serve+1 / forehand+1). L'elenco è volutamente esaustivo:
// meglio una voce di troppo che costringere l'utente a "arrotondare".

export const FOCUS_CATEGORIES = [
  {
    id: 'servizio', label: 'Servizio', icon: '🎯',
    items: [
      { id: 'servizio-piatto',      label: 'Prima piatta' },
      { id: 'servizio-slice',       label: 'Servizio slice' },
      { id: 'servizio-kick',        label: 'Servizio kick / topspin' },
      { id: 'seconda-servizio',     label: 'Seconda di servizio' },
      { id: 'piazzamento-servizio', label: 'Piazzamento (T / esterno / corpo)' },
    ],
  },
  {
    id: 'risposta', label: 'Risposta', icon: '↩️',
    items: [
      { id: 'risposta-dritto',   label: 'Risposta di dritto' },
      { id: 'risposta-rovescio', label: 'Risposta di rovescio' },
      { id: 'risposta-bloccata', label: 'Risposta bloccata / chip' },
      { id: 'risposta-seconda',  label: 'Risposta aggressiva sulla seconda' },
    ],
  },
  {
    id: 'fondo', label: 'Fondo campo', icon: '🎾',
    items: [
      { id: 'dritto',               label: 'Dritto' },
      { id: 'rovescio',             label: 'Rovescio' },
      { id: 'rovescio-back',        label: 'Rovescio in back' },
      { id: 'dritto-back',          label: 'Slice di dritto' },
      { id: 'dritto-anomalo',       label: 'Dritto anomalo (inside-out / in)' },
      { id: 'colpo-in-corsa',       label: 'Colpo in corsa' },
      { id: 'pallonetto-offensivo', label: 'Pallonetto offensivo' },
      { id: 'pallonetto-difensivo', label: 'Pallonetto difensivo' },
      { id: 'smorzata',             label: 'Smorzata' },
      { id: 'passante',             label: 'Passante' },
    ],
  },
  {
    id: 'rete', label: 'Gioco a rete', icon: '🥅',
    items: [
      { id: 'volee-dritto',       label: 'Volée di dritto' },
      { id: 'volee-rovescio',     label: 'Volée di rovescio' },
      { id: 'mezza-volee',        label: 'Mezza volée' },
      { id: 'volee-bassa',        label: 'Volée bassa' },
      { id: 'stop-volley',        label: 'Stop volley' },
      { id: 'smash',              label: 'Smash' },
      { id: 'smash-arretrando',   label: 'Smash arretrando' },
      { id: 'volee-in-palleggio', label: 'Volée in palleggio' },
    ],
  },
  {
    id: 'transizione', label: 'Transizione', icon: '➡️',
    items: [
      { id: 'avvicinamento',  label: "Colpo d'avvicinamento" },
      { id: 'servizio-volee', label: 'Servizio-volée' },
      { id: 'chiusura-rete',  label: 'Chiusura a rete' },
    ],
  },
  {
    id: 'schemi', label: 'Schemi e situazioni', icon: '♟️',
    items: [
      { id: 'servizio-piu-uno',            label: 'Servizio + 1' },
      { id: 'risposta-piu-uno',            label: 'Risposta + 1' },
      { id: 'incrociato-dritto',           label: 'Incrociato di dritto' },
      { id: 'incrociato-rovescio',         label: 'Incrociato di rovescio' },
      { id: 'cambio-lungolinea',           label: 'Cambio di direzione lungolinea' },
      { id: 'apri-e-chiudi',               label: 'Apri il campo e chiudi' },
      { id: 'attacco-e-chiusura',          label: 'Attacco e chiusura' },
      { id: 'difesa-contrattacco',         label: 'Difesa e contrattacco' },
      { id: 'lato-debole',                 label: 'Gioco sul lato debole' },
      { id: 'smorzata-pallonetto',         label: 'Smorzata + pallonetto' },
      { id: 'variazione-ritmo',            label: 'Variazione di ritmo e altezza' },
      { id: 'punti-pressione',             label: 'Punti sotto pressione' },
    ],
  },
  {
    id: 'condizionale', label: 'Fisico e mentale', icon: '💪',
    items: [
      { id: 'footwork',      label: 'Footwork e spostamenti' },
      { id: 'atletica',      label: 'Preparazione atletica' },
      { id: 'match-play',    label: 'Match play / set' },
      { id: 'tattica',       label: 'Tattica e mentale' },
      { id: 'riscaldamento', label: 'Riscaldamento / mini-tennis' },
    ],
  },
]

// Lookup piatto id → { id, label, categoryId, categoryLabel, categoryIcon }.
// Costruito una volta sola: i componenti lo usano per risolvere le etichette
// senza scorrere le categorie ad ogni render.
export const FOCUS_BY_ID = FOCUS_CATEGORIES.reduce((acc, cat) => {
  cat.items.forEach(item => {
    acc[item.id] = {
      ...item,
      categoryId: cat.id,
      categoryLabel: cat.label,
      categoryIcon: cat.icon,
    }
  })
  return acc
}, {})

export const FOCUS_IDS = Object.keys(FOCUS_BY_ID)

export function focusLabel(id) {
  return FOCUS_BY_ID[id]?.label || id
}

export function focusIcon(id) {
  return FOCUS_BY_ID[id]?.categoryIcon || '🎾'
}

// ── Tipi di blocco ──────────────────────────────────────────
// ATTENZIONE: gli id devono restare allineati alle chiavi di
// TRAINING_WEAR_RATES in src/lib/wear.js — lì vive quanto ogni tipo consuma,
// qui solo come si presenta. Un tipo senza tariffa non produce usura.

export const TRAINING_KINDS = [
  { id: 'lezione',   label: 'Lezione individuale', icon: '🎓', sub: 'Cesto o palleggio guidato col maestro' },
  { id: 'sparring',  label: 'Sparring',            icon: '🤝', sub: 'Palleggio o esercizi 1 contro 1' },
  { id: 'gruppo',    label: 'Corso collettivo',    icon: '👥', sub: '3-4 giocatori in campo, a turno' },
  { id: 'servizio',  label: 'Servizio',            icon: '🎯', sub: 'Secchiello di servizi' },
  { id: 'macchina',  label: 'Macchina / muro',     icon: '🤖', sub: 'Densità di colpi massima' },
  { id: 'matchplay', label: 'Match di allenamento', icon: '🎾', sub: 'Set o partita non ufficiale' },
  { id: 'atletica',  label: 'Atletica / footwork', icon: '💪', sub: 'Spostamenti e condizionale, senza palla' },
]

export const TRAINING_KINDS_BY_ID = TRAINING_KINDS.reduce((acc, k) => {
  acc[k.id] = k
  return acc
}, {})

export function trainingKindMeta(id) {
  return TRAINING_KINDS_BY_ID[id] || null
}

export function trainingKindLabel(id) {
  return TRAINING_KINDS_BY_ID[id]?.label || id
}

// ── Intensità percepita ─────────────────────────────────────
// Tre livelli invece di una scala RPE 1-10: su mobile la scala fine aggiunge
// attrito senza aggiungere segnale, visto che il fattore moltiplica un budget
// di usura già approssimato. I fattori numerici stanno in wear.js.

export const INTENSITIES = [
  { id: 'leggera', label: 'Leggera', color: 'var(--color-draw)'  },
  { id: 'media',   label: 'Media',   color: 'var(--color-win)'   },
  { id: 'intensa', label: 'Intensa', color: 'var(--color-amber)' },
]

export function intensityMeta(id) {
  return INTENSITIES.find(i => i.id === id) || null
}

// ── Blocchi ─────────────────────────────────────────────────

export const DEFAULT_BLOCK_MINUTES = 60

export const emptyBlock = (kind = 'sparring') => ({ kind, minutes: DEFAULT_BLOCK_MINUTES })

export function totalMinutes(blocks) {
  return (blocks || []).reduce((sum, b) => sum + (positiveInt(b?.minutes) || 0), 0)
}

// Scarta i blocchi senza tipo valido o senza durata: un blocco a 0 minuti non
// è un dato, è una riga che l'utente ha aggiunto e non ha compilato.
export function normalizeBlocks(blocks) {
  return (blocks || [])
    .filter(b => TRAINING_KINDS_BY_ID[b?.kind] && positiveInt(b?.minutes) > 0)
    .map(b => ({ kind: b.kind, minutes: positiveInt(b.minutes) }))
}

// Riepilogo testuale dei blocchi per la riga di lista: "Lezione · Match play"
export function blocksSummary(blocks) {
  const labels = (blocks || [])
    .map(b => trainingKindLabel(b?.kind))
    .filter(Boolean)
  return [...new Set(labels)].join(' · ')
}

// ── Valutazioni per colpo ───────────────────────────────────
// `ratings` è una mappa { focusId: 1..5 } salvata sulla sessione. Ha senso solo
// per i colpi effettivamente lavorati, quindi le voci orfane (colpo rimosso dal
// focus dopo aver dato un voto) vengono scartate al salvataggio.

export const MAX_RATING = 5

export function normalizeRatings(ratings, focus) {
  const out = {}
  const allowed = new Set(focus || [])
  Object.entries(ratings || {}).forEach(([id, value]) => {
    if (!allowed.has(id)) return
    const n = positiveInt(value)
    if (n && n >= 1 && n <= MAX_RATING) out[id] = n
  })
  return out
}

// Serie storica delle auto-valutazioni per colpo, dal più recentemente
// valutato al meno recente. Serve al blocco "Progressi per colpo": mostra dove
// stai migliorando davvero, non solo quanto hai allenato.
export function focusProgress(trainings) {
  const byId = new Map()

  const chronological = [...(trainings || [])].sort((a, b) => new Date(a.date) - new Date(b.date))
  chronological.forEach(t => {
    Object.entries(t.ratings || {}).forEach(([id, value]) => {
      if (!isNum(value)) return
      if (!byId.has(id)) byId.set(id, [])
      byId.get(id).push({ date: t.date, value })
    })
  })

  return [...byId.entries()]
    .map(([id, series]) => {
      const first = series[0].value
      const last = series[series.length - 1].value
      return {
        id,
        label: focusLabel(id),
        categoryLabel: FOCUS_BY_ID[id]?.categoryLabel || null,
        series,
        count: series.length,
        first,
        last,
        delta: last - first,
        lastDate: series[series.length - 1].date,
      }
    })
    .sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate))
}

// Colpi selezionati più di recente, per la riga rapida in cima al selettore:
// nella pratica si lavora sempre sugli stessi 5-6 temi, e questa riga evita di
// aprire l'accordion nella stragrande maggioranza dei casi.
export function recentFocusIds(trainings, limit = 8) {
  const sorted = [...(trainings || [])].sort((a, b) => new Date(b.date) - new Date(a.date))
  const seen = []
  for (const t of sorted) {
    for (const id of t.focus || []) {
      if (FOCUS_BY_ID[id] && !seen.includes(id)) seen.push(id)
      if (seen.length >= limit) return seen
    }
  }
  return seen
}

// ── Formattazione (display) ─────────────────────────────────

// "1h 30" sopra l'ora, "45 min" sotto: la forma compatta serve nelle righe di
// lista, dove lo spazio orizzontale è poco.
export function formatMinutes(min) {
  const n = positiveInt(min) || 0
  if (n === 0) return '—'
  const h = Math.floor(n / 60)
  const m = n % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}`
}

// Ore decimali con una cifra: per le tile di sintesi ("12,5 h questo mese").
export function formatHours(min) {
  const n = positiveInt(min) || 0
  return (n / 60).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

// ── Helpers ────────────────────────────────────────────────

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v)
}

// Accetta anche stringhe numeriche (input del wizard) e ritorna un intero ≥ 0,
// oppure null se il valore non è interpretabile.
function positiveInt(v) {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}
