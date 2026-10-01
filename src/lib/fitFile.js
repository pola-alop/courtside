// ── Lettura del file .FIT / .zip ────────────────────────────
// Il solo punto che tocca l'SDK Garmin e fflate. Entrambe le librerie sono
// importate DINAMICAMENTE, solo quando l'utente sceglie un file: non entrano nel
// chunk delle pagine. Il file si legge in locale (niente upload, niente
// backend); la logica che interpreta i messaggi vive in fit.js, che resta puro.

import { summarizeFit } from './fit'

export const MAX_FILE_BYTES = 20 * 1024 * 1024   // un .fit di Garmin pesa centinaia di KB

// File scelto dall'utente → riassunto (vedi summarizeFit). Lancia un Error con
// un testo leggibile in italiano.
export async function readFitFile(file) {
  if (!file) throw new Error('Nessun file selezionato.')
  if (file.size > MAX_FILE_BYTES) throw new Error('Il file è troppo grande per essere un\'attività Garmin.')

  let bytes = new Uint8Array(await file.arrayBuffer())

  if (isZip(bytes)) bytes = await fitFromZip(bytes)

  const { Decoder, Stream } = await import('@garmin/fitsdk')
  const stream = Stream.fromByteArray(bytes)
  const decoder = new Decoder(stream)
  if (!Decoder.isFIT(stream)) throw new Error('Il file non è un .fit valido.')
  if (!decoder.checkIntegrity()) throw new Error('Il file .fit è danneggiato o incompleto.')

  const { messages, errors } = decoder.read()
  if (errors?.length && !messages?.sessionMesgs?.length) {
    throw new Error('Non riesco a leggere il file .fit.')
  }
  return summarizeFit(messages)
}

// Lo .zip che Garmin Connect scarica con "Esporta originale" contiene il .fit.
async function fitFromZip(bytes) {
  const { unzipSync } = await import('fflate')
  let entries
  try {
    entries = unzipSync(bytes, { filter: f => /\.fit$/i.test(f.name) })
  } catch {
    throw new Error('Non riesco ad aprire lo zip.')
  }
  const names = Object.keys(entries)
  if (names.length === 0) throw new Error('Lo zip non contiene un file .fit.')
  // Se per caso ce n'è più d'uno, l'attività è quella più grande.
  names.sort((a, b) => entries[b].length - entries[a].length)
  return entries[names[0]]
}

function isZip(bytes) {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05)
}
