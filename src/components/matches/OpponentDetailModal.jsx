import { useState } from 'react'
import MatchRow from './MatchRow'

const HANDS = [
  { id: 'destro',   label: 'Destro'  },
  { id: 'sinistro', label: 'Mancino' },
]

const MAX_NOTE_LENGTH = 150

export default function OpponentDetailModal({
  opponent, record = null, matches = [], onClose, onUpdate, onDelete, onSelectMatch
}) {
  // view | edit | confirmDelete | addNote | editNote | confirmDeleteNote
  const [mode, setMode]         = useState('view')
  const [editForm, setEditForm] = useState(null)
  const [saving, setSaving]     = useState(false)

  // Nota in lavorazione (aggiunta o modifica) — le note sono gestite qui,
  // separate dal form "Modifica avversario"
  const [noteDraft, setNoteDraft]   = useState('')
  const [noteTarget, setNoteTarget] = useState(null)

  const wins   = record?.wins   ?? 0
  const losses = record?.losses ?? 0
  const draws  = record?.draws  ?? 0

  const notes = opponent.notes || []
  const sortedNotes = [...notes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  // Un avversario con almeno una partita all'attivo non può essere eliminato
  // (serve alle statistiche future): l'anagrafica resta, si può solo modificare.
  const hasMatches = matches.length > 0

  const setField = (k, v) => setEditForm(f => ({ ...f, [k]: v }))

  // Il form va ricalcolato da `opponent` all'apertura, non una volta al mount,
  // così "Modifica" mostra sempre i dati aggiornati dopo un reload.
  const openEdit = () => {
    setEditForm({
      name:      opponent.name      || '',
      hand:      opponent.hand      || null,
      level:     opponent.level     || '',
      playstyle: opponent.playstyle || '',
    })
    setMode('edit')
  }

  const canSave = editForm && editForm.name.trim().length > 0

  const handleSaveEdit = async () => {
    if (!canSave || saving) return
    setSaving(true)
    await onUpdate(opponent.id, {
      name:      editForm.name.trim(),
      hand:      editForm.hand || null,
      level:     editForm.level.trim()     || null,
      playstyle: editForm.playstyle.trim() || null,
    })
    setSaving(false)
    setEditForm(null)
    setMode('view')
  }

  const openAddNote  = () => { setNoteDraft(''); setMode('addNote') }
  const openEditNote = (note) => { setNoteTarget(note); setNoteDraft(note.text); setMode('editNote') }
  const cancelNote   = () => { setNoteDraft(''); setNoteTarget(null); setMode('view') }

  const canSaveNote = noteDraft.trim().length > 0

  const handleSaveNewNote = async () => {
    if (!canSaveNote || saving) return
    setSaving(true)
    const newNote = { text: noteDraft.trim(), createdAt: new Date().toISOString() }
    await onUpdate(opponent.id, { notes: [...notes, newNote] })
    setSaving(false)
    setNoteDraft('')
    setMode('view')
  }

  const handleSaveEditNote = async () => {
    if (!canSaveNote || saving || !noteTarget) return
    setSaving(true)
    const updated = notes.map(n =>
      n.createdAt === noteTarget.createdAt ? { ...n, text: noteDraft.trim() } : n
    )
    await onUpdate(opponent.id, { notes: updated })
    setSaving(false)
    setNoteDraft('')
    setNoteTarget(null)
    setMode('view')
  }

  const handleDeleteNote = async () => {
    if (!noteTarget || saving) return
    setSaving(true)
    const updated = notes.filter(n => n.createdAt !== noteTarget.createdAt)
    await onUpdate(opponent.id, { notes: updated })
    setSaving(false)
    setNoteDraft('')
    setNoteTarget(null)
    setMode('view')
  }

  const accent = avatarAccent(opponent.name)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(2,13,25,0.9)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-3xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-surface-2)',
          maxHeight: '88vh'
        }}
      >
        {/* Header — avatar + nome */}
        <div className="relative shrink-0 px-6 pt-6 pb-4 flex items-center gap-4"
             style={{ borderBottom: '1px solid var(--color-surface-2)' }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
               style={{ background: accent.bg }}>
            <span className="text-lg font-bold"
                  style={{ color: accent.fg, fontFamily: 'var(--font-display)' }}>
              {getInitials(opponent.name)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate"
                style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
              {opponent.name}
            </h2>
            {(opponent.hand || opponent.level) && (
              <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--color-slate)' }}>
                {[handLabel(opponent.hand), opponent.level].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          {mode === 'view' && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)' }}>
              ✕
            </button>
          )}
        </div>

        {/* Contenuto scrollabile */}
        <div className="overflow-y-auto flex-1 px-6 py-4">

          {/* ── MODO VISUALIZZAZIONE ── */}
          {mode === 'view' && <>

            {/* Blocco testa-a-testa */}
            <div className="grid grid-cols-4 gap-2 mb-5">
              <StatTile label="Vittorie"  value={wins}                  color="var(--color-teal-light)" />
              <StatTile label="Pareggi"   value={draws}                 color="var(--color-draw)" />
              <StatTile label="Sconfitte" value={losses}                color="#ff7070" />
              <StatTile label="Scontri"   value={wins + losses + draws} color="var(--color-white)" />
            </div>

            {/* Bottone modifica */}
            <button
              onClick={openEdit}
              className="w-full mb-4 py-2.5 rounded-2xl text-xs font-semibold transition-all"
              style={{
                background: 'var(--color-surface-2)',
                color: 'var(--color-teal)',
                fontFamily: 'var(--font-display)',
                border: '1px solid var(--color-teal-dark)'
              }}>
              ✏️ Modifica avversario
            </button>

            <Section title="Dettagli">
              <Row label="Mano"          value={handLabel(opponent.hand) || '—'} />
              <Row label="Livello"       value={opponent.level     || '—'} />
              <Row label="Stile di gioco" value={opponent.playstyle || '—'} />
            </Section>

            <NotesSection notes={sortedNotes} onAdd={openAddNote} onEditNote={openEditNote} />

            <MatchHistorySection matches={matches} onSelectMatch={onSelectMatch} />

            {/* Elimina — bloccata se l'avversario ha match collegati: quei dati
                servono alle statistiche future, quindi l'anagrafica resta. */}
            <div className="mt-6 pb-2">
              {hasMatches ? (
                <div className="p-3 rounded-2xl text-center"
                     style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-surface-2)' }}>
                  <p className="text-xs" style={{ color: 'var(--color-slate)' }}>
                    🔒 Non eliminabile: ha {matches.length} {matches.length === 1 ? 'partita' : 'partite'} all'attivo.
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => setMode('confirmDelete')}
                  className="w-full py-3 rounded-2xl text-sm font-semibold transition-all"
                  style={{
                    background: 'var(--color-surface-2)',
                    color: '#e05555',
                    fontFamily: 'var(--font-display)',
                    border: '1px solid rgba(220,80,80,0.2)'
                  }}>
                  🗑️ Elimina avversario
                </button>
              )}
            </div>
          </>}

          {/* ── MODO MODIFICA ── */}
          {mode === 'edit' && editForm && (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider"
                 style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-display)' }}>
                Modifica avversario
              </p>

              <EditInput label="Nome *" value={editForm.name} onChange={v => setField('name', v)} placeholder="Es. Marco Rossi" />

              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Mano</label>
                <div className="flex gap-2">
                  {HANDS.map(h => {
                    const active = editForm.hand === h.id
                    return (
                      <button key={h.id}
                        onClick={() => setField('hand', active ? null : h.id)}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                        style={{
                          background: active ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                          color:      active ? 'var(--color-white)' : 'var(--color-slate)',
                          fontFamily: 'var(--font-display)'
                        }}>
                        {h.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <EditInput label="Livello / classifica" value={editForm.level} onChange={v => setField('level', v)} placeholder="Es. 4.3, 3ª categoria..." />
              <EditInput label="Stile di gioco" value={editForm.playstyle} onChange={v => setField('playstyle', v)} placeholder="Es. Aggressivo da fondo..." />

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setMode('view'); setEditForm(null) }}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
                  Annulla
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!canSave || saving}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
                  style={{
                    background: (!canSave || saving) ? 'var(--color-surface-2)' : 'var(--color-amber)',
                    color:      (!canSave || saving) ? 'var(--color-slate)'     : 'var(--color-bg)',
                    fontFamily: 'var(--font-display)'
                  }}>
                  {saving ? 'Salvo...' : 'Salva modifiche'}
                </button>
              </div>
            </div>
          )}

          {/* ── CONFERMA ELIMINAZIONE ── */}
          {mode === 'confirmDelete' && (
            <div className="pt-2">
              <ConfirmBox
                message="Eliminare questo avversario? L'azione non può essere annullata."
                confirmLabel="Elimina"
                confirmColor="#e05555"
                onCancel={() => setMode('view')}
                onConfirm={() => { onDelete(opponent.id); onClose() }}
              />
            </div>
          )}

          {/* ── AGGIUNGI NOTA ── */}
          {mode === 'addNote' && (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider"
                 style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-display)' }}>
                Nuova nota
              </p>
              <NoteTextArea value={noteDraft} onChange={setNoteDraft} />
              <div className="flex gap-3 pt-2">
                <button
                  onClick={cancelNote}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
                  Annulla
                </button>
                <button
                  onClick={handleSaveNewNote}
                  disabled={!canSaveNote || saving}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
                  style={{
                    background: (!canSaveNote || saving) ? 'var(--color-surface-2)' : 'var(--color-amber)',
                    color:      (!canSaveNote || saving) ? 'var(--color-slate)'     : 'var(--color-bg)',
                    fontFamily: 'var(--font-display)'
                  }}>
                  {saving ? 'Salvo...' : 'Salva nota'}
                </button>
              </div>
            </div>
          )}

          {/* ── MODIFICA NOTA ── */}
          {mode === 'editNote' && noteTarget && (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider"
                 style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-display)' }}>
                Modifica nota
              </p>
              <NoteTextArea value={noteDraft} onChange={setNoteDraft} />
              <div className="flex gap-3 pt-2">
                <button
                  onClick={cancelNote}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
                  Annulla
                </button>
                <button
                  onClick={handleSaveEditNote}
                  disabled={!canSaveNote || saving}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
                  style={{
                    background: (!canSaveNote || saving) ? 'var(--color-surface-2)' : 'var(--color-amber)',
                    color:      (!canSaveNote || saving) ? 'var(--color-slate)'     : 'var(--color-bg)',
                    fontFamily: 'var(--font-display)'
                  }}>
                  {saving ? 'Salvo...' : 'Salva modifiche'}
                </button>
              </div>
              <button
                onClick={() => setMode('confirmDeleteNote')}
                className="w-full py-2.5 rounded-2xl text-xs font-semibold transition-all"
                style={{
                  background: 'var(--color-surface-2)',
                  color: '#e05555',
                  fontFamily: 'var(--font-display)',
                  border: '1px solid rgba(220,80,80,0.2)'
                }}>
                🗑️ Elimina nota
              </button>
            </div>
          )}

          {/* ── CONFERMA ELIMINAZIONE NOTA ── */}
          {mode === 'confirmDeleteNote' && noteTarget && (
            <div className="pt-2">
              <ConfirmBox
                message="Eliminare questa nota? L'azione non può essere annullata."
                confirmLabel="Elimina"
                confirmColor="#e05555"
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

function StatTile({ label, value, color }) {
  return (
    <div className="rounded-2xl px-2 py-3 text-center" style={{ background: 'var(--color-surface-2)' }}>
      <p className="text-2xl font-bold" style={{ color, fontFamily: 'var(--font-display)' }}>{value}</p>
      <p className="text-[11px] mt-0.5 uppercase tracking-wider" style={{ color: 'var(--color-slate)' }}>{label}</p>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-wider mb-2"
         style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
        {title}
      </p>
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center px-4 py-3"
         style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span className="text-xs" style={{ color: 'var(--color-slate)' }}>{label}</span>
      <span className="text-xs font-medium text-right"
            style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
        {value}
      </span>
    </div>
  )
}

// Note tattiche come blocchi indipendenti (non un unico testo libero): ognuna
// si aggiunge/modifica/elimina singolarmente, con un limite di caratteri per
// restare appunti rapidi da consultare a bordo campo, non un diario.
function NotesSection({ notes, onAdd, onEditNote }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider"
           style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          Note tattiche
        </p>
        <button
          onClick={onAdd}
          className="text-xs font-semibold"
          style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-display)' }}>
          + Aggiungi
        </button>
      </div>
      {notes.length === 0 ? (
        <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--color-surface-2)' }}>
          <p className="text-sm" style={{ color: 'var(--color-slate)' }}>
            Nessuna nota. Aggiungi appunti su come affrontarlo.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map(n => (
            <NoteBlock key={n.createdAt} note={n} onEdit={() => onEditNote(n)} />
          ))}
        </div>
      )}
    </div>
  )
}

