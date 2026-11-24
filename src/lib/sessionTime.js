// ── Orario di una sessione di tennis ────────────────────────
// Modulo puro di src/lib/ (nessun React, nessun Firestore).
//
// Partite e allenamenti di tennis salvano la DATA come ISO del solo giorno
// (`new Date('YYYY-MM-DD').toISOString()`), senza ora. L'ora d'inizio è un
// campo SEPARATO, `time: 'HH:MM'` (giorno locale, come nei programmi): non
// tocca nessun consumatore della data, e i documenti salvati prima non ce
// l'hanno (`null`, mai un valore inventato). Serve a mettere in ordine due
// sessioni dello stesso giorno, per esempio per sapere se una partita è stata
// giocata prima o dopo un allenamento.

import { dayTime } from './stats'

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

// 'HH:MM' valido oppure null: ogni valore sporco (stringa vuota, '9:5', 25:00)
// vale «non indicata».
export function readTime(value) {
  return typeof value === 'string' && TIME_RE.test(value) ? value : null
}

// Il momento della sessione in millisecondi (giorno locale + ora), oppure null
// se manca la data o l'ora. Con null non si può dire se una sessione viene
// prima o dopo un'altra dello stesso giorno: chi chiama decide cosa fare.
export function sessionMoment(session) {
  const day = dayTime(session?.date)
  const time = readTime(session?.time)
  if (day == null || !time) return null
  const [h, m] = time.split(':').map(Number)
  return day + (h * 60 + m) * 60000
}

// L'ora d'inizio da mostrare accanto alla data, o null se non c'è.
export function timeLabel(session) {
  return readTime(session?.time)
}
