// ── Statistiche: tecnica ────────────────────────────────────
// Settimo modulo puro di src/lib/ (nessun React, nessun Firestore), sulla stessa
// linea di tennis.js / training.js / athletics.js / wear.js / stats.js /
// activity.js.
//
// ── La domanda ──
// Rendimento chiede "quanto sono forte", Attività "quanto ci sono stato". Qui la
// domanda è "su COSA sto lavorando, e sta funzionando?": è il diario dei focus
// letto come dati. La materia prima sono due campi soli della sessione di
// allenamento — `focus` (array piatto di id, dalle 47 voci di FOCUS_CATEGORIES)
// e `ratings` (mappa focusId → 1..5) — e tutto quello che segue è costruito su
// quei due.
//
// ── L'unità è la SESSIONE, non il minuto, e non è un dettaglio ──
// In Attività si contano i minuti perché ogni blocco ha la sua durata. Qui non
// si può: il `focus` è della SESSIONE, non del singolo blocco, quindi non esiste
// alcun modo di dire quanti dei 90 minuti sono andati sul dritto e quanti sul
// servizio. Attribuire i minuti in parti uguali sarebbe inventare un dato che i
// documenti non contengono. Finché il legame focus↔blocco non esiste, si conta
// per sessioni — e la UI deve dirlo, non lasciarlo intendere.
//
// ── Cosa segue il periodo e cosa è "adesso" ──
// Heatmap, radar, trend delle valutazioni e punti ciechi seguono il periodo
// scelto in pagina. Trascuratezza ("non lavori il servizio da 47 giorni") e
// copertura ("quante delle 47 voci hai MAI toccato") no: sono fatti del presente
// e dell'intero storico, esattamente come ACWR e striscia attiva in Attività.
// Un "non lo lavori da 47 giorni" ricalcolato dentro la finestra dei 90 giorni
// direbbe una cosa diversa a ogni cambio di periodo, per lo stesso identico
// fatto.
//
// ── Le auto-valutazioni misurano anche l'umore ──
// Le stelline sono un giudizio che il giocatore dà a sé stesso a fine sessione:
// non sono una misura del colpo, sono una misura di come il colpo gli è sembrato
// quel giorno. Restano il dato più utile che abbiamo (nessuno filma i suoi
// allenamenti) ma vanno lette come una serie soggettiva — il modulo le espone,
// la UI dichiara il limite.

import { FOCUS_CATEGORIES, FOCUS_BY_ID, FOCUS_IDS, MAX_RATING } from './training'
import { dayTime } from './stats'
import { todayTime, MONTHS_SHORT } from './activity'

// ── Soglie minime di campione ──────────────────────────────
export const MIN_TECHNIQUE     = 6   // sessioni con almeno un focus, per aprire la sezione
export const MIN_RATINGS_TREND = 2   // valutazioni sulla stessa voce, per parlare di trend
export const MIN_BLIND_POINTS  = 4   // voci valutate, perché un 2×2 sia leggibile

// Giorni dall'ultima volta oltre i quali una voce è "in ritardo" e poi "ferma".
// Non sono soglie fisiologiche: sono la scala su cui un amatore riconosce di
// aver perso di vista un colpo (un mese = tre o quattro sessioni saltate).
export const NEGLECT_WARN = 30
export const NEGLECT_BAD  = 60

// Colonne massime della heatmap: su "Sempre" con tre stagioni registrate le
// celle diventerebbero 36 per riga e su mobile sarebbero larghe 5px.
export const HEATMAP_MONTHS = 12

// Assi del 2×2. La soglia delle valutazioni è il centro della scala (3 su 5),
// che è oggettivo; quella del volume è adattiva (la mediana), perché "poco
// lavorato" ha senso solo rispetto a quanto lavori il resto.
export const RATING_MID     = (MAX_RATING + 1) / 2
export const MIN_VOLUME_MID = 2

export const TOTAL_FOCUS = FOCUS_IDS.length   // 47

