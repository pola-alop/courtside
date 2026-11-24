import { useMemo, useState } from 'react'
import { focusLabel } from '../../lib/training'
import { formatDaysAgo } from '../../lib/technique'
import {
  collectSummaryInput, buildPrompt, buildSavedSummary, isStale, neglectedFocus, MAX_WINDOW_DAYS, MAX_MATCHES,
} from '../../lib/planSummary'
import { generatePlanSummary } from '../../firebase/ai'

// Sezione «Dalle tue note» nella vista di un allenamento programmato
// (`PlanModal`): il riassunto generato dal modello sulle sole note delle partite
// giocate dall'ultimo allenamento svolto, e i colpi suggeriti. Due fonti, e la
// schermata le tiene SEPARATE e dichiara entrambe:
//  · «suggeriti dalle note» = lettura del modello AI, non un calcolo;
//  · «che non alleni da un po'» = calcolo deterministico su `technique.js`,
//    c'è anche senza rete, con la quota finita o con il modello giù.
// Nessun suggerimento preseleziona il focus del wizard: li sceglie il maestro.

const ERRORS = {
  offline:     'Sei offline: il riassunto non si può generare adesso.',
  quota:       'La quota gratuita del modello è esaurita per ora. Riprova più tardi.',
  denied:      'Il servizio ha rifiutato la richiesta (App Check). Controlla la configurazione.',
  unavailable: 'Il modello non è raggiungibile in questo momento. Riprova tra poco.',
  timeout:     'Il modello ci sta mettendo troppo. Riprova.',
  empty:       'Il modello non ha restituito un riassunto utilizzabile. Riprova.',
  failed:      'Non sono riuscito a generare il riassunto. Riprova.',
}

