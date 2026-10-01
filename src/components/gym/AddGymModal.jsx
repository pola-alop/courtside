import { useState } from 'react'
import { INTENSITIES } from '../../lib/training'
import { athleticsDraft, normalizeAthletics, athleticsIssues, hasAthletics } from '../../lib/athletics'
import {
  normalizeItems, workoutIssues, sameItems, sortWorkoutsByUse, workoutUsage,
  workoutTotals,
} from '../../lib/gym'
import ExerciseEditor from './ExerciseEditor'
import WorkoutSummary from './WorkoutSummary'
import { RunAthleticsFields } from '../runs/RunAthleticsEditor'

// Wizard di una sessione di palestra in tre passi: quale SCHEDA (dalla libreria
// o nuova) → i suoi ESERCIZI (l'editor con le serie) → la SESSIONE (data,
// intensità, dati dell'orologio facoltativi).
//
// Come nella corsa, la struttura viene COPIATA nella sessione. Se la si
// modifica al passo 2 partendo da una scheda di libreria, la libreria resta
// com'era a meno di spuntare "Aggiorna anche la scheda": la variante di un
// giorno ("oggi 4 serie invece di 3") non deve riscrivere la ricetta.
//
// La SCHEDA COMANDA: serie, ripetizioni e carichi sono quelli scritti qui. I
// dati dell'orologio (passo 3) sono solo contorno — durata, calorie, FC.
//
// Il wizard non tocca Firestore: consegna `{ session, workout }` e
// l'orchestrazione (creare la scheda, aggiornarla, salvare la sessione) sta
// nella pagina.
const STEPS = ['Scheda', 'Esercizi', 'Sessione']

function initialForm(initial, workouts) {
  const linked = initial?.workoutId ? workouts.find(w => w.id === initial.workoutId) : null
  return {
    // 'library' = scheda esistente, 'new' = scheda da creare, 'orphan' =
    // sessione in modifica la cui scheda è stata eliminata (si salva senza
    // toccare la libreria)
    source:     initial ? (linked ? 'library' : 'orphan') : null,
    workoutId:  initial?.workoutId || null,
    name:       linked?.name || initial?.workoutName || '',
    items:      initial?.items ? structuredClone(initial.items) : [],
    updateLibrary: false,
    date:       initial?.date ? initial.date.split('T')[0] : new Date().toISOString().split('T')[0],
    intensity:  initial?.intensity || 'media',
    athletics:  athleticsDraft(initial?.athletics),
    showAthletics: hasAthletics(initial?.athletics),
  }
}