// Etichette corte per la colonna di sinistra della heatmap: a 12 colonne su
// mobile restano ~54px, dove "Schemi e situazioni" verrebbe troncato a "Schemi
// e s...". Le etichette intere restano ovunque ci sia spazio.
const SHORT_LABELS = {
  servizio: 'Servizio', risposta: 'Risposta', fondo: 'Fondo', rete: 'Rete',
  transizione: 'Transiz.', schemi: 'Schemi', condizionale: 'Fisico',
}

export const CATEGORY_META = FOCUS_CATEGORIES.map(c => ({
  id: c.id,
  label: c.label,
  short: SHORT_LABELS[c.id] || c.label,
  icon: c.icon,
  total: c.items.length,
}))

// ── Sessioni normalizzate ──────────────────────────────────
// Una sessione senza focus non è un dato per questa sezione: è avvenuta (e
// conta in Attività), ma non dice niente su cosa si stia costruendo. Le voci
// duplicate nello stesso documento vengono collassate: due volte "dritto" nella
// stessa sessione resta una sessione di dritto.
//
// Un id VALUTATO ma non presente nel focus viene comunque contato come lavorato:
// il wizard oggi non lo permette (`normalizeRatings` scarta le voci orfane), ma
// un documento più vecchio potrebbe averlo, e una voce a cui si è dato un voto è
// per definizione una voce su cui si è lavorato.

export function toFocusSessions(trainings = []) {
  const out = []

  trainings.forEach(t => {
    const day = dayTime(t.date)
    if (day == null) return

    const ratings = {}
    Object.entries(t.ratings || {}).forEach(([id, value]) => {
      if (!FOCUS_BY_ID[id]) return
      if (typeof value !== 'number' || !Number.isFinite(value)) return
      if (value < 1 || value > MAX_RATING) return
      ratings[id] = value
    })

    const focus = [...new Set([...(t.focus || []), ...Object.keys(ratings)])]
      .filter(id => FOCUS_BY_ID[id])
    if (!focus.length) return

    out.push({ id: t.id, day, date: t.date, focus, ratings })
  })

  return out.sort((a, b) => a.day - b.day)
}

// ── Uso dei focus nel periodo ──────────────────────────────
// Due letture della stessa cosa: la voce singola (per gli alert e il 2×2) e la
// categoria (per il radar). Il denominatore delle quote sono le coppie
// voce×sessione, non le sessioni: una sessione che lavora tre voci di fondo e
// una di rete è prevalentemente una sessione di fondo, e contarla come "una per
// categoria" la appiattirebbe.

export function focusUsage(sessions) {
  const byId = new Map()

  sessions.forEach(s => {
    s.focus.forEach(id => {
      if (!byId.has(id)) {
        const meta = FOCUS_BY_ID[id]
        byId.set(id, {
          id, label: meta.label,
          categoryId: meta.categoryId, categoryLabel: meta.categoryLabel, categoryIcon: meta.categoryIcon,
          n: 0, ratings: [], lastDay: null, firstDay: s.day,
        })
      }
      const row = byId.get(id)
      row.n++
      row.lastDay = s.day
      if (s.ratings[id] != null) row.ratings.push(s.ratings[id])
    })
  })

  const total = sum([...byId.values()], r => r.n)

  const rows = [...byId.values()]
    .map(r => ({
      ...r,
      share: total ? r.n / total : 0,
      rating: r.ratings.length ? mean(r.ratings) : null,
      ratingCount: r.ratings.length,
    }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))

  const byCategory = CATEGORY_META.map(c => {
    const voci = rows.filter(r => r.categoryId === c.id)
    const n = sum(voci, r => r.n)
    return {
      ...c,
      voci,
      n,
      share: total ? n / total : 0,
      touched: voci.length,
      sessions: sessions.filter(s => s.focus.some(id => FOCUS_BY_ID[id].categoryId === c.id)).length,
    }
  })

  // Concentrazione: quota delle prime tre voci sul totale del lavoro. Alta non è
  // un difetto (un periodo può essere dedicato), ma è il contesto che serve per
  // leggere tutto il resto della sezione.
  const top3 = rows.slice(0, 3)

  return {
    rows, byCategory, total,
    sessions: sessions.length,
    distinct: rows.length,
    top3,
    top3Share: total ? sum(top3, r => r.n) / total : null,
  }
}