export default function NotesSummary({ plan, matches = [], trainings = [], opponents = [], onSaveSummary }) {
  const [saved, setSaved]   = useState(plan.summary || null)
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState(null)

  const input = useMemo(
    () => collectSummaryInput(plan, { matches, trainings, opponents }),
    [plan, matches, trainings, opponents],
  )
  const neglected = useMemo(() => neglectedFocus(trainings), [trainings])
  const stale = saved ? isStale(saved, input) : false
  const canGenerate = input.used > 0

  const generate = async () => {
    if (busy || !canGenerate) return
    setBusy(true)
    setError(null)
    try {
      const result = await generatePlanSummary(buildPrompt(input))
      const doc = buildSavedSummary(result, input)
      setSaved(doc)
      try {
        await onSaveSummary?.(plan.id, doc)
      } catch {
        setError('saveFailed')
      }
    } catch (err) {
      setError(err?.kind || 'failed')
    }
    setBusy(false)
  }

  return (
    <div className="mt-4 space-y-3">
      <SubTitle>Dalle tue note</SubTitle>

      <p className="text-xs wrap-anywhere" style={{ color: 'var(--color-slate)' }}>
        {periodText(input)}
      </p>

      {saved && (
        <div className="rounded-2xl px-4 py-3 space-y-3" style={{ background: 'var(--color-surface-2)' }}>
          {stale && (
            <p className="text-xs wrap-anywhere" style={{ color: 'var(--color-amber-light)' }}>
              Le note sono cambiate dopo l'ultima generazione: aggiorna il riassunto.
            </p>
          )}
          {saved.summary && (
            <p className="text-sm wrap-anywhere" style={{ color: 'var(--color-white)' }}>{saved.summary}</p>
          )}
          {saved.highlights?.length > 0 && (
            <ul className="space-y-1.5">
              {saved.highlights.map((h, i) => (
                <li key={i} className="flex gap-2 text-xs wrap-anywhere" style={{ color: 'var(--color-white)' }}>
                  <span style={{ color: 'var(--color-teal)' }}>•</span>
                  <span className="min-w-0">{h}</span>
                </li>
              ))}
            </ul>
          )}
          {saved.suggestedFocus?.length > 0 && (
            <div>
              <p className="text-[11px] mb-1.5 wrap-anywhere" style={{ color: 'var(--color-slate)' }}>
                Colpi suggeriti dal modello AI, in base a ciò che leggo nelle tue note:
              </p>
              <Chips ids={saved.suggestedFocus} />
            </div>
          )}
          <p className="text-[11px] wrap-anywhere" style={{ color: 'var(--color-slate)' }}>
            {basedOnText(saved)}
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs wrap-anywhere" style={{ color: 'var(--color-loss)' }}>
          ⚠ {error === 'saveFailed'
            ? 'Riassunto generato ma non salvato sul programma: sparirà alla chiusura.'
            : ERRORS[error] || ERRORS.failed}
        </p>
      )}

      {canGenerate ? (
        <>
          {(!saved || stale || error) && (
            <button
              onClick={generate}
              disabled={busy}
              className="w-full py-2.5 rounded-2xl text-xs font-semibold transition-all"
              style={{
                background: 'var(--color-surface-2)', color: 'var(--color-teal)',
                fontFamily: 'var(--font-display)', border: '1px solid var(--color-teal-dark)',
                opacity: busy ? 0.6 : 1,
              }}>
              {busy ? 'Sto leggendo le note…' : saved ? '↻ Aggiorna riassunto' : '✨ Genera riassunto'}
            </button>
          )}
          <p className="text-[11px] wrap-anywhere" style={{ color: 'var(--color-slate)' }}>
            Il riassunto lo scrive un modello AI (Gemini): gli vengono inviati data, esito, punteggio, superficie e testo
            delle note, senza i nomi degli avversari. Può sbagliare: le note restano la fonte.
          </p>
        </>
      ) : (
        <p className="text-xs wrap-anywhere" style={{ color: 'var(--color-slate)' }}>
          Nessuna partita con note in questo periodo: il riassunto non si può generare.
        </p>
      )}

      {neglected.length > 0 && (
        <div>
          <p className="text-[11px] mb-1.5 wrap-anywhere" style={{ color: 'var(--color-slate)' }}>
            Colpi che non alleni da un po' (calcolato dai tuoi allenamenti, non dall'AI):
          </p>
          <Chips ids={neglected.map(n => n.id)} suffix={Object.fromEntries(neglected.map(n => [n.id, formatDaysAgo(n.days)]))} />
        </div>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

function Chips({ ids, suffix = {} }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ids.map(id => (
        <span key={id} className="text-[11px] px-2 py-1 rounded-full wrap-anywhere"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal-light)', fontFamily: 'var(--font-display)' }}>
          {focusLabel(id)}{suffix[id] ? ` · ${suffix[id]}` : ''}
        </span>
      ))}
    </div>
  )
}

function SubTitle({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider mb-2"
       style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
      {children}
    </p>
  )
}

function shortDay(key) {
  const [y, m, d] = String(key || '').slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return '—'
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

function periodText(input) {
  const parts = []
  if (input.since) parts.push(`Dall'ultimo allenamento (${shortDay(input.since.date)}) a questo`)
  else parts.push(`Negli ultimi ${MAX_WINDOW_DAYS} giorni (nessun allenamento recente)`)
  parts[0] += `: ${input.total} ${input.total === 1 ? 'partita' : 'partite'}, ${input.withNotes} con note.`
  if (input.capped && input.since) parts.push(`Periodo limitato a ${MAX_WINDOW_DAYS} giorni.`)
  if (input.truncated) parts.push(`Uso le ${MAX_MATCHES} più recenti.`)
  return parts.join(' ')
}

function basedOnText(saved) {
  const days = (saved.matches || []).map(m => shortDay(m.date))
  const when = saved.generatedAt
    ? new Date(saved.generatedAt).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null
  return [
    days.length ? `Basato su ${days.length} ${days.length === 1 ? 'partita' : 'partite'} (${days.join(', ')}).` : null,
    when ? `Generato il ${when}.` : null,
  ].filter(Boolean).join(' ')
}