export default function AddGymModal({ initial = null, workouts = [], sessions = [], exerciseApi, onClose, onSave }) {
  const [step, setStep]     = useState(1)
  const [form, setForm]     = useState(() => initialForm(initial, workouts))
  const [saving, setSaving] = useState(false)

  const { index } = exerciseApi
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const libraryWorkout = form.source === 'library' ? workouts.find(w => w.id === form.workoutId) : null
  const modified = libraryWorkout ? !sameItems(form.items, libraryWorkout.items) : false

  const structureIssues = workoutIssues(form.items, index)
  const athleticsProblems = athleticsIssues(form.athletics)

  const stepValid = (() => {
    switch (step) {
      case 1: return form.source === 'new' ? form.name.trim().length > 0 : Boolean(form.source)
      case 2: return structureIssues.length === 0
      case 3: return Boolean(form.date) && athleticsProblems.length === 0
      default: return true
    }
  })()

  const isLast = step === STEPS.length
  const goNext = () => { if (stepValid) setStep(s => Math.min(s + 1, STEPS.length)) }
  const goBack = () => setStep(s => Math.max(s - 1, 1))

  const pickWorkout = (w) => setForm(f => ({
    ...f, source: 'library', workoutId: w.id, name: w.name,
    items: structuredClone(w.items || []), updateLibrary: false,
  }))
  const pickNew = () => setForm(f => (f.source === 'new' ? f : {
    ...f, source: 'new', workoutId: null, name: '', items: [], updateLibrary: false,
  }))

  const handleSave = async () => {
    if (!stepValid || saving) return
    setSaving(true)
    await onSave({
      session: {
        date:        new Date(form.date).toISOString(),
        workoutName: form.name.trim(),
        items:       normalizeItems(form.items, index),
        intensity:   form.intensity,
        athletics:   normalizeAthletics(form.athletics),
        notes:       initial?.notes || [],
      },
      workout: {
        id:   form.source === 'new' ? null : form.workoutId,
        name: form.name.trim(),
        updateLibrary: form.source === 'library' && modified && form.updateLibrary,
      },
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
            <div className="flex items-center gap-3 min-w-0">
              {step > 1 && (
                <button onClick={goBack} className="text-sm font-medium shrink-0" style={{ color: 'var(--color-teal)' }}>
                  ← Indietro
                </button>
              )}
              <h2 className="text-lg font-bold truncate" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-white)' }}>
                {step > 1 && form.name ? form.name : initial ? 'Modifica allenamento' : 'Nuova palestra'}
              </h2>
            </div>
            <button onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-lg shrink-0"
                    style={{ color: 'var(--color-slate)', background: 'var(--color-surface-2)' }}>
              ✕
            </button>
          </div>
          <StepIndicator step={step} />
        </div>

        {/* Corpo scrollabile */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {step === 1 && (
            <StepWorkout form={form} set={set} workouts={workouts} sessions={sessions} index={index}
                         onPick={pickWorkout} onPickNew={pickNew} />
          )}

          {step === 2 && (
            <div className="space-y-4">
              <ExerciseEditor items={form.items} exerciseApi={exerciseApi} onChange={items => set('items', items)} />

              {libraryWorkout && modified && (
                <button onClick={() => set('updateLibrary', !form.updateLibrary)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl text-left"
                  style={{ background: 'var(--color-surface-2)', border: form.updateLibrary ? '1px solid var(--color-teal)' : '1px solid transparent' }}>
                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-[11px] shrink-0"
                        style={{ background: form.updateLibrary ? 'var(--color-teal-dark)' : 'var(--color-surface)', color: 'var(--color-white)' }}>
                    {form.updateLibrary ? '✓' : ''}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-white)' }}>
                    Aggiorna anche la scheda «{libraryWorkout.name}» in libreria
                    <span className="block text-[11px] mt-0.5" style={{ color: 'var(--color-slate)' }}>
                      Altrimenti la modifica vale solo per questa sessione.
                    </span>
                  </span>
                </button>
              )}
            </div>
          )}

          {step === 3 && (
            <StepSession form={form} set={set} setForm={setForm} issues={athleticsProblems} index={index} />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 shrink-0" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
          {step === 2 && structureIssues.length > 0 && (
            <p className="text-[11px] mb-2 text-center" style={{ color: 'var(--color-loss)' }}>⚠ {structureIssues[0]}</p>
          )}
          <button
            onClick={isLast ? handleSave : goNext}
            disabled={!stepValid || saving}
            className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-95"
            style={{
              background: (!stepValid || saving) ? 'var(--color-surface-2)' : 'var(--color-amber)',
              color:      (!stepValid || saving) ? 'var(--color-slate)'     : 'var(--color-bg)',
              fontFamily: 'var(--font-display)'
            }}>
            {saving ? 'Salvataggio...' : isLast ? (initial ? 'Salva modifiche' : 'Salva allenamento') : 'Avanti'}
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

// ── Step 1 — Scheda ────────────────────────────────────────

function StepWorkout({ form, set, workouts, sessions, index, onPick, onPickNew }) {
  const sorted = sortWorkoutsByUse(workouts, sessions)
  const usage = workoutUsage(sessions)

  return (
    <div className="space-y-4">
      <StepTitle title="Quale scheda hai fatto?"
                 sub="Scegline una dalla libreria o creane una nuova" />

      {form.source === 'orphan' && (
        <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-teal)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{form.name || 'Palestra'}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-slate)' }}>
            La scheda non è più in libreria: la sessione conserva i propri esercizi.
          </p>
        </div>
      )}

      {/* Nuova scheda */}
      <div className="rounded-2xl p-3"
           style={{ background: 'var(--color-surface-2)', border: form.source === 'new' ? '1px solid var(--color-teal)' : '1px solid transparent' }}>
        <button onClick={onPickNew} className="w-full text-left flex items-center gap-2">
          <span className="text-lg" style={{ color: 'var(--color-teal)' }}>＋</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            Nuova scheda
          </span>
        </button>
        {form.source === 'new' && (
          <input
            autoFocus
            type="text"
            value={form.name}
            maxLength={60}
            onChange={e => set('name', e.target.value)}
            placeholder="Es. Push, Gambe, Full body A..."
            className="w-full mt-3 p-3 rounded-xl text-sm outline-none"
            style={{ background: 'var(--color-surface)', color: 'var(--color-white)', border: '1px solid var(--color-teal-dark)', fontFamily: 'var(--font-body)' }}
          />
        )}
      </div>

      {sorted.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider"
             style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
            Le tue schede
          </p>
          {sorted.map(w => {
            const active = form.source === 'library' && form.workoutId === w.id
            const u = usage[w.id]
            return (
              <button key={w.id} onClick={() => onPick(w)}
                className="w-full text-left rounded-2xl p-3 transition-all"
                style={{ background: 'var(--color-surface-2)', border: active ? '1px solid var(--color-teal)' : '1px solid transparent' }}>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                    {w.name}
                  </span>
                  <span className="text-[11px] shrink-0" style={{ color: 'var(--color-slate)' }}>
                    {u ? `${u.count} ${u.count === 1 ? 'volta' : 'volte'} · ${formatShortDate(u.lastDate)}` : 'Mai fatta'}
                  </span>
                </div>
                <WorkoutSummary items={w.items} index={index} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Step 3 — Sessione ──────────────────────────────────────

function StepSession({ form, set, setForm, issues, index }) {
  const setAthletics = (updater) => setForm(f => ({ ...f, athletics: typeof updater === 'function' ? updater(f.athletics) : updater }))
  const t = workoutTotals(form.items, index)

  return (
    <div className="space-y-4">
      <StepTitle title="Quando l'hai fatto?"
                 sub={`${t.exercises} esercizi · ${t.sets} serie. I dati dell'orologio sono facoltativi: puoi aggiungerli dopo dal dettaglio`} />

      <div>
        <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Data</label>
        <input
          type="date"
          value={form.date}
          onChange={e => set('date', e.target.value)}
          className="w-full p-3 rounded-xl text-sm outline-none"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-body)', colorScheme: 'dark' }}
        />
      </div>

      {/* Stessa scala a tre livelli di tennis e corsa: servirà al carico comune. */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2"
           style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          Intensità percepita
        </p>
        <div className="grid grid-cols-3 gap-2">
          {INTENSITIES.map(i => {
            const active = form.intensity === i.id
            return (
              <button key={i.id} onClick={() => set('intensity', i.id)}
                className="py-3 rounded-2xl text-sm font-semibold transition-all"
                style={{
                  background: active ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                  color:      active ? 'var(--color-white)' : 'var(--color-slate)',
                  border:     active ? `1px solid ${i.color}` : '1px solid transparent',
                  fontFamily: 'var(--font-display)'
                }}>
                {i.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <button onClick={() => set('showAthletics', !form.showAthletics)} className="w-full flex items-center justify-between py-2">
          <span className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
            ⌚ Dati dall'orologio
          </span>
          <span className="text-xs" style={{ color: 'var(--color-slate)' }}>{form.showAthletics ? '▾' : '▸ facoltativi'}</span>
        </button>
        {form.showAthletics && (
          <div className="mt-2">
            <RunAthleticsFields draft={form.athletics} setDraft={setAthletics} showDistance={false} />
          </div>
        )}
      </div>

      {issues.map(msg => (
        <p key={msg} className="text-xs" style={{ color: 'var(--color-loss)' }}>⚠ {msg}</p>
      ))}
    </div>
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

function formatShortDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
  } catch { return dateStr }
}