function NoteBlock({ note, onEdit }) {
  return (
    <div className="rounded-2xl px-4 py-3 flex items-start justify-between gap-3"
         style={{ background: 'var(--color-surface-2)' }}>
      <p className="text-sm flex-1 whitespace-pre-wrap"
         style={{ color: 'var(--color-white)', fontFamily: 'var(--font-body)' }}>
        {note.text}
      </p>
      <button
        onClick={onEdit}
        aria-label="Modifica nota"
        className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0"
        style={{ background: 'rgba(118,195,194,0.15)', color: 'var(--color-teal)' }}>
        ✏️
      </button>
    </div>
  )
}

function NoteTextArea({ value, onChange }) {
  return (
    <div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        maxLength={MAX_NOTE_LENGTH}
        rows={3}
        placeholder="Punti forti, punti deboli, come batterlo..."
        className="w-full p-3 rounded-xl text-sm outline-none resize-none"
        style={{
          background: 'var(--color-surface-2)',
          color: 'var(--color-white)',
          border: '1px solid var(--color-teal-dark)',
          fontFamily: 'var(--font-body)'
        }}
      />
      <p className="text-[11px] mt-1 text-right" style={{ color: 'var(--color-slate)' }}>
        {value.length}/{MAX_NOTE_LENGTH}
      </p>
    </div>
  )
}

