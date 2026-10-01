import { useState } from 'react'
import { intensityMeta } from '../../lib/training'
import { formatDuration } from '../../lib/athletics'
import {
  runDisplayName, workoutTotals, stepTypeMeta, formatStepDuration, formatTarget,
  formatStepTime, formatKm, avgPaceSec, formatPace, isRunningReady,
} from '../../lib/running'
import AthleticsSection from '../athletics/AthleticsSection'
import WorkoutChart from './WorkoutChart'
import RunAthleticsEditor from './RunAthleticsEditor'
import PhaseCompare from './PhaseCompare'
import { useFitDetail } from '../../hooks/useFitDetail'

const MAX_NOTE_LENGTH = 150

// Dettaglio di una corsa: grafico delle fasi, pianificato contro reale, la
// struttura in sola lettura, i dati dell'orologio e le note. La struttura si
// modifica riaprendo il wizard (`onEdit`), come per partite e allenamenti.
export default function RunDetailModal({
  run, workouts = [], running, fitUse = null, onClose, onEdit, onUpdate, onDelete
}) {
  // view | confirmDelete | editAthletics | addNote | editNote | confirmDeleteNote
  const [mode, setMode]     = useState('view')
  const [saving, setSaving] = useState(false)
  const [noteDraft, setNoteDraft]   = useState('')
  const [noteTarget, setNoteTarget] = useState(null)

  // Dettagli del file .FIT (se la corsa è stata importata): le serie per i
  // grafici e i lap per il confronto fase per fase.
  const { details } = useFitDetail(run.athletics?.fitId)

  const intensity = intensityMeta(run.intensity)
  const plan = workoutTotals(run.items, running)
  const real = run.athletics || {}
  const pace = avgPaceSec(real)
  const linked = run.workoutId ? workouts.some(w => w.id === run.workoutId) : false

  const notes = run.notes || []
  const sortedNotes = [...notes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const openAddNote  = () => { setNoteDraft(''); setMode('addNote') }
  const openEditNote = (note) => { setNoteTarget(note); setNoteDraft(note.text); setMode('editNote') }
  const cancelNote   = () => { setNoteDraft(''); setNoteTarget(null); setMode('view') }
  const canSaveNote  = noteDraft.trim().length > 0

  const handleSaveNewNote = async () => {
    if (!canSaveNote || saving) return
    setSaving(true)
    await onUpdate(run.id, { notes: [...notes, { text: noteDraft.trim(), createdAt: new Date().toISOString() }] })
    setSaving(false); setNoteDraft(''); setMode('view')
  }

  const handleSaveEditNote = async () => {
    if (!canSaveNote || saving || !noteTarget) return
    setSaving(true)
    const updated = notes.map(n => n.createdAt === noteTarget.createdAt ? { ...n, text: noteDraft.trim() } : n)
    await onUpdate(run.id, { notes: updated })
    setSaving(false); setNoteDraft(''); setNoteTarget(null); setMode('view')
  }

  const handleDeleteNote = async () => {
    if (!noteTarget || saving) return
    setSaving(true)
    await onUpdate(run.id, { notes: notes.filter(n => n.createdAt !== noteTarget.createdAt) })
    setSaving(false); setNoteDraft(''); setNoteTarget(null); setMode('view')
  }

  const handleSaveAthletics = async (athletics, fitDetails) => {
    if (saving) return
    setSaving(true)
    await onUpdate(run.id, { athletics }, { details: fitDetails, prevFitId: run.athletics?.fitId || null })
    setSaving(false); setMode('view')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(2,13,25,0.9)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-3xl overflow-hidden flex flex-col"
           style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)', maxHeight: '88vh' }}>

        {/* Header */}
        <div className="shrink-0 px-6 pt-6 pb-4" style={{ borderBottom: '1px solid var(--color-surface-2)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                {formatDate(run.date)}
              </p>
              <h2 className="text-lg font-bold truncate" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                🏃 {runDisplayName(run, workouts)}
              </h2>
              {intensity && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full mt-1"
                      style={{ background: 'var(--color-surface-2)', color: intensity.color, fontFamily: 'var(--font-display)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: intensity.color }} />
                  Intensità {intensity.label.toLowerCase()}
                </span>
              )}
            </div>
            {mode === 'view' && (
              <button onClick={onClose}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                      style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)' }}>
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Contenuto scrollabile */}
        <div className="overflow-y-auto flex-1 px-6 py-4">

          {mode === 'view' && <>
            <div className="rounded-2xl p-3 mb-4" style={{ background: 'var(--color-surface-2)' }}>
              <WorkoutChart items={run.items} running={running} />
              {!isRunningReady(running) && (
                <p className="text-[11px] mt-2" style={{ color: 'var(--color-amber)' }}>
                  Le zone di corsa del Profilo non sono complete: le stime della scheda non sono disponibili.
                </p>
              )}
            </div>

            {/* Pianificato contro reale: la scheda è una stima dal passo delle
                zone, l'orologio è la misura. Metterli accanto dice quanto la
                tabella delle zone descrive bene come corri davvero. */}
            {(typeof real.durationSec === 'number' || typeof real.distanceKm === 'number') && (
              <Section title="Pianificato e reale">
                <div className="grid grid-cols-3 px-4 pt-2.5 text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-slate)' }}>
                  <span />
                  <span className="text-right">Scheda</span>
                  <span className="text-right">Orologio</span>
                </div>
                <CompareRow label="Tempo"
                  planned={`${plan.secEstimated ? '~' : ''}${formatStepTime(plan.sec)}`}
                  actual={typeof real.durationSec === 'number' ? formatDuration(real.durationSec) : '—'} />
                <CompareRow label="Distanza"
                  planned={`~${formatKm(plan.km, 2)}`}
                  actual={typeof real.distanceKm === 'number' ? formatKm(real.distanceKm, 2) : '—'} />
                {pace && (
                  <CompareRow label="Passo medio"
                    planned={plan.km > 0 ? `~${formatPace(plan.sec / plan.km)}` : '—'}
                    actual={formatPace(pace)} />
                )}
              </Section>
            )}

            <button
              onClick={onEdit}
              className="w-full mb-4 py-2.5 rounded-2xl text-xs font-semibold transition-all"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal)', fontFamily: 'var(--font-display)', border: '1px solid var(--color-teal-dark)' }}>
              ✏️ Modifica corsa
            </button>

            <StructureSection items={run.items || []} running={running} />
            {!linked && (
              <p className="text-[11px] -mt-2 mb-4" style={{ color: 'var(--color-slate)' }}>
                La scheda non è più in libreria: questa corsa ne conserva la struttura.
              </p>
            )}

            {details?.laps?.length > 0 && <PhaseCompare items={run.items || []} laps={details.laps} running={running} />}

            <AthleticsSection athletics={run.athletics} title="Dati della corsa" pace details={details} />

            <button
              onClick={() => setMode('editAthletics')}
              className="w-full mb-4 py-2.5 rounded-2xl text-xs font-semibold transition-all"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal)', fontFamily: 'var(--font-display)', border: '1px solid var(--color-teal-dark)' }}>
              {run.athletics ? '⌚ Modifica dati della corsa' : '⌚ Aggiungi dati della corsa'}
            </button>

            <NotesSection notes={sortedNotes} onAdd={openAddNote} onEditNote={openEditNote} />

            <div className="mt-6 pb-2">
              <button
                onClick={() => setMode('confirmDelete')}
                className="w-full py-3 rounded-2xl text-sm font-semibold transition-all"
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-loss)', fontFamily: 'var(--font-display)', border: '1px solid var(--color-loss-bg)' }}>
                🗑️ Elimina corsa
              </button>
            </div>
          </>}

          {mode === 'editAthletics' && (
            <RunAthleticsEditor
              athletics={run.athletics}
              sessionDate={run.date ? run.date.split('T')[0] : null}
              fitUse={fitUse}
              saving={saving}
              onCancel={() => setMode('view')}
              onSave={handleSaveAthletics}
            />
          )}

          {mode === 'confirmDelete' && (
            <div className="pt-2">
              <ConfirmBox
                message="Eliminare questa corsa? La scheda resta in libreria. L'azione non può essere annullata."
                confirmLabel="Elimina"
                onCancel={() => setMode('view')}
                onConfirm={() => { onDelete(run.id); onClose() }}
              />
            </div>
          )}

          {mode === 'addNote' && (
            <NoteEditor title="Nuova nota" value={noteDraft} onChange={setNoteDraft}
              canSave={canSaveNote} saving={saving} onCancel={cancelNote} onSave={handleSaveNewNote} />
          )}

          {mode === 'editNote' && noteTarget && (
            <NoteEditor title="Modifica nota" value={noteDraft} onChange={setNoteDraft}
              canSave={canSaveNote} saving={saving} onCancel={cancelNote} onSave={handleSaveEditNote}
              onDelete={() => setMode('confirmDeleteNote')} />
          )}

          {mode === 'confirmDeleteNote' && noteTarget && (
            <div className="pt-2">
              <ConfirmBox
                message="Eliminare questa nota? L'azione non può essere annullata."
                confirmLabel="Elimina"
                onCancel={() => setMode('editNote')}
                onConfirm={handleDeleteNote}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

// La struttura com'è stata corsa, in sola lettura: una riga per fase, le
// ripetute raggruppate sotto il loro "N volte".
function StructureSection({ items, running }) {
  if (items.length === 0) return null
  return (
    <Section title="Struttura">
      {items.map(item => (
        item.kind === 'repeat' ? (
          <div key={item.id} className="px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
              {item.times} {item.times === 1 ? 'volta' : 'volte'}
              {item.skipLastRecovery && (
                <span className="font-normal" style={{ color: 'var(--color-slate)' }}> · senza l'ultimo recupero</span>
              )}
            </p>
            <div className="pl-2 space-y-1" style={{ borderLeft: '1px solid rgba(255,255,255,0.14)' }}>
              {item.steps.map(s => <StepLine key={s.id} step={s} running={running} />)}
            </div>
          </div>
        ) : (
          <div key={item.id} className="px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <StepLine step={item} running={running} />
          </div>
        )
      ))}
    </Section>
  )
}

function StepLine({ step, running }) {
  const meta = stepTypeMeta(step.stepType)
  return (
    <div className="flex items-start gap-2">
      <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: meta.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{meta.label}</span>
          <span className="text-xs shrink-0" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
            {formatStepDuration(step.duration)}
          </span>
        </div>
        <p className="text-[11px] truncate" style={{ color: 'var(--color-slate)' }}>{formatTarget(step.target, running)}</p>
        {step.notes && <p className="text-[11px] italic" style={{ color: 'var(--color-teal-light)' }}>{step.notes}</p>}
      </div>
    </div>
  )
}

function CompareRow({ label, planned, actual }) {
  return (
    <div className="grid grid-cols-3 items-center px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span className="text-xs" style={{ color: 'var(--color-slate)' }}>{label}</span>
      <span className="text-xs text-right" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>{planned}</span>
      <span className="text-xs text-right font-semibold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>{actual}</span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
        {title}
      </p>
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
        {children}
      </div>
    </div>
  )
}

function NotesSection({ notes, onAdd, onEditNote }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          Note sulla corsa
        </p>
        <button onClick={onAdd} className="text-xs font-semibold" style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-display)' }}>
          + Aggiungi
        </button>
      </div>
      {notes.length === 0 ? (
        <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--color-surface-2)' }}>
          <p className="text-sm" style={{ color: 'var(--color-slate)' }}>Nessuna nota su questa corsa.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map(n => (
            <div key={n.createdAt} className="rounded-2xl px-4 py-3 flex items-start justify-between gap-3" style={{ background: 'var(--color-surface-2)' }}>
              <p className="text-sm flex-1 whitespace-pre-wrap" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-body)' }}>{n.text}</p>
              <button onClick={() => onEditNote(n)} aria-label="Modifica nota"
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0"
                style={{ background: 'rgba(118,195,194,0.15)', color: 'var(--color-teal)' }}>
                ✏️
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NoteEditor({ title, value, onChange, canSave, saving, onCancel, onSave, onDelete }) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-display)' }}>{title}</p>
      <div>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          maxLength={MAX_NOTE_LENGTH}
          rows={3}
          placeholder="Sensazioni, gambe, meteo, cosa cambiare la prossima volta..."
          className="w-full p-3 rounded-xl text-sm outline-none resize-none"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', border: '1px solid var(--color-teal-dark)', fontFamily: 'var(--font-body)' }}
        />
        <p className="text-[11px] mt-1 text-right" style={{ color: 'var(--color-slate)' }}>{value.length}/{MAX_NOTE_LENGTH}</p>
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-3 rounded-2xl text-sm font-semibold"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
          Annulla
        </button>
        <button onClick={onSave} disabled={!canSave || saving}
          className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
          style={{
            background: (!canSave || saving) ? 'var(--color-surface-2)' : 'var(--color-amber)',
            color:      (!canSave || saving) ? 'var(--color-slate)'     : 'var(--color-bg)',
            fontFamily: 'var(--font-display)'
          }}>
          {saving ? 'Salvo...' : 'Salva'}
        </button>
      </div>
      {onDelete && (
        <button onClick={onDelete} className="w-full py-2.5 rounded-2xl text-xs font-semibold transition-all"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-loss)', fontFamily: 'var(--font-display)', border: '1px solid var(--color-loss-bg)' }}>
          🗑️ Elimina nota
        </button>
      )}
    </div>
  )
}

function ConfirmBox({ message, confirmLabel, onCancel, onConfirm }) {
  return (
    <div className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-surface-2)' }}>
      <p className="text-sm mb-3 text-center" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{message}</p>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
          Annulla
        </button>
        <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--color-loss)', color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return dateStr }
}
