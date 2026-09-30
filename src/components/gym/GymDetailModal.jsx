import { useState } from 'react'
import { intensityMeta } from '../../lib/training'
import {
  gymDisplayName, workoutTotals, resolveExercise, summarizeSets, muscleScores,
  muscleContributors, heatOf, heatColor, muscleLabel, MUSCLES, formatVolume,
  SESSION_FULL_SETS, gymMinutes,
} from '../../lib/gym'
import { formatDuration } from '../../lib/athletics'
import AthleticsSection from '../athletics/AthleticsSection'
import RunAthleticsEditor from '../runs/RunAthleticsEditor'
import BodyMap, { BodyMapLegend } from './BodyMap'

const MAX_NOTE_LENGTH = 150

// Dettaglio di una sessione di palestra: il manichino dei muscoli allenati, i
// numeri della scheda, gli esercizi in sola lettura, i dati dell'orologio e le
// note. Gli esercizi si modificano riaprendo il wizard (`onEdit`), come per
// partite, allenamenti e corse.
export default function GymDetailModal({
  session, workouts = [], index, onClose, onEdit, onUpdate, onDelete
}) {
  // view | confirmDelete | editAthletics | addNote | editNote | confirmDeleteNote
  const [mode, setMode]     = useState('view')
  const [saving, setSaving] = useState(false)
  const [noteDraft, setNoteDraft]   = useState('')
  const [noteTarget, setNoteTarget] = useState(null)
  const [selectedMuscle, setSelectedMuscle] = useState(null)

  const intensity = intensityMeta(session.intensity)
  const items = session.items || []
  const totals = workoutTotals(items, index)
  const { minutes, estimated } = gymMinutes(session, index)
  const linked = session.workoutId ? workouts.some(w => w.id === session.workoutId) : false

  const scores = muscleScores(items, index)
  const heat = Object.fromEntries(Object.entries(scores).map(([m, v]) => [m, heatOf(v, SESSION_FULL_SETS)]))
  const ranked = MUSCLES.filter(m => scores[m.id]).sort((a, b) => scores[b.id] - scores[a.id])

  const notes = session.notes || []
  const sortedNotes = [...notes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const openAddNote  = () => { setNoteDraft(''); setMode('addNote') }
  const openEditNote = (note) => { setNoteTarget(note); setNoteDraft(note.text); setMode('editNote') }
  const cancelNote   = () => { setNoteDraft(''); setNoteTarget(null); setMode('view') }
  const canSaveNote  = noteDraft.trim().length > 0

  const handleSaveNewNote = async () => {
    if (!canSaveNote || saving) return
    setSaving(true)
    await onUpdate(session.id, { notes: [...notes, { text: noteDraft.trim(), createdAt: new Date().toISOString() }] })
    setSaving(false); setNoteDraft(''); setMode('view')
  }

  const handleSaveEditNote = async () => {
    if (!canSaveNote || saving || !noteTarget) return
    setSaving(true)
    const updated = notes.map(n => n.createdAt === noteTarget.createdAt ? { ...n, text: noteDraft.trim() } : n)
    await onUpdate(session.id, { notes: updated })
    setSaving(false); setNoteDraft(''); setNoteTarget(null); setMode('view')
  }

  const handleDeleteNote = async () => {
    if (!noteTarget || saving) return
    setSaving(true)
    await onUpdate(session.id, { notes: notes.filter(n => n.createdAt !== noteTarget.createdAt) })
    setSaving(false); setNoteDraft(''); setNoteTarget(null); setMode('view')
  }

  const handleSaveAthletics = async (athletics) => {
    if (saving) return
    setSaving(true)
    await onUpdate(session.id, { athletics })
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
                {formatDate(session.date)}
              </p>
              <h2 className="text-lg font-bold truncate" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                🏋️ {gymDisplayName(session, workouts)}
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
            <div className="grid grid-cols-4 gap-2 mb-4">
              <StatTile label="Esercizi" value={totals.exercises} />
              <StatTile label="Serie" value={totals.sets} />
              <StatTile label="Volume" value={formatVolume(totals.volumeKg)} />
              <StatTile label="Durata" value={`${estimated ? '~' : ''}${formatDuration(Math.round(minutes * 60))}`} />
            </div>

            {/* Manichino: cosa è stato allenato, sulla scala assoluta */}
            <Section title="Muscoli allenati" raw>
              <div className="rounded-xl py-2" style={{ background: 'var(--color-bg)' }}>
                <BodyMap heat={heat} selected={selectedMuscle} onSelect={setSelectedMuscle} />
              </div>
              <div className="mt-3"><BodyMapLegend /></div>

              {selectedMuscle ? (
                <MuscleDetail muscleId={selectedMuscle} points={scores[selectedMuscle] || 0}
                              contributors={muscleContributors(items, index, selectedMuscle)} />
              ) : ranked.length > 0 ? (
                <p className="text-[11px] text-center mt-3" style={{ color: 'var(--color-slate)' }}>
                  Tocca un muscolo per vedere quali esercizi lo hanno lavorato.
                </p>
              ) : null}

              {ranked.length > 0 && (
                <div className="mt-3 space-y-2">
                  {ranked.map(m => (
                    <button key={m.id} onClick={() => setSelectedMuscle(s => (s === m.id ? null : m.id))} className="w-full text-left">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[11px] flex-1" style={{ color: selectedMuscle === m.id ? 'var(--color-white)' : 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
                          {m.label}
                        </span>
                        <span className="text-[11px] font-semibold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
                          {formatPoints(scores[m.id])}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full mt-1" style={{ background: 'var(--color-bg)' }}>
                        <div className="h-full rounded-full"
                             style={{ width: `${Math.max(4, heat[m.id] * 100)}%`, background: heatColor(Math.max(0.05, heat[m.id])) }} />
                      </div>
                    </button>
                  ))}
                  <p className="text-[10px]" style={{ color: 'var(--color-slate)' }}>
                    Serie equivalenti: 1 per i muscoli principali, 0,5 per i secondari. Rosso pieno a {SESSION_FULL_SETS}.
                  </p>
                </div>
              )}
            </Section>

            <button
              onClick={onEdit}
              className="w-full mb-4 py-2.5 rounded-2xl text-xs font-semibold transition-all"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal)', fontFamily: 'var(--font-display)', border: '1px solid var(--color-teal-dark)' }}>
              ✏️ Modifica allenamento
            </button>

            <ExercisesSection items={items} index={index} />
            {!linked && (
              <p className="text-[11px] -mt-2 mb-4" style={{ color: 'var(--color-slate)' }}>
                La scheda non è più in libreria: questa sessione ne conserva gli esercizi.
              </p>
            )}

            <AthleticsSection athletics={session.athletics} title="Dati dell'allenamento" />

            <button
              onClick={() => setMode('editAthletics')}
              className="w-full mb-4 py-2.5 rounded-2xl text-xs font-semibold transition-all"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal)', fontFamily: 'var(--font-display)', border: '1px solid var(--color-teal-dark)' }}>
              {session.athletics ? '⌚ Modifica dati dell\'allenamento' : '⌚ Aggiungi dati dell\'allenamento'}
            </button>

            <NotesSection notes={sortedNotes} onAdd={openAddNote} onEditNote={openEditNote} />

            <div className="mt-6 pb-2">
              <button
                onClick={() => setMode('confirmDelete')}
                className="w-full py-3 rounded-2xl text-sm font-semibold transition-all"
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-loss)', fontFamily: 'var(--font-display)', border: '1px solid var(--color-loss-bg)' }}>
                🗑️ Elimina allenamento
              </button>
            </div>
          </>}

          {mode === 'editAthletics' && (
            <RunAthleticsEditor
              athletics={session.athletics}
              saving={saving}
              showDistance={false}
              title="Dati dell'allenamento"
              clearLabel="Svuota i dati dell'allenamento"
              onCancel={() => setMode('view')}
              onSave={handleSaveAthletics}
            />
          )}

          {mode === 'confirmDelete' && (
            <div className="pt-2">
              <ConfirmBox
                message="Eliminare questo allenamento? La scheda resta in libreria. L'azione non può essere annullata."
                confirmLabel="Elimina"
                onCancel={() => setMode('view')}
                onConfirm={() => { onDelete(session.id); onClose() }}
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

function StatTile({ label, value }) {
  return (
    <div className="rounded-xl px-1.5 py-2.5 text-center min-w-0" style={{ background: 'var(--color-surface-2)' }}>
      <p className="text-sm font-bold truncate" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{value}</p>
      <p className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: 'var(--color-slate)' }}>{label}</p>
    </div>
  )
}