// ── Heatmap categoria × mese ───────────────────────────────
// L'idea originale era 47 voci × bucket temporali, ma su mobile 47 righe sono
// uno schermo e mezzo di celle da 6px: la griglia diventa un tappeto e non si
// legge nulla. Le 7 categorie stanno in uno schermo, e la singola voce si
// raggiunge aprendo la riga — il dettaglio non si perde, si mette a un tap.
//
// La cella conta le SESSIONI in cui almeno una voce di quella categoria è stata
// lavorata (vedi la nota sull'unità in testa al file), non i minuti.

export function focusHeatmap(sessions, range) {
  const today = todayTime()
  const first = sessions.length ? sessions[0].day : today
  const last  = sessions.length ? sessions[sessions.length - 1].day : today

  const startTime = range ? range.start.getTime() : first
  const endTime   = range ? range.end.getTime()   : Math.max(last, today)

  const from = monthIndex(startTime)
  const to   = monthIndex(endTime)

  const all = []
  for (let i = from; i <= to && all.length < 600; i++) all.push(monthMeta(i))

  const truncated = all.length > HEATMAP_MONTHS
  const months = truncated ? all.slice(-HEATMAP_MONTHS) : all
  const keep = new Set(months.map(m => m.index))

  const byCat = new Map(CATEGORY_META.map(c => [c.id, new Map()]))
  const totals = new Map()

  sessions.forEach(s => {
    const mi = monthIndex(s.day)
    if (!keep.has(mi)) return
    totals.set(mi, (totals.get(mi) || 0) + 1)
    const cats = new Set(s.focus.map(id => FOCUS_BY_ID[id].categoryId))
    cats.forEach(cid => {
      const cells = byCat.get(cid)
      if (cells) cells.set(mi, (cells.get(mi) || 0) + 1)
    })
  })

  const rows = CATEGORY_META.map(c => {
    const cells = months.map(m => ({ ...m, n: byCat.get(c.id).get(m.index) || 0 }))
    return { ...c, cells, n: sum(cells, cell => cell.n) }
  })

  return {
    months,
    rows,
    monthTotals: months.map(m => ({ ...m, n: totals.get(m.index) || 0 })),
    max: Math.max(0, ...rows.flatMap(r => r.cells.map(c => c.n))),
    truncated,
    hiddenMonths: truncated ? all.length - months.length : 0,
  }
}

// ── Trascuratezza ──────────────────────────────────────────
// "Non lavori il servizio da 47 giorni" è la frase più azionabile dell'intera
// sezione, ed è per questo che si calcola sull'INTERO storico rispetto a oggi:
// dentro una finestra di 90 giorni il numero sarebbe tagliato dal bordo del
// periodo invece che dalla realtà.
//
// Compaiono solo le voci toccate almeno una volta: quelle mai toccate non sono
// "trascurate da N giorni", sono un'altra cosa e stanno nella copertura.

export function neglect(allSessions) {
  const byId = new Map()

  allSessions.forEach(s => {
    s.focus.forEach(id => {
      if (!byId.has(id)) byId.set(id, { id, n: 0, lastDay: null, ratings: [] })
      const row = byId.get(id)
      row.n++
      row.lastDay = s.day   // le sessioni arrivano già ordinate in avanti
      if (s.ratings[id] != null) row.ratings.push(s.ratings[id])
    })
  })

  const today = todayTime()
  const rows = [...byId.values()]
    .map(r => {
      const meta = FOCUS_BY_ID[r.id]
      return {
        ...r,
        label: meta.label,
        categoryId: meta.categoryId, categoryLabel: meta.categoryLabel, categoryIcon: meta.categoryIcon,
        // Il clamp copre la sessione datata nel futuro per errore di battitura.
        days: Math.max(0, Math.round((today - r.lastDay) / 86400000)),
        rating: r.ratings.length ? mean(r.ratings) : null,
      }
    })
    .sort((a, b) => b.days - a.days || b.n - a.n)

  return {
    rows,
    // La voce "più abbandonata" ha senso solo se faceva parte del lavoro
    // abituale: una voce provata una volta sola sei mesi fa non è un colpo che
    // hai smesso di allenare, è un colpo che non hai mai allenato.
    worst: rows.find(r => r.n >= 2 && r.days >= NEGLECT_WARN) || null,
    touched: rows.length,
  }
}

