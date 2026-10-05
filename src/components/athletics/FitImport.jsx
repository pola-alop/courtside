import { useRef, useState } from 'react'
import { formatDuration, formatDistance } from '../../lib/athletics'
import { sportMismatch } from '../../lib/fit'

// Import di un file .FIT (o dello .zip che Garmin Connect scarica con
// "Esporta originale"). Il file si legge nel browser: niente upload, niente
// backend. La libreria di decodifica è caricata solo qui, alla prima scelta.
//
// Il componente NON salva e NON decide cosa fare del riassunto: lo valida
// (sport giusto, file non già importato in un'altra sessione) e lo consegna a
// `onImport`. Chi lo monta applica i dati al proprio draft; i dettagli pesanti
// (serie, lap, traccia) viaggiano con la sessione e si salvano con lei.
//
//  · expected   'tennis' | 'running' | 'gym': lo sport della sessione
//  · imported   riassunto appena importato (per la conferma sotto il bottone)
//  · hasData    la sessione ha già dei dati atletici (verranno sostituiti)
//  · date       data 'YYYY-MM-DD' della sessione, per avvisare se non coincide
//  · onUseDate  se c'è, propone di prendere la data del file
//  · fitUse     fitId → descrizione della sessione che lo ha già, o null
export default function FitImport({
  expected, imported = null, currentFitId = null, hasData = false,
  date = null, onUseDate = null, fitUse = null, onImport,
}) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = async (file) => {
    if (!file || busy) return
    setBusy(true)
    setError(null)
    try {
      // Import dinamico: SDK Garmin e fflate non entrano nel chunk della pagina.
      const { readFitFile } = await import('../../lib/fitFile')
      const summary = await readFitFile(file)

      const wrong = sportMismatch(summary, expected)
      if (wrong) throw new Error(wrong)

      const used = fitUse ? fitUse(summary.fitId) : null
      if (used) throw new Error(`Questo file è già stato importato: ${used}.`)

      onImport(summary)
    } catch (e) {
      setError(e?.message || 'Non riesco a leggere il file.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer?.files?.[0])
  }

  const hasFile = Boolean(imported || currentFitId)
  const dateGap = imported && date && imported.localDate !== date

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className="rounded-2xl px-4 py-3"
        style={{
          background: 'var(--color-surface-2)',
          border: `1px dashed ${dragging ? 'var(--color-teal)' : 'var(--color-teal-dark)'}`,
        }}>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
              {hasFile ? '⌚ Dati importati dal file Garmin' : '⌚ Importa dal file Garmin'}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-slate)' }}>
              {hasFile
                ? 'Scegli un altro file per sostituirli.'
                : hasData
                  ? 'File .fit o .zip di Garmin Connect. Sostituisce i dati già inseriti.'
                  : 'File .fit o .zip scaricato da Garmin Connect ("Esporta originale").'}
            </p>
          </div>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
            className="shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
            style={{
              background: busy ? 'var(--color-surface)' : 'var(--color-teal-dark)',
              color: busy ? 'var(--color-slate)' : 'var(--color-bg)',
              fontFamily: 'var(--font-display)',
            }}>
            {busy ? 'Leggo...' : hasFile ? 'Sostituisci' : 'Scegli file'}
          </button>
        </div>
        <input ref={inputRef} type="file" className="hidden"
          accept=".fit,.zip,application/zip,application/octet-stream"
          onChange={e => handleFile(e.target.files?.[0])} />
      </div>

      {imported && (
        <p className="text-[11px] mt-2 px-1" style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-mono)' }}>
          ✓ {formatLocalDate(imported.localDate)} {imported.localTime}
          {imported.athletics.durationSec ? ` · ${formatDuration(imported.athletics.durationSec)}` : ''}
          {imported.athletics.distanceKm ? ` · ${formatDistance(imported.athletics.distanceKm)}` : ''}
          {imported.athletics.avgHr ? ` · FC ${imported.athletics.avgHr}` : ''}
        </p>
      )}

      {dateGap && (
        <div className="mt-2 px-1">
          <p className="text-[11px]" style={{ color: 'var(--color-amber)' }}>
            ⚠ Il file è del {formatLocalDate(imported.localDate)}, la sessione del {formatLocalDate(date)}.
          </p>
          {onUseDate && (
            <button type="button" onClick={() => onUseDate(imported.localDate)}
              className="text-[11px] underline mt-1" style={{ color: 'var(--color-teal)' }}>
              Usa la data del file
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs mt-2 px-1" style={{ color: 'var(--color-loss)' }}>⚠ {error}</p>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

// '2026-09-23' → '23/09/2026'
function formatLocalDate(d) {
  const [y, m, day] = String(d).split('-')
  return `${day}/${m}/${y}`
}