// Perché un muscolo è di quel colore: gli esercizi che lo hanno lavorato.
function MuscleDetail({ muscleId, points, contributors }) {
  return (
    <div className="mt-3 rounded-xl px-3 py-2.5" style={{ background: 'var(--color-bg)' }}>
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {muscleLabel(muscleId)}
        </p>
        <p className="text-[11px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          {points > 0 ? `${formatPoints(points)} serie eq.` : 'Non allenato'}
        </p>
      </div>
      {contributors.map(c => (
        <div key={c.exercise.id} className="flex items-baseline justify-between gap-2 mt-1.5">
          <span className="text-[11px] truncate" style={{ color: 'var(--color-white)' }}>{c.exercise.name}</span>
          <span className="text-[11px] shrink-0" style={{ color: 'var(--color-slate)' }}>
            {c.sets} serie · {c.role === 'primary' ? 'principale' : 'secondario'}
          </span>
        </div>
      ))}
    </div>
  )
}

// Gli esercizi com'erano nella sessione, in sola lettura.
function ExercisesSection({ items, index }) {
  if (items.length === 0) return null
  return (
    <Section title="Esercizi">
      {items.map(it => {
        const ex = resolveExercise(it, index)
        return (
          <div key={it.id} className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{ex.name}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
              {summarizeSets(it.sets, ex.mode)}
            </p>
            <p className="text-[11px] truncate" style={{ color: 'var(--color-slate)' }}>
              {ex.primary.map(muscleLabel).join(', ') || '—'}
            </p>
          </div>
        )
      })}
    </Section>
  )
}

function Section({ title, raw = false, children }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
        {title}
      </p>
      <div className={raw ? 'rounded-2xl p-3' : 'rounded-2xl overflow-hidden'} style={{ background: 'var(--color-surface-2)' }}>
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
          Note sull'allenamento
        </p>
        <button onClick={onAdd} className="text-xs font-semibold" style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-display)' }}>
          + Aggiungi
        </button>
      </div>
      {notes.length === 0 ? (
        <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--color-surface-2)' }}>
          <p className="text-sm" style={{ color: 'var(--color-slate)' }}>Nessuna nota su questo allenamento.</p>
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
          placeholder="Sensazioni, carichi da alzare la prossima volta, dolori..."
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

const formatPoints = (v) => v.toLocaleString('it-IT', { maximumFractionDigits: 1 })

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return dateStr }
}