// ── Copertura ──────────────────────────────────────────────
// Quante delle 47 voci del diario sono mai passate per un allenamento. Non è un
// obiettivo da riempire — nessuno lavora tutte e 47 le voci — ma le categorie
// intere a zero sono il dato interessante: "non ho mai messo una volée in un
// allenamento" è una frase che nessuno si dice da solo.

export function coverage(allSessions, periodSessions) {
  const ever = new Set()
  allSessions.forEach(s => s.focus.forEach(id => ever.add(id)))

  const inPeriod = new Set()
  periodSessions.forEach(s => s.focus.forEach(id => inPeriod.add(id)))

  const byCategory = FOCUS_CATEGORIES.map(cat => {
    const meta = CATEGORY_META.find(c => c.id === cat.id)
    const touchedItems = cat.items.filter(i => ever.has(i.id))
    const missing = cat.items.filter(i => !ever.has(i.id))
    return {
      ...meta,
      touched: touchedItems.length,
      missing: missing.map(i => ({ id: i.id, label: i.label })),
      share: cat.items.length ? touchedItems.length / cat.items.length : 0,
    }
  })

  return {
    touched: ever.size,
    total: TOTAL_FOCUS,
    share: TOTAL_FOCUS ? ever.size / TOTAL_FOCUS : 0,
    inPeriod: inPeriod.size,
    byCategory,
    emptyCategories: byCategory.filter(c => c.touched === 0),
  }
}

// ── Trend delle auto-valutazioni ───────────────────────────
// `focusProgress` in training.js fa già la serie per colpo, ma serve al blocco
// collassabile del tab Allenamenti ed è calcolata su tutto lo storico. Qui la
// versione completa: media generale, chi è salito, chi è sceso, tutto dentro il
// periodo scelto in pagina come il resto della sezione.

export function ratingsTrend(sessions) {
  const byId = new Map()

  sessions.forEach(s => {
    Object.entries(s.ratings).forEach(([id, value]) => {
      if (!byId.has(id)) byId.set(id, [])
      byId.get(id).push({ day: s.day, date: s.date, value })
    })
  })

  const rows = [...byId.entries()].map(([id, series]) => {
    const values = series.map(p => p.value)
    const meta = FOCUS_BY_ID[id]
    return {
      id, label: meta.label,
      categoryLabel: meta.categoryLabel, categoryIcon: meta.categoryIcon,
      series,
      n: series.length,
      avg: mean(values),
      first: values[0],
      last: values[values.length - 1],
      delta: values[values.length - 1] - values[0],
      lastDay: series[series.length - 1].day,
    }
  })

  const withTrend = rows.filter(r => r.n >= MIN_RATINGS_TREND)
  const byDelta = [...withTrend].sort((a, b) => b.delta - a.delta || b.n - a.n)
  const allValues = rows.flatMap(r => r.series.map(p => p.value))

  return {
    rows: rows.sort((a, b) => b.lastDay - a.lastDay),
    withTrend: withTrend.sort((a, b) => b.lastDay - a.lastDay),
    n: allValues.length,
    voci: rows.length,
    avg: allValues.length ? mean(allValues) : null,
    best:  byDelta.length && byDelta[0].delta > 0 ? byDelta[0] : null,
    worst: byDelta.length && byDelta[byDelta.length - 1].delta < 0 ? byDelta[byDelta.length - 1] : null,
    // La voce con la media più bassa, a prescindere dal trend: è quella che
    // alimenta il quadrante dei punti ciechi insieme al volume.
    lowest: rows.length ? [...rows].sort((a, b) => a.avg - b.avg || b.n - a.n)[0] : null,
    enough: withTrend.length > 0,
  }
}

