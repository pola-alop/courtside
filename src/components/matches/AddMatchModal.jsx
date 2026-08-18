import { useState } from 'react'
import {
  MATCH_TYPES, FORMAT_LIST, MATCH_FORMATS, SURFACES, ROUNDS,
  emptySet, setKind, countSets, computeOutcome, hasScore,
  isTiebreakSet, isTiebreakValid, RESULT_META, surfaceIcon,
} from '../../lib/tennis'
import {
  HR_ZONES, ATHLETIC_LIMITS, emptyAthletics, normalizeAthletics,
  athleticsIssues, hasAthletics, splitDuration, joinDuration, zonesTotalSec,
  trainingEffectLabel, formatDuration,
} from '../../lib/athletics'
// La tassonomia dell'intensità percepita vive in training.js perché è nata lì
// (ed è lì che wear.js va a leggere i suoi fattori), ma non è specifica degli
// allenamenti: descrive lo sforzo di una SESSIONE, e una partita è una sessione.
// Riusarla è meglio che duplicare tre etichette e tre colori.
import { INTENSITIES } from '../../lib/training'
import { levelLabel } from '../../lib/opponents'
import TrainingEffectInfoButton from '../athletics/TrainingEffectInfo'

const STEPS = ['Data', 'Avversario', 'Tipo', 'Superficie', 'Punteggio', 'Attrezzatura', 'Atletica']

const EQUIP_TYPES = [
  { id: 'racchetta', label: 'Racchetta', icon: '🎾' },
  { id: 'scarpa',    label: 'Scarpe',    icon: '👟' },
  { id: 'outfit',    label: 'Outfit',    icon: '👕' },
  { id: 'borsone',   label: 'Borsone',   icon: '🎒' },
]

function initialForm(initial) {
  return {
    date:       initial?.date ? initial.date.split('T')[0] : new Date().toISOString().split('T')[0],
    opponentId: initial?.opponentId || null,
    type:       initial?.type || 'amichevole',
    eventName:  initial?.eventName || '',
    // Solo per i tornei. Le partite registrate prima che il campo esistesse
    // partono a null: modificarle è la via (guidata) per assegnare il turno.
    round:      initial?.round || null,
    surface:    initial?.surface || null,
    format:     initial?.format || 'amatoriale',
    sets:       initial?.sets?.length ? initial.sets.map(s => ({ ...s })) : [emptySet()],
    retired:    initial?.retired || null,
    equipment:  { racchetta: null, scarpa: null, outfit: null, borsone: null, ...(initial?.equipment || {}) },
    // I match registrati prima di questa feature non hanno `athletics`: il
    // draft parte comunque vuoto e resta tale se l'utente non compila nulla.
    athletics:  { ...emptyAthletics(), ...(initial?.athletics || {}) },
    // Intensità percepita. A differenza del wizard allenamento — che preseleziona
    // "media" — qui il default è null, e la differenza è deliberata: il carico di
    // una partita non dichiarata usa un valore di riferimento più alto di
    // "media" (una partita si gioca a punti veri), quindi preselezionare
    // significherebbe far dichiarare all'utente uno sforzo che non ha scelto e
    // abbassargli il carico senza che se ne accorga.
    intensity:  initial?.intensity || null,
  }
}

