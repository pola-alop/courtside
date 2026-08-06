import { useState } from 'react'
import ScoreBoard from './ScoreBoard'
import { RESULT_META, MATCH_FORMATS, MATCH_TYPES, surfaceIcon } from '../../lib/tennis'

const MAX_NOTE_LENGTH = 150

const EQUIP_TYPES = [
  { id: 'racchetta', label: 'Racchetta', icon: '🎾' },
  { id: 'scarpa',    label: 'Scarpe',    icon: '👟' },
  { id: 'outfit',    label: 'Outfit',    icon: '👕' },
  { id: 'borsone',   label: 'Borsone',   icon: '🎒' },
]

export default function MatchDetailModal({
  match, equipment = [], onClose, onEdit, onUpdate, onDelete
}) {
  // view | confirmDelete | addNote | editNote | confirmDeleteNote
  const [mode, setMode]     = useState('view')
  const [saving, setSaving] = useState(false)
  const [noteDraft, setNoteDraft]   = useState('')
  const [noteTarget, setNoteTarget] = useState(null)

  const meta = RESULT_META[match.result] || RESULT_META.draw
  const fmt  = MATCH_FORMATS[match.format]
  const typeLabel = MATCH_TYPES.find(t => t.id === match.type)?.label || match.type

  const notes = match.notes || []
  const sortedNotes = [...notes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const openAddNote  = () => { setNoteDraft(''); setMode('addNote') }
  const openEditNote = (note) => { setNoteTarget(note); setNoteDraft(note.text); setMode('editNote') }
  const cancelNote   = () => { setNoteDraft(''); setNoteTarget(null); setMode('view') }
  const canSaveNote  = noteDraft.trim().length > 0

  const handleSaveNewNote = async () => {
    if (!canSaveNote || saving) return
    setSaving(true)
    await onUpdate(match.id, { notes: [...notes, { text: noteDraft.trim(), createdAt: new Date().toISOString() }] })
    setSaving(false); setNoteDraft(''); setMode('view')
  }

  const handleSaveEditNote = async () => {
    if (!canSaveNote || saving || !noteTarget) return
    setSaving(true)
    const updated = notes.map(n => n.createdAt === noteTarget.createdAt ? { ...n, text: noteDraft.trim() } : n)
    await onUpdate(match.id, { notes: updated })
    setSaving(false); setNoteDraft(''); setNoteTarget(null); setMode('view')
  }

  const handleDeleteNote = async () => {
    if (!noteTarget || saving) return
    setSaving(true)
    await onUpdate(match.id, { notes: notes.filter(n => n.createdAt !== noteTarget.createdAt) })
    setSaving(false); setNoteDraft(''); setNoteTarget(null); setMode('view')
  }

  const equipRows = EQUIP_TYPES
    .map(t => {
      const id = match.equipment?.[t.id]
      if (!id) return null
      const item = equipment.find(e => e.id === id)
      if (!item) return { ...t, name: 'Non più disponibile', nickname: null }
      return { ...t, name: item.model || item.name || '—', nickname: item.nickname || null }
    })
    .filter(Boolean)

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
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                {formatDate(match.date)}
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full mt-1"
                    style={{ background: meta.bg, color: meta.color, fontFamily: 'var(--font-display)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
                {meta.label}{!match.completed && match.result !== 'draw' ? ' · interrotta' : ''}
              </span>
            </div>
            {mode === 'view' && (
              <button onClick={onClose}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                      style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)' }}>
                ✕
              </button>
            )}
          </div>

          {/* Scoreboard grande */}
          <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--color-surface-2)' }}>
            <ScoreBoard
              sets={match.sets}
              format={match.format}
              retired={match.retired}
              opponentName={match.opponentName}
              size="md"
            />
          </div>
        </div>

        {/* Contenuto scrollabile */}
        <div className="overflow-y-auto flex-1 px-6 py-4">

          {mode === 'view' && <>
            <button
              onClick={onEdit}
              className="w-full mb-4 py-2.5 rounded-2xl text-xs font-semibold transition-all"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal)', fontFamily: 'var(--font-display)', border: '1px solid var(--color-teal-dark)' }}>
              ✏️ Modifica partita
            </button>

            <Section title="Dettagli">
              <Row label="Avversario" value={match.opponentName || '—'} />
              <Row label="Tipo" value={match.eventName ? `${typeLabel} · ${match.eventName}` : typeLabel} />
              <Row label="Superficie" value={`${surfaceIcon(match.surface)} ${cap(match.surface)}`} />
              <Row label="Formato" value={fmt?.label || match.format} />
            </Section>

            {equipRows.length > 0 && (
              <Section title="Attrezzatura usata">
                {equipRows.map(e => (
                  <Row key={e.id} label={`${e.icon} ${e.label}`} value={e.name} subValue={e.nickname} />
                ))}
              </Section>
            )}

            <NotesSection notes={sortedNotes} onAdd={openAddNote} onEditNote={openEditNote} />

            <div className="mt-6 pb-2">
              <button
                onClick={() => setMode('confirmDelete')}
                className="w-full py-3 rounded-2xl text-sm font-semibold transition-all"
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-loss)', fontFamily: 'var(--font-display)', border: '1px solid var(--color-loss-bg)' }}>
                🗑️ Elimina partita
              </button>
            </div>
          </>}

          {mode === 'confirmDelete' && (
            <div className="pt-2">
              <ConfirmBox
                message="Eliminare questa partita? L'azione non può essere annullata."
                confirmLabel="Elimina"
                onCancel={() => setMode('view')}
                onConfirm={() => { onDelete(match.id); onClose() }}
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

function Row({ label, value, subValue }) {
  return (
    <div className="flex justify-between items-center px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span className="text-xs" style={{ color: 'var(--color-slate)' }}>{label}</span>
      <span className="text-right">
        <span className="block text-xs font-medium" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>{value}</span>
        {subValue && (
          <span className="block text-[11px] mt-0.5" style={{ color: 'var(--color-white)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>{subValue}</span>
        )}
      </span>
    </div>
  )
}

function NotesSection({ notes, onAdd, onEditNote }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          Note sulla partita
        </p>
        <button onClick={onAdd} className="text-xs font-semibold" style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-display)' }}>
          + Aggiungi
        </button>
      </div>
      {notes.length === 0 ? (
        <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--color-surface-2)' }}>
          <p className="text-sm" style={{ color: 'var(--color-slate)' }}>Nessuna nota su questa partita.</p>
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
          placeholder="Come è andata, sensazioni, cosa ha funzionato..."
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

const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—')