// ── Punti ciechi (il 2×2) ──────────────────────────────────
// Valutazione bassa × volume di lavoro basso. Il quadrante in basso a sinistra è
// l'elenco delle cose che sai di fare male e a cui non dedichi tempo — l'unica
// vista della pagina che incrocia il giudizio con il comportamento invece di
// mostrarli separati.
//
// ── Perché basta UNA valutazione per entrare nel grafico ──
// La disciplina del resto della pagina (mai una media sotto soglia di campione)
// qui si rovescerebbe contro sé stessa: chiedere due valutazioni per entrare
// escluderebbe per costruzione proprio le voci a volume basso, cioè esattamente
// quelle che il quadrante deve trovare. Entrano tutte con una sola valutazione,
// ma quelle con un solo voto portano un flag `single` e la UI le marca: sono
// un'impressione, non una media.

export function blindSpots(usage, ratings) {
  const volumeById = new Map(usage.rows.map(r => [r.id, r.n]))

  const points = ratings.rows
    .map(r => ({
      id: r.id, label: r.label,
      categoryIcon: r.categoryIcon, categoryLabel: r.categoryLabel,
      rating: r.avg,
      ratingCount: r.n,
      single: r.n === 1,
      volume: volumeById.get(r.id) || 0,
    }))
    .filter(p => p.volume > 0)

  const volumes = points.map(p => p.volume).sort((a, b) => a - b)
  // Mediana e non media: una voce lavorata 20 volte tirerebbe la soglia in alto
  // e farebbe finire "poco lavorato" metà del diario. Il pavimento a 2 evita
  // che, con tutte le voci a una sessione, la soglia sia 1 e il quadrante dei
  // punti ciechi risulti vuoto proprio quando è tutto da riempire.
  const volumeMid = Math.max(MIN_VOLUME_MID, median(volumes) || 0)

  const quadrantOf = (p) => {
    const low = p.rating < RATING_MID
    const rare = p.volume < volumeMid
    if (low && rare)  return 'blind'
    if (low && !rare) return 'work'
    if (!low && rare) return 'idle'
    return 'strong'
  }

  const placed = points.map(p => ({ ...p, quadrant: quadrantOf(p) }))
  const pick = (q) => placed
    .filter(p => p.quadrant === q)
    .sort((a, b) => a.rating - b.rating || a.volume - b.volume)

  return {
    points: placed,
    volumeMid,
    ratingMid: RATING_MID,
    maxVolume: Math.max(1, ...points.map(p => p.volume)),
    enough: placed.length >= MIN_BLIND_POINTS,
    missing: Math.max(0, MIN_BLIND_POINTS - placed.length),
    blind: pick('blind'),
    work: pick('work'),
    idle: pick('idle'),
    strong: pick('strong'),
  }
}

export const QUADRANTS = {
  blind:  { id: 'blind',  label: 'Punti ciechi',   icon: '🕶', color: 'var(--color-loss)',  hint: 'li valuti male e non li alleni' },
  work:   { id: 'work',   label: 'In lavorazione', icon: '🛠',  color: 'var(--color-amber)', hint: 'li valuti male ma ci stai lavorando' },
  idle:   { id: 'idle',   label: 'In sospeso',     icon: '💤', color: 'var(--color-draw)',  hint: 'vanno bene e non li tocchi' },
  strong: { id: 'strong', label: 'Punti forti',    icon: '💪', color: 'var(--color-win)',   hint: 'vanno bene e li coltivi' },
}

// ── Report completo ────────────────────────────────────────
// Stesso contratto di `buildRendimento` e `buildActivity`: un solo punto
// d'ingresso che restituisce tutto il necessario alla sezione, insight compresi.
//
// `allTrainings` NON è filtrato per periodo, e non è un errore: alimenta
// trascuratezza e copertura, che sono fatti del presente e dell'intero storico.

