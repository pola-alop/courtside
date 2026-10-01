// Seed di dati sintetici per il progetto Firebase DEV di Courtside.
// Uso: node seed.mjs <path-service-account-key.json> [email-utente]
//
// Riusa i moduli puri dell'app (src/lib/tennis.js, athletics.js) per calcolare
// risultati/normalizzazioni esattamente come farebbe l'app. Cancella TUTTI i
// dati esistenti (equipment/opponents/matches/trainings/runs/runWorkouts +
// profilo) dell'utente
// target e li ricrea da zero — pensato solo per il progetto dev.

import { readFileSync } from 'fs'
import { pathToFileURL, fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_SRC = resolve(__dirname, '../../src')
const DEV_PROJECT_ID = 'courtside-dev-a2ca6'
const PROD_PROJECT_ID = 'courtside-7e67b'

const keyPath = process.argv[2]
const targetEmail = process.argv[3] || null

if (!keyPath) {
  console.error('Uso: node seed.mjs <path-service-account.json> [email-utente]')
  process.exit(1)
}

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'))

if (serviceAccount.project_id === PROD_PROJECT_ID) {
  console.error(`RIFIUTO: la chiave punta al progetto di PRODUZIONE (${PROD_PROJECT_ID}). Serve la chiave di ${DEV_PROJECT_ID}.`)
  process.exit(1)
}
if (serviceAccount.project_id !== DEV_PROJECT_ID) {
  console.error(`RIFIUTO: la chiave punta a "${serviceAccount.project_id}", atteso "${DEV_PROJECT_ID}".`)
  process.exit(1)
}

const { computeOutcome } = await import(pathToFileURL(`${PROJECT_SRC}/lib/tennis.js`).href)
const { normalizeAthletics } = await import(pathToFileURL(`${PROJECT_SRC}/lib/athletics.js`).href)

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()
db.settings({ ignoreUndefinedProperties: true })
const auth = getAuth()

// ── RNG deterministico (mulberry32) ─────────────────────────
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(20260818)
const pick = (arr) => arr[Math.floor(rng() * arr.length)]
const randInt = (min, max) => min + Math.floor(rng() * (max - min + 1))

const iso = (dateStr) => new Date(dateStr).toISOString()
const ts = (dateStr) => Timestamp.fromDate(new Date(dateStr))
const note = (text, dateStr) => ({ text, createdAt: iso(dateStr) })
const S = (me, opp, tbMe = null, tbOpp = null) => ({ me, opp, tbMe, tbOpp })

// ── Trova l'utente dev ───────────────────────────────────────
async function findUser() {
  if (targetEmail) {
    try { return await auth.getUserByEmail(targetEmail) } catch { /* fallthrough */ }
  }
  const list = await auth.listUsers(1000)
  if (list.users.length === 0) {
    throw new Error('Nessun utente trovato nel progetto dev. Fai login una volta con Google su `npm run dev` prima di lanciare il seed.')
  }
  if (list.users.length > 1 && !targetEmail) {
    console.warn(`Trovati ${list.users.length} utenti, uso il primo (${list.users[0].email}). Passa l'email come secondo argomento per sceglierne uno specifico.`)
  }
  return list.users[0]
}

async function wipeSubcollection(uid, name) {
  const ref = db.collection('users').doc(uid).collection(name)
  const snap = await ref.get()
  if (snap.empty) return 0
  const batch = db.batch()
  snap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
  return snap.size
}

async function main() {
  const user = await findUser()
  const uid = user.uid
  console.log(`Utente target: ${user.email} (uid=${uid})`)

  // ── Pulizia ──────────────────────────────────────────────
  for (const col of ['equipment', 'opponents', 'matches', 'trainings', 'runs', 'runWorkouts', 'gymWorkouts', 'gymSessions', 'gymExercises']) {
    const n = await wipeSubcollection(uid, col)
    console.log(`Eliminati ${n} doc esistenti in ${col}`)
  }

  const userRef = db.collection('users').doc(uid)
  const userSnap = await userRef.get()
  if (!userSnap.exists) {
    await userRef.set({
      displayName: user.displayName || null,
      email: user.email || null,
      photoURL: user.photoURL || null,
      createdAt: FieldValue.serverTimestamp(),
    })
  }

  // ── Equipment ────────────────────────────────────────────
  const equipmentCol = userRef.collection('equipment')

  const racchettaA = await equipmentCol.add({
    type: 'racchetta', source: 'catalog', active: true,
    brand: 'Wilson', model: 'Pro Staff 97L v14', weight: 305, balance: '335mm',
    headSize: 97, pattern: '16x19', flexibility: 58,
    imageUrl: '/catalog/racchette/wilson/pro-staff/wilson-pro-staff-97l-v14-roland-garros-2026.webp',
    catalogId: 'wilson-pro-staff', catalogKey: 'wilson-pro-staff-seed-a',
    nickname: 'Principale',
    strings: { brand: 'Luxilon', model: 'ALU Power Rough', tensionMains: 26, tensionCrosses: 25, mountedAt: iso('2026-06-10') },
    stringsHistory: [
      { brand: 'Luxilon', model: 'ALU Power', tensionMains: 24, tensionCrosses: 23, mountedAt: iso('2025-09-01') },
      { brand: 'Luxilon', model: 'ALU Power', tensionMains: 25, tensionCrosses: 24, mountedAt: iso('2025-12-01') },
      { brand: 'Luxilon', model: 'ALU Power Rough', tensionMains: 25, tensionCrosses: 24, mountedAt: iso('2026-03-15') },
    ],
    createdAt: ts('2025-09-01'),
  })

  const racchettaB = await equipmentCol.add({
    type: 'racchetta', source: 'custom', active: true,
    brand: 'Babolat', model: 'Pure Drive 2025', weight: 300, balance: '320mm',
    headSize: 100, pattern: '16x19', flexibility: 65,
    nickname: 'Torneo',
    strings: { brand: 'Babolat', model: 'RPM Blast', tensionMains: 23, tensionCrosses: 22, mountedAt: iso('2025-11-01') },
    stringsHistory: [],
    createdAt: ts('2025-10-28'),
  })

  const scarpaTerra = await equipmentCol.add({
    type: 'scarpa', source: 'catalog', active: true,
    brand: 'Asics', model: 'Gel Resolution 9 Clay', surface: ['terra'],
    nickname: 'Terra', catalogId: 'asics-gel-resolution', catalogKey: 'asics-gel-resolution-seed',
    createdAt: ts('2025-09-01'),
  })

  const scarpaCemento = await equipmentCol.add({
    type: 'scarpa', source: 'catalog', active: true,
    brand: 'Nike', model: 'Zoom Vapor Pro 2', surface: ['cemento', 'indoor'],
    nickname: 'Cemento/Indoor', catalogId: 'nike-zoom-vapor', catalogKey: 'nike-zoom-vapor-seed',
    createdAt: ts('2026-01-05'),
  })

  const scarpaVecchia = await equipmentCol.add({
    type: 'scarpa', source: 'custom', active: false,
    brand: 'Nike', model: 'Air Zoom Vapor X', surface: ['cemento'],
    nickname: 'Vecchie (dismesse)',
    createdAt: ts('2025-08-20'),
  })

  const outfit = await equipmentCol.add({
    type: 'outfit', source: 'custom', active: true,
    name: 'Setup Gara',
    maglietta: 'Nike Dri-FIT Blu', pantaloncini: 'Nike Court Nero',
    calzini: 'Nike Everyday', polsini: 'Nike bianchi', fascia: 'Nike bianca',
    createdAt: ts('2025-09-01'),
  })

  const borsone = await equipmentCol.add({
    type: 'borsone', source: 'custom', active: true,
    brand: 'Wilson', model: 'Team 3 Pack',
    notes: 'Capienza 3 racchette, colore nero/giallo',
    createdAt: ts('2025-09-01'),
  })

  console.log('Equipment creato: 7 elementi')

  // ── Opponents ────────────────────────────────────────────
  const opponentsCol = userRef.collection('opponents')

  const oMarco = await opponentsCol.add({
    name: 'Marco Rossi', hand: 'destro', level: '3.3', playstyle: 'regolarista',
    notes: [
      note('Palleggia sempre in profondità, poco rischio dalla riga di fondo.', '2025-09-10'),
      note('Servizio poco pericoloso, si può rispondere in aggressione.', '2026-01-25'),
    ],
    createdAt: ts('2025-09-05'),
  })
  const oLuca = await opponentsCol.add({
    name: 'Luca Bianchi', hand: 'sinistro', level: '3.1', playstyle: 'aggressivo-fondo',
    notes: [note('Mancino, dritto molto pesante in cross. Attaccare il rovescio.', '2025-10-06')],
    createdAt: ts('2025-10-02'),
  })
  const oAndrea = await opponentsCol.add({
    name: 'Andrea Verdi', hand: 'destro', level: '2.7', playstyle: 'serve-volley',
    notes: [],
    createdAt: ts('2025-09-18'),
  })
  const oGiulia = await opponentsCol.add({
    name: 'Giulia Ferrari', hand: 'destro', level: '4.3', playstyle: 'contrattaccante',
    notes: [note('Molto solida, va tenuta in movimento con i cambi di direzione.', '2025-11-10')],
    createdAt: ts('2025-11-06'),
  })
  const oSimone = await opponentsCol.add({
    name: 'Simone Colombo', hand: 'sinistro', level: '3.5', playstyle: 'completo',
    notes: [],
    createdAt: ts('2025-10-15'),
  })
  const oDavide = await opponentsCol.add({
    name: 'Davide Greco', hand: 'destro', level: '4.1', playstyle: 'attacco',
    notes: [note('Conosciuto al circolo, non ancora affrontato in partita.', '2026-05-01')],
    createdAt: ts('2026-05-01'),
  })

  console.log('Avversari creati: 6 (Davide senza partite, per testare eliminazione libera)')

  const oppNames = {
    [oMarco.id]: 'Marco Rossi', [oLuca.id]: 'Luca Bianchi', [oAndrea.id]: 'Andrea Verdi',
    [oGiulia.id]: 'Giulia Ferrari', [oSimone.id]: 'Simone Colombo', [oDavide.id]: 'Davide Greco',
  }

  // ── Athletics helper ─────────────────────────────────────
  function athleticsFor({ minutes, intensity = 'media', withZones = true }) {
    const durationSec = Math.round(minutes * 60)
    const avgHr = { leggera: randInt(118, 132), media: randInt(132, 148), intensa: randInt(148, 165) }[intensity]
    const maxHr = avgHr + randInt(15, 30)
    const distanceKm = Math.round((minutes * randInt(45, 60) / 60) * 100) / 100
    const calories = Math.round(minutes * randInt(8, 12))
    const teAerobic = { leggera: 2.0 + rng(), media: 2.8 + rng(), intensa: 3.6 + rng() * 1.2 }[intensity]
    const teAnaerobic = { leggera: 0.5 + rng() * 0.8, media: 1.2 + rng(), intensa: 2.2 + rng() * 1.3 }[intensity]
    let zones = null
    if (withZones) {
      const shape = { leggera: [0.30, 0.40, 0.22, 0.06, 0.02], media: [0.15, 0.30, 0.32, 0.17, 0.06], intensa: [0.08, 0.18, 0.32, 0.28, 0.14] }[intensity]
      zones = shape.map(f => Math.round(durationSec * f))
      zones[4] = Math.max(0, durationSec - zones[0] - zones[1] - zones[2] - zones[3]) // evita che l'arrotondamento superi la durata
    }
    return normalizeAthletics({
      distanceKm, durationSec, calories, avgHr, maxHr,
      trainingEffect: Math.min(5, Math.round(teAerobic * 10) / 10),
      anaerobicTrainingEffect: Math.min(5, Math.round(teAnaerobic * 10) / 10),
      zones,
    })
  }

  // ── Matches ──────────────────────────────────────────────
  const shoeFor = (surface, dateStr) => {
    if (surface === 'terra') return scarpaTerra.id
    return dateStr < '2026-01-01' ? scarpaVecchia.id : scarpaCemento.id
  }

  const rawMatches = [
    { date: '2025-09-06', type: 'amichevole', surface: 'cemento', format: 'atp', opp: oMarco, sets: [S(6, 3), S(6, 4)], intensity: 'media', notes: [note('Buona partita di rodaggio dopo la pausa estiva.', '2025-09-06')], athletics: { minutes: 88, intensity: 'media' } },
    { date: '2025-09-20', type: 'campionato', eventName: 'Campionato UISP D2 2025/26', surface: 'cemento', format: 'atp', opp: oAndrea, sets: [S(4, 6), S(6, 3), S(7, 6, 9, 7)], intensity: 'intensa', athletics: { minutes: 132, intensity: 'intensa' } },
    { date: '2025-10-04', type: 'amichevole', surface: 'terra', format: 'amatoriale', opp: oLuca, sets: [S(6, 4), S(3, 6), S(7, 10)], intensity: 'media' },
    { date: '2025-10-18', type: 'campionato', eventName: 'Campionato UISP D2 2025/26', surface: 'indoor', format: 'atp', opp: oSimone, sets: [S(3, 6), S(4, 6)], intensity: 'leggera' },
    { date: '2025-11-08', type: 'torneo', eventName: 'Torneo Sprint Brianza', round: 'qualificazioni', surface: 'terra', format: 'amatoriale', opp: oGiulia, sets: [S(6, 2), S(6, 3)], intensity: 'media', racchetta: racchettaB.id },
    { date: '2025-11-15', type: 'torneo', eventName: 'Torneo Sprint Brianza', round: 'ottavi', surface: 'terra', format: 'amatoriale', opp: oAndrea, sets: [S(6, 3), S(4, 6), S(8, 10)], intensity: 'intensa', racchetta: racchettaB.id, notes: [note('Eliminato agli ottavi, super tie-break perso 10-8.', '2025-11-15')] },
    { date: '2025-11-29', type: 'amichevole', surface: 'cemento', format: 'atp', opp: oMarco, sets: [S(7, 5), S(6, 2)], intensity: 'media' },
    { date: '2025-12-06', type: 'campionato', eventName: 'Campionato UISP D2 2025/26', surface: 'cemento', format: 'atp', opp: oLuca, sets: [S(6, 4), S(6, 4)], intensity: 'media' },
    { date: '2025-12-13', type: 'amichevole', surface: 'indoor', format: 'atp', opp: oSimone, sets: [S(6, 4), S(4, 6)], intensity: 'leggera', notes: [note('Interrotta per fine slot campo indoor, sul pari.', '2025-12-13')] },
    { date: '2026-01-10', type: 'amichevole', surface: 'indoor', format: 'ics', opp: oAndrea, sets: [S(6, 4)], intensity: 'media' },
    { date: '2026-01-24', type: 'amichevole', surface: 'cemento', format: 'atp', opp: oMarco, sets: [S(6, 3), S(3, 6), S(4, 6)], intensity: 'media', athletics: { minutes: 140, intensity: 'media' } },
    { date: '2026-02-07', type: 'torneo', eventName: 'Torneo Open Como', round: 'quarti', surface: 'cemento', format: 'amatoriale', opp: oSimone, sets: [S(3, 6), S(6, 4), S(10, 8)], intensity: 'intensa', racchetta: racchettaB.id },
    { date: '2026-02-21', type: 'torneo', eventName: 'Torneo Open Como', round: 'semifinale', surface: 'cemento', format: 'amatoriale', opp: oGiulia, sets: [S(4, 6), S(3, 6)], intensity: 'intensa', racchetta: racchettaB.id, notes: [note('Uscito in semifinale, avversaria troppo solida da fondo.', '2026-02-21')] },
    { date: '2026-02-28', type: 'campionato', eventName: 'Campionato UISP D2 2025/26', surface: 'cemento', format: 'atp', opp: oAndrea, sets: [S(6, 2), S(6, 3)], intensity: 'media' },
    { date: '2026-03-07', type: 'amichevole', surface: 'terra', format: 'amatoriale', opp: oLuca, sets: [S(6, 3), S(6, 4)], intensity: 'media', athletics: { minutes: 95, intensity: 'media' } },
    { date: '2026-03-21', type: 'amichevole', surface: 'cemento', format: 'atp', opp: oMarco, sets: [S(6, 2)], retired: 'opp', intensity: 'leggera', notes: [note("Si è ritirato per un problema alla caviglia sul 6-2.", '2026-03-21')] },
    { date: '2026-04-04', type: 'torneo', eventName: 'Torneo Città di Milano', round: 'ottavi', surface: 'terra', format: 'amatoriale', opp: oAndrea, sets: [S(6, 3), S(6, 2)], intensity: 'media', racchetta: racchettaB.id },
    { date: '2026-04-11', type: 'torneo', eventName: 'Torneo Città di Milano', round: 'quarti', surface: 'terra', format: 'amatoriale', opp: oSimone, sets: [S(4, 6), S(6, 3), S(10, 6)], intensity: 'intensa', racchetta: racchettaB.id },
    { date: '2026-04-18', type: 'torneo', eventName: 'Torneo Città di Milano', round: 'semifinale', surface: 'terra', format: 'amatoriale', opp: oLuca, sets: [S(7, 6, 7, 4), S(6, 4)], intensity: 'intensa', racchetta: racchettaB.id, athletics: { minutes: 118, intensity: 'intensa' } },
    { date: '2026-04-25', type: 'torneo', eventName: 'Torneo Città di Milano', round: 'finale', surface: 'terra', format: 'amatoriale', opp: oGiulia, sets: [S(3, 6), S(6, 4), S(10, 8)], intensity: 'intensa', racchetta: racchettaB.id, notes: [note('Vinto il torneo! Finale tiratissima decisa al super tie-break.', '2026-04-25')], athletics: { minutes: 145, intensity: 'intensa' } },
    { date: '2026-05-09', type: 'amichevole', surface: 'cemento', format: 'atp', opp: oMarco, sets: [S(6, 1), S(6, 2)], intensity: 'media' },
    { date: '2026-05-23', type: 'campionato', eventName: 'Campionato UISP D2 2026/27', surface: 'cemento', format: 'atp', opp: oAndrea, sets: [S(6, 4), S(4, 6), S(3, 6)], intensity: 'intensa' },
    { date: '2026-06-06', type: 'amichevole', surface: 'terra', format: 'amatoriale', opp: oLuca, sets: [S(6, 4), S(7, 5)], intensity: 'media', athletics: { minutes: 102, intensity: 'media' } },
    { date: '2026-06-20', type: 'amichevole', surface: 'cemento', format: 'grandslam', opp: oSimone, sets: [S(6, 4), S(3, 6), S(6, 2), S(7, 6, 10, 8)], intensity: 'intensa', notes: [note('Simulazione al meglio dei 5 set per preparazione fisica.', '2026-06-20')], athletics: { minutes: 175, intensity: 'intensa' } },
    { date: '2026-07-04', type: 'campionato', eventName: 'Campionato UISP D2 2026/27', surface: 'cemento', format: 'atp', opp: oMarco, sets: [S(6, 3), S(6, 2)], intensity: 'media' },
    { date: '2026-07-18', type: 'amichevole', surface: 'terra', format: 'amatoriale', opp: oGiulia, sets: [S(2, 6), S(4, 6)], intensity: 'media' },
    { date: '2026-08-02', type: 'torneo', eventName: 'Torneo Estivo Villa Comunale', round: null, surface: 'cemento', format: 'amatoriale', opp: oAndrea, sets: [S(6, 3), S(6, 4)], intensity: 'media' },
    { date: '2026-08-10', type: 'torneo', eventName: 'Torneo Autunno Città', round: 'quarti', surface: 'cemento', format: 'amatoriale', opp: oLuca, sets: [S(4, 6), S(6, 3), S(10, 7)], intensity: 'intensa' },
    { date: '2026-08-15', type: 'amichevole', surface: 'cemento', format: 'atp', opp: oMarco, sets: [S(6, 4), S(6, 3)], intensity: 'intensa', athletics: { minutes: 98, intensity: 'intensa' } },
  ]

  const matchesCol = userRef.collection('matches')
  let matchBatch = db.batch()
  let opsInBatch = 0
  let matchCount = 0

  for (const m of rawMatches) {
    const outcome = computeOutcome(m.sets, m.format, m.retired || null)
    const racchettaId = m.racchetta || racchettaA.id
    const doc = {
      date: iso(m.date),
      opponentId: m.opp.id,
      opponentName: oppNames[m.opp.id],
      type: m.type,
      eventName: m.eventName || null,
      round: m.round !== undefined ? m.round : null,
      surface: m.surface,
      format: m.format,
      sets: m.sets,
      retired: m.retired || null,
      result: outcome.result,
      completed: outcome.completed,
      setsMe: outcome.setsMe,
      setsOpp: outcome.setsOpp,
      equipment: {
        racchetta: racchettaId,
        scarpa: shoeFor(m.surface, m.date),
        outfit: outfit.id,
        borsone: null,
      },
      intensity: m.intensity || null,
      athletics: m.athletics ? athleticsFor(m.athletics) : null,
      notes: m.notes || [],
      createdAt: ts(m.date),
    }
    const ref = matchesCol.doc()
    matchBatch.set(ref, doc)
    opsInBatch++
    matchCount++
    if (opsInBatch >= 400) { await matchBatch.commit(); matchBatch = db.batch(); opsInBatch = 0 }
  }
  if (opsInBatch > 0) await matchBatch.commit()
  console.log(`Partite create: ${matchCount}`)

  // ── Trainings ────────────────────────────────────────────
  // Filler settimanale su tutto il periodo + sessioni "storyline" esplicite
  // per trend valutazioni, trascuratezza e punti ciechi.
  const trainingKindsPool = ['sparring', 'lezione', 'gruppo', 'servizio', 'macchina', 'matchplay', 'atletica']
  const focusPoolFondo = ['dritto', 'rovescio', 'rovescio-back', 'colpo-in-corsa', 'passante']
  const focusPoolRete = ['volee-dritto', 'volee-rovescio', 'smash', 'stop-volley']
  const focusPoolServizio = ['servizio-piatto', 'servizio-kick', 'seconda-servizio', 'piazzamento-servizio']
  const focusPoolSchemi = ['servizio-piu-uno', 'cambio-lungolinea', 'lato-debole', 'punti-pressione']
  const focusPoolFisico = ['footwork', 'atletica', 'match-play', 'tattica']

  function weekdayDates(startStr, endStr, everyDays) {
    const out = []
    let d = new Date(startStr)
    const end = new Date(endStr)
    while (d <= end) {
      out.push(d.toISOString().slice(0, 10))
      d = new Date(d.getTime() + everyDays * 86400000 + randInt(-1, 2) * 86400000)
    }
    return out
  }

  const trainingDates = weekdayDates('2025-09-04', '2026-08-17', 11)

  const rawTrainings = trainingDates.map((date, i) => {
    const nBlocks = randInt(1, 2)
    const blocks = []
    const usedKinds = new Set()
    for (let b = 0; b < nBlocks; b++) {
      let kind = pick(trainingKindsPool)
      while (usedKinds.has(kind) && usedKinds.size < trainingKindsPool.length) kind = pick(trainingKindsPool)
      usedKinds.add(kind)
      blocks.push({ kind, minutes: pick([45, 60, 60, 90]) })
    }
    const surface = pick(['terra', 'cemento', 'cemento', 'indoor'])
    const intensity = pick(['media', 'media', 'leggera', 'intensa'])
    const withWhomPool = [null, null, { label: 'Maestro Paolo', opponentId: null }, { label: 'Compagno di circolo', opponentId: null }]
    const withWhom = pick(withWhomPool)
    const hasAthletics = rng() < 0.35
    const totalMinutes = blocks.reduce((s, b) => s + b.minutes, 0)

    // Focus: variano nel tempo, con narrative esplicite iniettate sotto
    const focusChoices = [focusPoolFondo, focusPoolRete, focusPoolServizio, focusPoolSchemi, focusPoolFisico]
    const nFocusGroups = randInt(1, 2)
    let focus = []
    for (let g = 0; g < nFocusGroups; g++) {
      const group = pick(focusChoices)
      focus.push(pick(group))
    }
    focus = [...new Set(focus)]

    const ratings = {}
    focus.forEach(f => { if (rng() < 0.6) ratings[f] = randInt(2, 4) })

    return {
      date, blocks, surface, focus, ratings,
      intensity, withWhom,
      brokeStrings: false,
      athletics: hasAthletics ? { minutes: totalMinutes, intensity } : null,
      notes: [],
      _idx: i,
    }
  })

  // ── Narrativa: trend di miglioramento su 'dritto' (7 valutazioni crescenti) ──
  const drittoDates = ['2025-09-11', '2025-10-09', '2025-11-13', '2025-12-18', '2026-02-12', '2026-04-16', '2026-06-25']
  const drittoRatings = [2, 2, 3, 3, 4, 4, 5]
  drittoDates.forEach((date, i) => {
    rawTrainings.push({
      date, blocks: [{ kind: 'lezione', minutes: 60 }, { kind: 'macchina', minutes: 30 }],
      surface: 'cemento', focus: ['dritto', 'dritto-anomalo'],
      ratings: { dritto: drittoRatings[i] },
      intensity: 'media', withWhom: { label: 'Maestro Paolo', opponentId: null },
      brokeStrings: false, athletics: null, notes: [],
    })
  })

  // ── Narrativa: servizio-piatto sempre valutato basso e poco lavorato (blind spot) ──
  ;['2025-10-22', '2026-03-04'].forEach(date => {
    rawTrainings.push({
      date, blocks: [{ kind: 'servizio', minutes: 45 }],
      surface: 'cemento', focus: ['servizio-piatto'],
      ratings: { 'servizio-piatto': 2 },
      intensity: 'media', withWhom: null,
      brokeStrings: false, athletics: null, notes: [],
    })
  })

  // ── Narrativa: smash valutato una sola volta (flag "single" nei punti ciechi) ──
  rawTrainings.push({
    date: '2026-05-14', blocks: [{ kind: 'lezione', minutes: 60 }],
    surface: 'cemento', focus: ['smash', 'volee-dritto'],
    ratings: { smash: 2 },
    intensity: 'media', withWhom: { label: 'Maestro Paolo', opponentId: null },
    brokeStrings: false, athletics: null, notes: [],
  })

  // ── Narrativa: servizio-slice lavorato solo a inizio periodo (trascuratezza) ──
  ;['2025-09-08', '2025-09-29'].forEach(date => {
    rawTrainings.push({
      date, blocks: [{ kind: 'servizio', minutes: 45 }],
      surface: 'cemento', focus: ['servizio-slice'],
      ratings: { 'servizio-slice': 3 },
      intensity: 'media', withWhom: null,
      brokeStrings: false, athletics: null, notes: [],
    })
  })

  // ── Narrativa: rotture corde in allenamento (2 sessioni) ──
  rawTrainings.push({
    date: '2025-11-20', blocks: [{ kind: 'macchina', minutes: 60 }],
    surface: 'cemento', focus: ['dritto', 'rovescio'], ratings: {},
    intensity: 'intensa', withWhom: null, brokeStrings: true, athletics: null, notes: [],
  })
  rawTrainings.push({
    date: '2026-03-19', blocks: [{ kind: 'sparring', minutes: 90 }],
    surface: 'terra', focus: ['dritto'], ratings: {},
    intensity: 'intensa', withWhom: { label: 'Compagno di circolo', opponentId: oLuca.id },
    brokeStrings: true, athletics: null, notes: [],
  })

  // Nota testuale su un paio di sessioni
  rawTrainings.push({
    date: '2026-07-09', blocks: [{ kind: 'atletica', minutes: 60 }],
    surface: null, focus: ['footwork', 'atletica'], ratings: { footwork: 3 },
    intensity: 'intensa', withWhom: null, brokeStrings: false,
    athletics: { minutes: 60, intensity: 'intensa' },
    notes: [note('Sessione di footwork pura in vista del torneo di agosto.', '2026-07-09')],
  })

  rawTrainings.sort((a, b) => new Date(a.date) - new Date(b.date))

  const trainingsCol = userRef.collection('trainings')
  let trainBatch = db.batch()
  let trainOps = 0
  let trainCount = 0

  for (const t of rawTrainings) {
    if (t.date > '2026-08-17') continue // niente allenamenti nel futuro
    const doc = {
      date: iso(t.date),
      blocks: t.blocks,
      surface: t.surface || null,
      focus: t.focus || [],
      ratings: t.ratings || {},
      intensity: t.intensity,
      withWhom: t.withWhom || null,
      brokeStrings: !!t.brokeStrings,
      equipment: {
        racchetta: racchettaA.id,
        scarpa: t.surface ? shoeFor(t.surface, t.date) : scarpaCemento.id,
        outfit: outfit.id,
        borsone: null,
      },
      athletics: t.athletics ? athleticsFor(t.athletics) : null,
      notes: t.notes || [],
      createdAt: ts(t.date),
    }
    const ref = trainingsCol.doc()
    trainBatch.set(ref, doc)
    trainOps++
    trainCount++
    if (trainOps >= 400) { await trainBatch.commit(); trainBatch = db.batch(); trainOps = 0 }
  }
  if (trainOps > 0) await trainBatch.commit()
  console.log(`Allenamenti creati: ${trainCount}`)

  // ── Corsa: schede e sessioni ─────────────────────────────
  // Le strutture sono scritte già nella forma normalizzata di
  // normalizeItems (src/lib/running.js): quel modulo non si importa da qui
  // perché usa import senza estensione, che risolve Vite ma non Node.
  let stepSeq = 0
  const st = (stepType, target, duration, notes = '') => ({ kind: 'step', id: `s${++stepSeq}`, stepType, notes, duration, target })
  const time = sec => ({ type: 'time', sec })
  const dist = (meters, unit = 'km') => ({ type: 'distance', meters, unit })
  const rep = (times, steps, skipLastRecovery = false) => ({ kind: 'repeat', id: `r${++stepSeq}`, times, skipLastRecovery, steps })

  const workoutsCol = userRef.collection('runWorkouts')
  // HIIT sullo schema dello screenshot Garmin: ripetute brevi, recuperi a FC
  // (fase stimata, tratteggiata nel grafico) e salto dell'ultimo recupero.
  const hiitItems = [
    st('camminata', 'camminata', time(180)),
    st('riscaldamento', 'z1', time(600)),
    st('camminata', 'camminata', time(120)),
    rep(5, [st('corsa', 'z5', time(15)), st('recupero', 'camminata', time(45))]),
    rep(8, [
      st('corsa', 'z5', time(10)),
      st('corsa', 'z4', dist(200, 'm')),
      st('recupero', 'fermo', { type: 'hr', bpm: 120, condition: 'sotto', estimatedSec: 90 }),
    ], true),
    st('defaticamento', 'z1', dist(1500)),
    st('camminata', 'camminata', time(180)),
  ]
  const lentoItems = [st('corsa', 'z2', dist(8000), 'Conversazionale, senza guardare il passo')]
  const ripetuteItems = [
    st('riscaldamento', 'z1', time(900)),
    rep(4, [st('corsa', 'z4', dist(1000)), st('recupero', 'camminata', time(120))], true),
    st('defaticamento', 'z1', { type: 'calories', kcal: 60 }),
  ]
  const progressivoItems = [
    st('riscaldamento', 'z1', time(600)),
    st('corsa', 'z2', time(900)),
    st('corsa', 'z3', time(900)),
    st('corsa', 'z4', time(600)),
    st('defaticamento', 'z1', time(300)),
  ]
  const wHiit = await workoutsCol.add({ name: 'HIIT brevi distanze', items: hiitItems, createdAt: ts('2026-06-01') })
  const wLento = await workoutsCol.add({ name: 'Lento 8 km', items: lentoItems, createdAt: ts('2026-06-01') })
  const wRipetute = await workoutsCol.add({ name: 'Ripetute 1000', items: ripetuteItems, createdAt: ts('2026-06-10') })
  // Mai corsa: per lo stato "Mai corsa" della libreria
  await workoutsCol.add({ name: 'Progressivo 45\'', items: progressivoItems, createdAt: ts('2026-08-01') })

  // Dati dell'orologio coerenti con un passo medio (s/km) e una distanza.
  const runAthletics = (km, paceSec, intensity) => normalizeAthletics({
    distanceKm: km,
    durationSec: Math.round(km * paceSec),
    calories: Math.round(km * 72),
    avgHr: { leggera: randInt(135, 145), media: randInt(145, 155), intensa: randInt(155, 168) }[intensity],
    maxHr: randInt(170, 186),
    trainingEffect: { leggera: 2.6, media: 3.2, intensa: 3.9 }[intensity],
    anaerobicTrainingEffect: { leggera: 0.8, media: 1.6, intensa: 2.8 }[intensity],
    zones: null,
  })

  const rawRuns = [
    { date: '2026-06-03', w: wLento, name: 'Lento 8 km', items: lentoItems, intensity: 'leggera', ath: [8.1, 400, 'leggera'] },
    { date: '2026-06-10', w: wHiit, name: 'HIIT brevi distanze', items: hiitItems, intensity: 'intensa', ath: [6.9, 455, 'intensa'] },
    { date: '2026-06-17', w: wRipetute, name: 'Ripetute 1000', items: ripetuteItems, intensity: 'intensa', ath: [7.6, 390, 'intensa'] },
    { date: '2026-06-24', w: wLento, name: 'Lento 8 km', items: lentoItems, intensity: 'leggera', ath: null },
    { date: '2026-07-01', w: wHiit, name: 'HIIT brevi distanze', items: hiitItems, intensity: 'intensa', ath: [7.1, 450, 'intensa'] },
    // Variante di un giorno: 3 ripetute invece di 4, senza toccare la scheda
    { date: '2026-07-08', w: wRipetute, name: 'Ripetute 1000', intensity: 'media', ath: [6.4, 395, 'media'],
      items: [ripetuteItems[0], { ...ripetuteItems[1], times: 3 }, ripetuteItems[2]],
      notes: [note('Caldo: fatte 3 ripetute invece di 4.', '2026-07-08')] },
    { date: '2026-07-22', w: wLento, name: 'Lento 8 km', items: lentoItems, intensity: 'media', ath: [8.0, 385, 'media'] },
    // Scheda eliminata dalla libreria: la corsa conserva nome e struttura
    { date: '2026-07-29', w: { id: 'scheda-eliminata' }, name: 'Collinare 6 km', intensity: 'media', ath: [6.2, 430, 'media'],
      items: [st('riscaldamento', 'z1', time(600)), st('corsa', 'z3', dist(6000)), st('defaticamento', 'z1', time(300))] },
    { date: '2026-08-05', w: wHiit, name: 'HIIT brevi distanze', items: hiitItems, intensity: 'intensa', ath: null },
    { date: '2026-08-12', w: wRipetute, name: 'Ripetute 1000', items: ripetuteItems, intensity: 'intensa', ath: [7.7, 385, 'intensa'] },
  ]

  const runsCol = userRef.collection('runs')
  const runBatch = db.batch()
  rawRuns.forEach(r => {
    runBatch.set(runsCol.doc(), {
      date: iso(r.date),
      workoutId: r.w.id,
      workoutName: r.name,
      items: r.items,
      intensity: r.intensity,
      athletics: r.ath ? runAthletics(...r.ath) : null,
      notes: r.notes || [],
      createdAt: ts(r.date),
    })
  })
  await runBatch.commit()
  console.log(`Corse create: ${rawRuns.length} (4 schede, di cui una mai corsa)`)

  // ── Palestra: esercizio personalizzato, schede e sessioni ─
  // Gli esercizi si citano per id del database (src/data/exercises.json); quello
  // personalizzato ha id `custom:<docId>` e le sue sessioni portano lo snapshot,
  // come fa normalizeItems (src/lib/gym.js).
  const customCol = userRef.collection('gymExercises')
  const customDef = { name: 'Rematore Pendlay', equipment: 'bilanciere', mode: 'reps-kg', primary: ['dorsali'], secondary: ['trapezio', 'bicipiti', 'lombari'] }
  const customRef = await customCol.add({ ...customDef, createdAt: ts('2026-06-01') })
  const customId = `custom:${customRef.id}`
  const gi = (exerciseId, sets, extra = {}) => ({ id: `g${++stepSeq}`, exerciseId, sets, ...extra })
  const uni = (n, set) => Array.from({ length: n }, () => ({ ...set }))
  const pendlay = kg => gi(customId, uni(4, { reps: 6, kg }), { snapshot: { ...customDef, movement: 'pull' } })

  const pushItems = kg => [
    gi('panca-piana-bilanciere', [{ reps: 8, kg }, { reps: 8, kg }, { reps: 6, kg: kg + 5 }, { reps: 6, kg: kg + 5 }]),
    gi('shoulder-press-manubri', uni(3, { reps: 10, kg: 18 + Math.round((kg - 60) / 10) * 2 })),
    gi('alzate-laterali', uni(3, { reps: 15, kg: 8 })),
    gi('pushdown-cavi', uni(3, { reps: 12, kg: 30 })),
  ]
  const pullItems = kg => [
    pendlay(kg),
    gi('trazioni-prone', uni(4, { reps: 6 })),
    gi('pulley-basso', uni(3, { reps: 10, kg: 55 })),
    gi('curl-bilanciere', uni(3, { reps: 10, kg: 30 })),
    gi('face-pull', uni(3, { reps: 15, kg: 20 })),
  ]
  const legsItems = kg => [
    gi('squat-bilanciere', uni(4, { reps: 5, kg })),
    gi('stacco-rumeno', uni(3, { reps: 8, kg: kg - 20 })),
    gi('leg-press', uni(3, { reps: 12, kg: 140 })),
    gi('calf-raise-in-piedi', uni(3, { reps: 15, kg: 60 })),
    gi('plank', [{ sec: 45 }, { sec: 60 }, { sec: 60 }]),
  ]

  const gymWorkoutsCol = userRef.collection('gymWorkouts')
  const gPush = await gymWorkoutsCol.add({ name: 'Push', items: pushItems(70), createdAt: ts('2026-06-01') })
  const gPull = await gymWorkoutsCol.add({ name: 'Pull', items: pullItems(60), createdAt: ts('2026-06-01') })
  const gLegs = await gymWorkoutsCol.add({ name: 'Gambe', items: legsItems(90), createdAt: ts('2026-06-01') })
  // Mai fatta: per lo stato "Mai fatta" della libreria
  await gymWorkoutsCol.add({
    name: 'Full body A',
    items: [gi('goblet-squat', uni(3, { reps: 12, kg: 20 })), gi('piegamenti', uni(3, { reps: 15 })), gi('rematore-manubrio', uni(3, { reps: 10, kg: 24 })), gi('crunch', uni(3, { reps: 20 }))],
    createdAt: ts('2026-08-20'),
  })

  const gymAthletics = (min, hr, intensity) => normalizeAthletics({
    durationSec: min * 60,
    calories: Math.round(min * 5.5),
    avgHr: hr,
    maxHr: hr + randInt(25, 40),
    trainingEffect: { leggera: 1.2, media: 2.0, intensa: 2.8 }[intensity],
    anaerobicTrainingEffect: { leggera: 0, media: 0.4, intensa: 1.2 }[intensity],
    zones: null,
  })

  // Dieci settimane, tre sessioni a settimana con carichi che salgono piano:
  // dà alla sezione Stats progressione, bilancio e qualche buco (una settimana
  // saltata, il pull che sparisce nell'ultimo mese).
  const gymSeed = []
  const start = new Date('2026-07-06T00:00:00Z')
  for (let w = 0; w < 12; w++) {
    const monday = new Date(start.getTime() + w * 7 * 86400000)
    const at = d => new Date(monday.getTime() + d * 86400000).toISOString().slice(0, 10)
    if (w === 6) continue
    const up = w * 2.5
    gymSeed.push({ date: at(0), w: gPush, name: 'Push', items: pushItems(70 + up), intensity: 'media', ath: w % 2 ? [58, 112, 'media'] : null })
    if (w < 8) gymSeed.push({ date: at(2), w: gPull, name: 'Pull', items: pullItems(60 + up), intensity: 'media', ath: null })
    gymSeed.push({ date: at(4), w: gLegs, name: 'Gambe', items: legsItems(90 + up), intensity: w % 3 === 0 ? 'intensa' : 'media', ath: w % 3 === 0 ? [64, 121, 'intensa'] : null,
      notes: w === 3 ? [note('Ginocchio un po\' fastidioso, carico ridotto sul leg press.', at(4))] : [] })
  }
  const gymCol = userRef.collection('gymSessions')
  for (let i = 0; i < gymSeed.length; i += 400) {
    const b = db.batch()
    gymSeed.slice(i, i + 400).forEach(g => {
      b.set(gymCol.doc(), {
        date: iso(g.date),
        workoutId: g.w.id,
        workoutName: g.name,
        items: g.items,
        intensity: g.intensity,
        athletics: g.ath ? gymAthletics(...g.ath) : null,
        notes: g.notes || [],
        createdAt: ts(g.date),
      })
    })
    await b.commit()
  }
  console.log(`Sessioni di palestra create: ${gymSeed.length} (3 schede in uso, una mai fatta, 1 esercizio personalizzato)`)

  // ── Profilo ──────────────────────────────────────────────
  // `running` è la tabella zone → passo (s/km) che sblocca la corsa.
  await userRef.update({
    profile: {
      dominantHand: 'destro', level: '3.4', birthYear: 1994, playingSince: 2008,
      running: {
        zones: [[480, 540], [420, 460], [380, 420], [340, 380], [300, 340], [260, 300], [220, 260]].map(([fast, slow]) => ({ fast, slow })),
        walk: { fast: 570, slow: 690 },
        weightKg: 74,
      },
    },
    updatedAt: FieldValue.serverTimestamp(),
  })
  console.log('Profilo aggiornato')

  console.log('\n✅ Seed completato con successo su', DEV_PROJECT_ID)
  console.log(`   Equipment: 7 · Avversari: 6 · Partite: ${matchCount} · Allenamenti: ${trainCount} · Corse: ${rawRuns.length} · Palestra: ${gymSeed.length}`)
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Errore durante il seed:', err)
  process.exit(1)
})