export default function AddMatchModal({ initial = null, opponents = [], equipment = [], onClose, onSave }) {
  const [step, setStep]   = useState(1)
  const [form, setForm]   = useState(() => initialForm(initial))
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const typeMeta = MATCH_TYPES.find(t => t.id === form.type)
  const outcome  = computeOutcome(form.sets, form.format, form.retired)
  const athIssues = athleticsIssues(form.athletics)

  const stepValid = (() => {
    switch (step) {
      case 1: return Boolean(form.date)
      case 2: return Boolean(form.opponentId)
      // Il turno è obbligatorio SOLO per i tornei: è un tap su una griglia già
      // a schermo, e senza di esso la sezione Tornei non può ricostruire il
      // cammino (una partita senza turno è un buco nel tabellone).
      case 3: return Boolean(form.type)
        && (!typeMeta?.needsEvent || form.eventName.trim().length > 0)
        && (form.type !== 'torneo' || Boolean(form.round))
      case 4: return Boolean(form.surface)
      case 5: {
        const anyScore = form.sets.some(hasScore) || Boolean(form.retired)
        if (!anyScore) return false
        // I tie-break inseriti devono avere un punteggio valido (scarto ≥2) e
        // un vincitore coerente con quello del set
        const fmt = MATCH_FORMATS[form.format]
        if (!form.sets.every((s, i) => isTiebreakValid(s, setKind(fmt, i), fmt, form.retired))) return false
        // Campionato/torneo devono concludersi con un vincitore
        if (!typeMeta?.allowsDraw && !outcome.completed) return false
        return true
      }
      // Step atletica: tutto facoltativo, ma i dati incoerenti (FC media >
      // massima, zone più lunghe del match) sono errori di battitura e non
      // devono finire su Firestore.
      case 7: return athIssues.length === 0
      default: return true
    }
  })()

  const isLast = step === STEPS.length
  const goNext = () => { if (stepValid) setStep(s => Math.min(s + 1, STEPS.length)) }
  const goBack = () => setStep(s => Math.max(s - 1, 1))

  const handleSave = async () => {
    if (!stepValid || saving) return
    setSaving(true)
    const opponent = opponents.find(o => o.id === form.opponentId)
    const cleanedSets = form.sets.filter(hasScore).map(s => ({
      me: s.me || 0, opp: s.opp || 0,
      tbMe: s.tbMe ?? null, tbOpp: s.tbOpp ?? null,
    }))
    const out = computeOutcome(cleanedSets, form.format, form.retired)
    await onSave({
      date:         new Date(form.date).toISOString(),
      opponentId:   form.opponentId,
      opponentName: opponent?.name || '—',
      type:         form.type,
      eventName:    typeMeta?.needsEvent ? form.eventName.trim() : null,
      round:        form.type === 'torneo' ? form.round : null,
      surface:      form.surface,
      format:       form.format,
      sets:         cleanedSets,
      retired:      form.retired || null,
      result:       out.result,
      completed:    out.completed,
      setsMe:       out.setsMe,
      setsOpp:      out.setsOpp,
      equipment:    form.equipment,
      intensity:    form.intensity || null,
      athletics:    normalizeAthletics(form.athletics),
      notes:        initial?.notes || [],
    })
    setSaving(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(2,13,25,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-3xl flex flex-col"
           style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)', maxHeight: '88vh' }}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 shrink-0" style={{ borderBottom: '1px solid var(--color-surface-2)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {step > 1 && (
                <button onClick={goBack} className="text-sm font-medium" style={{ color: 'var(--color-teal)' }}>
                  ← Indietro
                </button>
              )}
              <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-white)' }}>
                {initial ? 'Modifica partita' : 'Nuova partita'}
              </h2>
            </div>
            <button onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-lg"
                    style={{ color: 'var(--color-slate)', background: 'var(--color-surface-2)' }}>
              ✕
            </button>
          </div>
          <StepIndicator step={step} />
        </div>

        {/* Corpo scrollabile */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {step === 1 && <StepDate value={form.date} onChange={v => set('date', v)} />}
          {step === 2 && <StepOpponent opponents={opponents} value={form.opponentId} onChange={v => set('opponentId', v)} />}
          {step === 3 && <StepType form={form} set={set} />}
          {step === 4 && <StepSurface value={form.surface} onChange={v => set('surface', v)} />}
          {step === 5 && (
            <StepScore
              form={form} setForm={setForm}
              outcome={outcome} allowsDraw={typeMeta?.allowsDraw}
            />
          )}
          {step === 6 && <StepEquipment equipment={equipment} value={form.equipment} onChange={v => set('equipment', v)} />}
          {step === 7 && (
            <StepAthletics value={form.athletics} onChange={v => set('athletics', v)} issues={athIssues}
                           intensity={form.intensity} onIntensityChange={v => set('intensity', v)} />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 shrink-0" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
          <button
            onClick={isLast ? handleSave : goNext}
            disabled={!stepValid || saving}
            className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-95"
            style={{
              background: (!stepValid || saving) ? 'var(--color-surface-2)' : 'var(--color-amber)',
              color:      (!stepValid || saving) ? 'var(--color-slate)'     : 'var(--color-bg)',
              fontFamily: 'var(--font-display)'
            }}>
            {saving ? 'Salvataggio...' : isLast ? (initial ? 'Salva modifiche' : 'Salva partita') : 'Avanti'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Step indicator ─────────────────────────────────────────

function StepIndicator({ step }) {
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((label, i) => {
        const n = i + 1
        const active = n === step
        const done = n < step
        return (
          <div key={label} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full h-1 rounded-full"
                 style={{ background: done || active ? 'var(--color-teal-dark)' : 'var(--color-surface-2)' }} />
            {active && (
              <span className="text-[10px] font-semibold" style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
                {n}. {label}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1 — Data ──────────────────────────────────────────

function StepDate({ value, onChange }) {
  return (
    <div className="space-y-3">
      <StepTitle title="Quando hai giocato?" />
      <div>
        <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Data</label>
        <input
          type="date"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full p-3 rounded-xl text-sm outline-none"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-body)' }}
        />
      </div>
    </div>
  )
}

// ── Step 2 — Avversario ────────────────────────────────────

function StepOpponent({ opponents, value, onChange }) {
  const [search, setSearch] = useState('')
  const query = search.trim().toLowerCase()
  const visibleOpponents = query ? opponents.filter(o => o.name.toLowerCase().includes(query)) : opponents

  return (
    <div className="space-y-3">
      <StepTitle title="Contro chi?" />
      {opponents.length === 0 ? (
        <div className="rounded-2xl px-4 py-4 text-center" style={{ background: 'var(--color-surface-2)' }}>
          <p className="text-sm" style={{ color: 'var(--color-slate)' }}>
            Nessun avversario in anagrafica. Aggiungine uno dalla tab Avversari prima di registrare la partita.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca avversario..."
            className="w-full p-3 rounded-xl text-sm outline-none"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-body)' }}
          />
          {visibleOpponents.length === 0 ? (
            <p className="text-sm text-center pt-4" style={{ color: 'var(--color-slate)' }}>Nessun avversario trovato.</p>
          ) : (
            <div className="space-y-2">
            {visibleOpponents.map(o => {
            const active = value === o.id
            return (
              <button key={o.id}
                onClick={() => onChange(o.id)}
                className="w-full text-left rounded-2xl p-3 flex items-center gap-3 transition-all"
                style={{
                  background: active ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                  border: active ? '1px solid var(--color-teal)' : '1px solid transparent',
                }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                     style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <span className="text-xs font-bold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                    {initials(o.name)}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                    {o.name}
                  </p>
                  {(o.hand || o.level) && (
                    <p className="text-xs truncate" style={{ color: active ? 'var(--color-teal-light)' : 'var(--color-slate)' }}>
                      {[o.hand === 'destro' ? 'Destro' : o.hand === 'sinistro' ? 'Mancino' : null, levelLabel(o.level)].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </button>
            )
            })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Step 3 — Tipo ──────────────────────────────────────────

function StepType({ form, set }) {
  const meta = MATCH_TYPES.find(t => t.id === form.type)
  return (
    <div className="space-y-3">
      <StepTitle title="Che tipo di partita?" />
      <div className="grid grid-cols-3 gap-2">
        {MATCH_TYPES.map(t => {
          const active = form.type === t.id
          return (
            <button key={t.id}
              onClick={() => set('type', t.id)}
              className="py-3 rounded-2xl text-sm font-semibold transition-all"
              style={{
                background: active ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                color:      active ? 'var(--color-white)' : 'var(--color-slate)',
                border:     active ? '1px solid var(--color-teal)' : '1px solid transparent',
                fontFamily: 'var(--font-display)'
              }}>
              {t.label}
            </button>
          )
        })}
      </div>
      {meta?.needsEvent && (
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>
            Nome {form.type === 'torneo' ? 'del torneo' : 'del campionato'} *
          </label>
          <input
            type="text"
            value={form.eventName}
            onChange={e => set('eventName', e.target.value)}
            placeholder={form.type === 'torneo' ? 'Es. Open città di...' : 'Es. Serie D 2026'}
            className="w-full p-3 rounded-xl text-sm outline-none"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-body)' }}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--color-slate)' }}>
            Campionati e tornei devono sempre concludersi con un vincitore.
          </p>
        </div>
      )}

      {/* Turno del tabellone — solo torneo. La scala è "quanto manca alla
          finale", quindi funziona anche con i tabelloni irregolari (bye,
          tabelloni limitati, main draw che non sono potenze di 2). */}
      {form.type === 'torneo' && (
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>
            Turno *
          </label>
          <div className="grid grid-cols-3 gap-2">
            {ROUNDS.map(r => {
              const active = form.round === r.id
              return (
                <button key={r.id}
                  onClick={() => set('round', r.id)}
                  className="py-2.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: active ? 'var(--color-amber)' : 'var(--color-surface-2)',
                    color:      active ? 'var(--color-bg)' : 'var(--color-slate)',
                    border:     active ? '1px solid var(--color-amber)' : '1px solid transparent',
                    fontFamily: 'var(--font-display)'
                  }}>
                  {r.short}
                </button>
              )
            })}
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--color-slate)' }}>
            Conta all'indietro dalla finale: funziona anche se il tabellone è
            irregolare o hai avuto un bye.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Step 4 — Superficie ────────────────────────────────────

function StepSurface({ value, onChange }) {
  return (
    <div className="space-y-3">
      <StepTitle title="Su che superficie?" />
      <div className="grid grid-cols-2 gap-2">
        {SURFACES.map(s => {
          const active = value === s
          return (
            <button key={s}
              onClick={() => onChange(s)}
              className="py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
              style={{
                background: active ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                color:      active ? 'var(--color-white)' : 'var(--color-slate)',
                border:     active ? '1px solid var(--color-teal)' : '1px solid transparent',
                fontFamily: 'var(--font-display)'
              }}>
              <span>{surfaceIcon(s)}</span>
              <span className="capitalize">{s}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 5 — Punteggio ─────────────────────────────────────

function StepScore({ form, setForm, outcome, allowsDraw }) {
  const fmt = MATCH_FORMATS[form.format]

  const setFormat = (key) => setForm(f => ({ ...f, format: key, sets: [emptySet()], retired: null }))

  const updateSet = (i, patch) => setForm(f => {
    const sets = f.sets.map(s => ({ ...s }))
    while (sets.length <= i) sets.push(emptySet())
    sets[i] = { ...sets[i], ...patch }
    return { ...f, sets }
  })

  // Set da mostrare: fino a quando il match non è deciso, senza superare maxSets
  const shown = []
  for (let i = 0; i < fmt.maxSets; i++) {
    shown.push(form.sets[i] || emptySet())
    const { setsMe, setsOpp } = countSets(shown, fmt)
    if (setsMe >= fmt.setsToWin || setsOpp >= fmt.setsToWin) break
  }

  const meta = RESULT_META[outcome.result]
  const drawBlocked = !allowsDraw && !outcome.completed && (form.sets.some(hasScore) || form.retired)
  const tbBlocked = shown.some((s, i) => !isTiebreakValid(s, setKind(fmt, i), fmt, form.retired))

  return (
    <div className="space-y-4">
      <StepTitle title="Formato e punteggio" />

      {/* Scelta formato */}
      <div className="grid grid-cols-2 gap-2">
        {FORMAT_LIST.map(f => {
          const active = form.format === f.id
          return (
            <button key={f.id}
              onClick={() => setFormat(f.id)}
              className="p-3 rounded-2xl text-left transition-all"
              style={{
                background: active ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                border:     active ? '1px solid var(--color-teal)' : '1px solid transparent',
              }}>
              <p className="text-sm font-bold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{f.label}</p>
              <p className="text-[11px]" style={{ color: active ? 'var(--color-teal-light)' : 'var(--color-slate)' }}>{f.sub}</p>
            </button>
          )
        })}
      </div>

      {/* Set */}
      <div className="space-y-3">
        {shown.map((s, i) => {
          const kind = setKind(fmt, i)
          return (
            <SetInput key={i} index={i} set={s} kind={kind} fmt={fmt}
              invalid={!isTiebreakValid(s, kind, fmt, form.retired)}
              onChange={patch => updateSet(i, patch)} />
          )
        })}
      </div>

      {/* Ritiro */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
          Ritiro
        </p>
        <div className="flex gap-2">
          {[
            { id: null,  label: 'Nessuno' },
            { id: 'me',  label: 'Mi ritiro' },
            { id: 'opp', label: 'Si ritira lui' },
          ].map(opt => {
            const active = (form.retired || null) === opt.id
            return (
              <button key={String(opt.id)}
                onClick={() => setForm(f => ({ ...f, retired: opt.id }))}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: active ? (opt.id ? 'var(--color-loss-bg)' : 'var(--color-teal-dark)') : 'var(--color-surface-2)',
                  color:      active ? (opt.id ? 'var(--color-loss)' : 'var(--color-white)') : 'var(--color-slate)',
                  fontFamily: 'var(--font-display)'
                }}>
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Anteprima esito */}
      {(form.sets.some(hasScore) || form.retired) && meta && (
        <div className="rounded-2xl px-4 py-3 flex items-center justify-between" style={{ background: meta.bg }}>
          <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: meta.color, fontFamily: 'var(--font-display)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
            {meta.label}
          </span>
          <span className="text-xs" style={{ color: meta.color, fontFamily: 'var(--font-mono)' }}>
            {outcome.setsMe}-{outcome.setsOpp} set {outcome.completed ? '' : '· interrotta'}
          </span>
        </div>
      )}

      {tbBlocked && (
        <p className="text-xs" style={{ color: 'var(--color-loss)' }}>
          ⚠ Il punteggio del tie-break deve avere uno scarto di almeno 2 punti e il vincitore deve coincidere con chi ha vinto il set.
        </p>
      )}

      {drawBlocked && (
        <p className="text-xs" style={{ color: 'var(--color-loss)' }}>
          ⚠ In campionato/torneo deve esserci un vincitore: completa il match o segna un ritiro.
        </p>
      )}
    </div>
  )
}

function SetInput({ index, set, kind, fmt, invalid, onChange }) {
  const isSuper = kind === 'superTb'
  const maxGames = isSuper ? 99 : 7
  const showTb = !isSuper && isTiebreakSet(set)

  return (
    <div className="rounded-2xl p-3" style={{ background: 'var(--color-surface-2)', border: invalid ? '1px solid var(--color-loss)' : '1px solid transparent' }}>
      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
        {isSuper ? `Super tie-break (a ${fmt.superTbTarget})` : `Set ${index + 1}`}
      </p>
      <div className="space-y-2">
        <ScoreStepper label="Tu"          value={set.me}  onChange={v => onChange({ me: v })}  max={maxGames} />
        <ScoreStepper label="Avversario"  value={set.opp} onChange={v => onChange({ opp: v })} max={maxGames} />
      </div>
      {isSuper && invalid && (
        <p className="text-[11px] mt-2" style={{ color: 'var(--color-loss)' }}>
          ⚠ Il super tie-break si vince solo con uno scarto di almeno 2 punti (es. 10-8, 11-9...).
        </p>
      )}
      {showTb && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[11px] mb-2" style={{ color: invalid ? 'var(--color-loss)' : 'var(--color-slate)' }}>
            Punti tie-break {invalid && '— scarto minimo 2 punti, il vincitore deve coincidere con il set'}
          </p>
          <div className="space-y-2">
            <ScoreStepper label="Tu"         value={set.tbMe  ?? 0} onChange={v => onChange({ tbMe: v })}  max={99} small />
            <ScoreStepper label="Avversario" value={set.tbOpp ?? 0} onChange={v => onChange({ tbOpp: v })} max={99} small />
          </div>
        </div>
      )}
    </div>
  )
}

function ScoreStepper({ label, value, onChange, max = 99, small = false }) {
  const dec = () => onChange(Math.max(0, (value || 0) - 1))
  const inc = () => onChange(Math.min(max, (value || 0) + 1))
  return (
    <div className="flex items-center justify-between">
      <span className={`${small ? 'text-[11px]' : 'text-xs'}`} style={{ color: 'var(--color-slate)' }}>{label}</span>
      <div className="flex items-center gap-3">
        <button onClick={dec}
          className="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold"
          style={{ background: 'var(--color-surface)', color: 'var(--color-white)' }}>−</button>
        <span className="text-base font-bold w-6 text-center tabular-nums"
              style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
          {value || 0}
        </span>
        <button onClick={inc}
          className="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold"
          style={{ background: 'var(--color-surface)', color: 'var(--color-white)' }}>+</button>
      </div>
    </div>
  )
}

// ── Step 6 — Attrezzatura ──────────────────────────────────

function StepEquipment({ equipment, value, onChange }) {
  const active = equipment.filter(e => e.active !== false)

  const pick = (type, id) => {
    onChange({ ...value, [type]: value[type] === id ? null : id })
  }

  const hasAny = EQUIP_TYPES.some(t => active.some(e => e.type === t.id))

  return (
    <div className="space-y-4">
      <StepTitle title="Con cosa hai giocato?" sub="Facoltativo — collega racchetta, scarpe e altro" />
      {!hasAny ? (
        <div className="rounded-2xl px-4 py-4 text-center" style={{ background: 'var(--color-surface-2)' }}>
          <p className="text-sm" style={{ color: 'var(--color-slate)' }}>
            Nessuna attrezzatura in uso. Aggiungila nella sezione Equipment per collegarla ai match.
          </p>
        </div>
      ) : (
        EQUIP_TYPES.map(t => {
          const items = active.filter(e => e.type === t.id)
          if (items.length === 0) return null
          return (
            <div key={t.id}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
                {t.icon} {t.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {items.map(e => {
                  const selected = value[t.id] === e.id
                  const model = e.model || e.name || '—'
                  return (
                    <button key={e.id}
                      onClick={() => pick(t.id, e.id)}
                      className="px-3 py-2 rounded-xl text-xs font-medium transition-all text-left"
                      style={{
                        background: selected ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                        border:     selected ? '1px solid var(--color-teal)' : '1px solid transparent',
                        fontFamily: 'var(--font-display)'
                      }}>
                      <span style={{ color: 'var(--color-white)' }}>{model}</span>
                      {e.nickname && (
                        <span className="block text-[11px] mt-0.5" style={{ color: 'var(--color-white)', opacity: 0.6 }}>
                          {e.nickname}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ── Step 7 — Atletica ──────────────────────────────────────

function StepAthletics({ value, onChange, issues, intensity, onIntensityChange }) {
  // Le zone partono aperte solo se ci sono già dati: sono 5 righe, e sul
  // mobile appesantiscono lo step per chi non le usa.
  const [showZones, setShowZones] = useState(() => zonesTotalSec(value.zones) > 0)

  const patch = (p) => onChange({ ...value, ...p })
  const dur = splitDuration(value.durationSec)
  const setDur = (part, v) => {
    const next = { ...dur, [part]: v ?? 0 }
    patch({ durationSec: joinDuration(next.h, next.m, next.s) })
  }

  const setZone = (i, sec) => {
    const zones = HR_ZONES.map((_, k) => value.zones?.[k] ?? 0)
    zones[i] = sec ?? 0
    patch({ zones: zones.some(v => v > 0) ? zones : null })
  }

  const teLabel = trainingEffectLabel(value.trainingEffect)
  const anTeLabel = trainingEffectLabel(value.anaerobicTrainingEffect)
  const zonesTotal = zonesTotalSec(value.zones)
  const filled = hasAthletics(value)

  return (
    <div className="space-y-4">
      <StepTitle
        title="Come è andata a livello fisico?"
        sub="Tutto facoltativo — l'intensità è a sensazione, il resto si trascrive dall'orologio"
      />

      {/* L'unico campo di questo step che NON viene dall'orologio: è la
          sensazione, ed è l'unico modo per sapere quanto è costata davvero una
          partita. Un tap sulla scelta attiva la azzera — stesso gesto delle
          stelline di valutazione nel dettaglio allenamento. */}
      <FieldGroup label="Quanto è stata dura">
        <div className="grid grid-cols-3 gap-2">
          {INTENSITIES.map(i => {
            const active = intensity === i.id
            return (
              <button key={i.id} type="button"
                onClick={() => onIntensityChange(active ? null : i.id)}
                className="py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 flex items-center justify-center gap-1.5"
                style={{
                  background: active ? 'var(--color-surface-2)' : 'transparent',
                  border: `1px solid ${active ? i.color : 'var(--color-surface-2)'}`,
                  color: active ? i.color : 'var(--color-slate)',
                  fontFamily: 'var(--font-display)',
                }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? i.color : 'var(--color-slate)' }} />
                {i.label}
              </button>
            )
          })}
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--color-slate)' }}>
          {intensity
            ? 'Alimenta il carico di allenamento in Stats › Attività. Tocca di nuovo per togliere.'
            : 'Se non la indichi, in Stats la partita viene contata come sforzo alto — che è quello che una partita è di solito.'}
        </p>
      </FieldGroup>

      <FieldGroup label="Dati dall'orologio">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Distanza" suffix="km" placeholder="0,0"
            value={value.distanceKm} onChange={v => patch({ distanceKm: v })}
            {...ATHLETIC_LIMITS.distanceKm} />
          <NumberField label="Calorie" suffix="kcal" placeholder="0"
            value={value.calories} onChange={v => patch({ calories: v })}
            {...ATHLETIC_LIMITS.calories} />
        </div>

        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Tempo totale di gioco</label>
          <div className="grid grid-cols-3 gap-2">
            <NumberField label="ore" value={dur.h || null} onChange={v => setDur('h', v)}
              min={ATHLETIC_LIMITS.durationHours.min} max={ATHLETIC_LIMITS.durationHours.max} step={1} placeholder="0" />
            <NumberField label="min" value={dur.m || null} onChange={v => setDur('m', v)}
              min={0} max={59} step={1} placeholder="0" />
            <NumberField label="sec" value={dur.s || null} onChange={v => setDur('s', v)}
              min={0} max={59} step={1} placeholder="0" />
          </div>
        </div>
      </FieldGroup>

      <FieldGroup label="Frequenza cardiaca">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Media" suffix="bpm" placeholder="80"
            value={value.avgHr} onChange={v => patch({ avgHr: v })} {...ATHLETIC_LIMITS.hr} />
          <NumberField label="Massima" suffix="bpm" placeholder="120"
            value={value.maxHr} onChange={v => patch({ maxHr: v })} {...ATHLETIC_LIMITS.hr} />
        </div>
      </FieldGroup>

      <FieldGroup label="Training effect" labelExtra={<TrainingEffectInfoButton />}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <NumberField label="Aerobico" placeholder="0,0"
              value={value.trainingEffect} onChange={v => patch({ trainingEffect: v })}
              {...ATHLETIC_LIMITS.trainingEffect} />
            <p className="text-xs mt-1" style={{ color: teLabel ? 'var(--color-teal)' : 'var(--color-slate)' }}>
              {teLabel || 'Scala da 0,0 a 5,0'}
            </p>
          </div>
          <div>
            <NumberField label="Anaerobico" placeholder="0,0"
              value={value.anaerobicTrainingEffect} onChange={v => patch({ anaerobicTrainingEffect: v })}
              {...ATHLETIC_LIMITS.anaerobicTrainingEffect} />
            <p className="text-xs mt-1" style={{ color: anTeLabel ? 'var(--color-teal)' : 'var(--color-slate)' }}>
              {anTeLabel || 'Scala da 0,0 a 5,0'}
            </p>
          </div>
        </div>
      </FieldGroup>

      {/* Zone — sezione collassabile */}
      <div>
        <button
          onClick={() => setShowZones(s => !s)}
          className="w-full flex items-center justify-between py-2">
          <span className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
            Tempo in zone d'attività
          </span>
          <span className="text-xs flex items-center gap-2" style={{ color: 'var(--color-slate)' }}>
            {zonesTotal > 0 && (
              <span style={{ fontFamily: 'var(--font-mono)' }}>{formatDuration(zonesTotal)}</span>
            )}
            <span>{showZones ? '▾' : '▸'}</span>
          </span>
        </button>

        {showZones && (
          <div className="space-y-2 mt-1">
            {HR_ZONES.map((z, i) => (
              <ZoneRow key={z.id} zone={z} seconds={value.zones?.[i] ?? 0} onChange={sec => setZone(i, sec)} />
            ))}
          </div>
        )}
      </div>

      {issues.map(msg => (
        <p key={msg} className="text-xs" style={{ color: 'var(--color-loss)' }}>⚠ {msg}</p>
      ))}

      {filled && (
        <button
          onClick={() => onChange(emptyAthletics())}
          className="w-full py-2.5 rounded-2xl text-xs font-semibold transition-all"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
          Svuota i dati atletici
        </button>
      )}
    </div>
  )
}

function ZoneRow({ zone, seconds, onChange }) {
  const m = Math.floor((seconds || 0) / 60)
  const s = (seconds || 0) % 60
  const setPart = (part, v) => {
    const mm = part === 'm' ? (v ?? 0) : m
    const ss = part === 's' ? (v ?? 0) : s
    onChange(mm * 60 + ss)
  }

  return (
    <div className="rounded-2xl p-3 flex items-center gap-3" style={{ background: 'var(--color-surface-2)' }}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="w-1.5 h-8 rounded-full shrink-0" style={{ background: zone.color }} />
        <div className="min-w-0">
          <p className="text-xs font-semibold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            {zone.label}
          </p>
          <p className="text-[11px] truncate" style={{ color: 'var(--color-slate)' }}>{zone.name}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <BareNumberInput value={m || null} onChange={v => setPart('m', v)} min={0} max={999} placeholder="0" />
        <span className="text-xs" style={{ color: 'var(--color-slate)' }}>min</span>
        <BareNumberInput value={s || null} onChange={v => setPart('s', v)} min={0} max={59} placeholder="00" />
        <span className="text-xs" style={{ color: 'var(--color-slate)' }}>sec</span>
      </div>
    </div>
  )
}

function FieldGroup({ label, labelExtra, children }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
        {label}
        {labelExtra}
      </p>
      {children}
    </div>
  )
}

function NumberField({ label, suffix, value, onChange, min, max, step = 1, placeholder }) {
  return (
    <div>
      <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>
        {label}{suffix ? ` (${suffix})` : ''}
      </label>
      <BareNumberInput value={value} onChange={onChange} min={min} max={max} step={step} placeholder={placeholder} full />
    </div>
  )
}

// Input numerico "nudo": il valore canonico è sempre number|null, mai stringa.
// `type="number"` evita gli stati intermedi non parsabili (es. "2,") e apre il
// tastierino numerico su mobile; il clamp definitivo lo fa normalizeAthletics
// al salvataggio, così non si combatte con l'utente mentre digita.
function BareNumberInput({ value, onChange, min, max, step = 1, placeholder, full = false }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value ?? ''}
      min={min} max={max} step={step}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className={`${full ? 'w-full' : 'w-14 text-center'} p-3 rounded-xl text-sm outline-none`}
      style={{
        background: full ? 'var(--color-surface-2)' : 'var(--color-surface)',
        color: 'var(--color-white)',
        border: '1px solid transparent',
        fontFamily: 'var(--font-mono)',
      }}
    />
  )
}

// ── Comuni ─────────────────────────────────────────────────

function StepTitle({ title, sub }) {
  return (
    <div>
      <p className="text-base font-bold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{title}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--color-slate)' }}>{sub}</p>}
    </div>
  )
}

function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