export function buildTechnique({ trainings = [], allTrainings = null, range = null }) {
  const sessions = toFocusSessions(trainings)
  const all = allTrainings ? toFocusSessions(allTrainings) : sessions

  const usage   = focusUsage(sessions)
  const missed  = neglect(all)
  const ratings = ratingsTrend(sessions)

  // "Quanti giorni fa l'ultima volta" è un fatto del presente e va preso dallo
  // storico intero, ma serve accanto alle voci del periodo (nella riga aperta
  // della heatmap): si innesta qui invece di ricalcolarlo nei componenti.
  const daysById = new Map(missed.rows.map(r => [r.id, r.days]))
  usage.rows.forEach(r => { r.days = daysById.has(r.id) ? daysById.get(r.id) : null })

  const report = {
    n: sessions.length,
    enough: sessions.length >= MIN_TECHNIQUE,
    missing: Math.max(0, MIN_TECHNIQUE - sessions.length),
    // Quota di sessioni del periodo che hanno almeno un focus: il campo è
    // facoltativo nel wizard, e se metà delle sessioni non lo compila l'intera
    // sezione descrive metà del lavoro. La UI lo dichiara.
    trainings: trainings.length,
    withoutFocus: Math.max(0, trainings.length - sessions.length),
    sessions,
    usage,
    heatmap: focusHeatmap(sessions, range),
    neglect: missed,
    coverage: coverage(all, sessions),
    ratings,
    blind: blindSpots(usage, ratings),
  }

  report.insights = report.enough ? techniqueInsights(report) : []
  return report
}

// ── Insight ────────────────────────────────────────────────
// Stesso motore a regole di `rendimentoInsights` e `activityInsights`: soglia di
// campione + soglia di effetto minimo, frase con dentro i numeri che l'hanno
// generata, `target` (id del blocco) + `tab`.

const pct = v => (v == null ? '—' : `${Math.round(v * 100)}%`)
const one = v => (v == null ? '—' : v.toLocaleString('it-IT', { maximumFractionDigits: 1 }))

function insight(o) {
  return { ...o, tab: 'tecnica', weight: o.weight ?? Math.abs(o.effect) * Math.sqrt(o.n) }
}