// Storico scontri: solo le ultime 3 partite, giusto per un colpo d'occhio
// sull'andamento recente — lo storico completo è già consultabile dal tab
// Partite filtrando per questo avversario, niente bisogno di duplicarlo qui.
const MATCH_HISTORY_LIMIT = 3

function MatchHistorySection({ matches, onSelectMatch }) {
  const recent = matches.slice(0, MATCH_HISTORY_LIMIT)

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-wider mb-2"
         style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
        Ultimi scontri
      </p>
      {recent.length === 0 ? (
        <div className="rounded-2xl px-4 py-4 text-center" style={{ background: 'var(--color-surface-2)' }}>
          <p className="text-xs" style={{ color: 'var(--color-slate)' }}>
            Nessuna partita registrata contro questo avversario.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {recent.map(m => (
            <MatchRow key={m.id} match={m} onClick={() => onSelectMatch?.(m.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function EditInput({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div>
      <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full p-3 rounded-xl text-sm outline-none"
        style={{
          background: 'var(--color-surface-2)',
          color: 'var(--color-white)',
          border: '1px solid var(--color-teal-dark)',
          fontFamily: 'var(--font-body)'
        }}
      />
    </div>
  )
}

function ConfirmBox({ message, confirmLabel, confirmColor, onCancel, onConfirm }) {
  return (
    <div className="p-4 rounded-2xl"
         style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-surface-2)' }}>
      <p className="text-sm mb-3 text-center"
         style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
        {message}
      </p>
      <div className="flex gap-3">
        <button onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
          Annulla
        </button>
        <button onClick={onConfirm}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: confirmColor, color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}

// ── Helpers condivisi con OpponentCard (duplicati localmente per convenzione) ──

function getInitials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const AVATAR_ACCENTS = [
  { bg: 'rgba(72,179,176,0.18)', fg: 'var(--color-teal-light)'  },
  { bg: 'rgba(244,163,0,0.18)',  fg: 'var(--color-amber-light)' },
  { bg: 'rgba(161,214,219,0.15)', fg: 'var(--color-teal-light)'  },
  { bg: 'rgba(201,122,45,0.22)', fg: 'var(--color-amber-light)' },
]

function avatarAccent(name) {
  const str = name || ''
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0
  return AVATAR_ACCENTS[Math.abs(hash) % AVATAR_ACCENTS.length]
}

const handLabel = h => ({ destro: 'Destro', sinistro: 'Mancino' }[h] || null)