export function techniqueInsights(r) {
  const out = []

  // Il punto cieco più grave. È la frase che nessuna app dice, e ha il peso più
  // alto della sezione: incrocia un giudizio dell'utente su sé stesso con il suo
  // comportamento reale, quindi non è un'osservazione, è una contraddizione.
  if (r.blind.enough && r.blind.blind.length) {
    const b = r.blind.blind[0]
    out.push(insight({
      id: 'punto-cieco', target: 'punti-ciechi', tone: 'bad', icon: '🕶',
      effect: (RATING_MID - b.rating) / RATING_MID, n: r.n, weight: 2.0,
      text: `«${b.label}»: te lo valuti ${one(b.rating)} su ${MAX_RATING} e l'hai lavorato in ${b.volume} ${b.volume === 1 ? 'sessione' : 'sessioni'} su ${r.n}. Lo sai e non lo alleni.`,
    }))
  }

  // Trascuratezza: solo su voci che facevano parte del lavoro abituale.
  const w = r.neglect.worst
  if (w && w.days >= NEGLECT_WARN) {
    out.push(insight({
      id: 'trascurato', target: 'trascuratezza', tone: w.days >= NEGLECT_BAD ? 'bad' : 'neutral', icon: '🗓',
      effect: w.days / 100, n: w.n, weight: w.days >= NEGLECT_BAD ? 1.6 : 0.9,
      text: `Non lavori «${w.label}» da ${w.days} giorni, dopo ${w.n} sessioni in cui c'era.`,
    }))
  }

  // Categoria intera assente nel periodo: più forte di una singola voce mancante.
  const emptyNow = r.usage.byCategory.filter(c => c.n === 0)
  if (emptyNow.length && r.n >= MIN_TECHNIQUE) {
    const names = emptyNow.map(c => c.label.toLowerCase())
    out.push(insight({
      id: 'categoria-vuota', target: 'radar', tone: 'bad', icon: '⭕️',
      effect: emptyNow.length / CATEGORY_META.length, n: r.n, weight: 1.2,
      text: emptyNow.length === 1
        ? `In questo periodo non hai mai messo «${emptyNow[0].label}» in un allenamento.`
        : `${emptyNow.length} aree del diario restano vuote in questo periodo: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}.`,
    }))
  }

  // Concentrazione: non è un difetto, ma cambia la lettura di tutto il resto.
  if (r.usage.top3Share != null && r.usage.top3Share >= 0.5 && r.usage.distinct >= 4) {
    out.push(insight({
      id: 'concentrazione', target: 'heatmap', tone: 'neutral', icon: '🎯',
      effect: r.usage.top3Share - 0.33, n: r.n, weight: 0.7,
      text: `Il ${pct(r.usage.top3Share)} del tuo lavoro è su tre voci sole: ${r.usage.top3.map(t => t.label.toLowerCase()).join(', ')}.`,
    }))
  }

  // Trend delle valutazioni, in entrambe le direzioni.
  if (r.ratings.best && r.ratings.best.delta >= 2) {
    const b = r.ratings.best
    out.push(insight({
      id: 'migliorato', target: 'valutazioni', tone: 'good', icon: '📈',
      effect: b.delta / MAX_RATING, n: b.n, weight: 1.0,
      text: `«${b.label}» è passato da ${b.first} a ${b.last} su ${MAX_RATING} in ${b.n} valutazioni.`,
    }))
  }
  if (r.ratings.worst && r.ratings.worst.delta <= -2) {
    const b = r.ratings.worst
    out.push(insight({
      id: 'peggiorato', target: 'valutazioni', tone: 'bad', icon: '📉',
      effect: Math.abs(b.delta) / MAX_RATING, n: b.n, weight: 1.1,
      text: `«${b.label}» è sceso da ${b.first} a ${b.last} su ${MAX_RATING}: o è calato davvero, o hai alzato l'asticella.`,
    }))
  }

  // Copertura: vale come frase solo quando è davvero bassa, altrimenti è una
  // curiosità (nessuno lavora tutte e 47 le voci).
  if (r.coverage.share <= 0.3) {
    out.push(insight({
      id: 'copertura', target: 'copertura', tone: 'neutral', icon: '🗺',
      effect: 0.5 - r.coverage.share, n: r.n, weight: 0.5,
      text: `Hai toccato ${r.coverage.touched} delle ${r.coverage.total} voci del diario (${pct(r.coverage.share)}): il resto del tuo tennis non è mai passato per un allenamento registrato.`,
    }))
  }

  // Adozione del campo focus: se metà delle sessioni non lo compila, l'intera
  // sezione sta descrivendo metà del lavoro, e va detto prima di tutto il resto.
  if (r.trainings > 0 && r.withoutFocus / r.trainings >= 0.3) {
    out.push(insight({
      id: 'focus-mancante', target: 'heatmap', tone: 'neutral', icon: '📝',
      effect: r.withoutFocus / r.trainings, n: r.trainings, weight: 0.8,
      text: `${r.withoutFocus} allenamenti su ${r.trainings} non hanno un focus segnato: questa sezione descrive solo gli altri.`,
    }))
  }

  return out.sort((a, b) => b.weight - a.weight)
}

// ── Formattazione condivisa ────────────────────────────────

// "47 giorni" / "oggi" / "ieri": sotto i due giorni il numero è più difficile da
// leggere della parola.
export function formatDaysAgo(days) {
  if (days == null) return '—'
  if (days === 0) return 'oggi'
  if (days === 1) return 'ieri'
  return `${days} giorni fa`
}

// ── Helpers ────────────────────────────────────────────────

function sum(list, pick) {
  return (list || []).reduce((s, x) => s + (pick(x) || 0), 0)
}

function mean(values) {
  if (!values.length) return null
  return values.reduce((s, v) => s + v, 0) / values.length
}

function median(sorted) {
  if (!sorted.length) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function monthIndex(time) {
  const d = new Date(time)
  return d.getFullYear() * 12 + d.getMonth()
}

function monthMeta(index) {
  const year = Math.floor(index / 12)
  const month = index - year * 12
  return { index, year, month, label: MONTHS_SHORT[month] }
}
