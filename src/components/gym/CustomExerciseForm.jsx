import { useState } from 'react'
import {
  MUSCLES, MUSCLE_REGIONS, EXERCISE_MODES, EQUIPMENT_TYPES,
  customExerciseIssues, normalizeCustomExercise,
} from '../../lib/gym'

// Crea o modifica un esercizio personalizzato: nome, modalità di registrazione,
// attrezzo e i muscoli coinvolti. Il database fisso non si tocca: questi
// esercizi vivono in `gymExercises` e si aggiungono a quelli fissi.
//
// I muscoli si scelgono con un solo gesto ripetuto: ogni tocco su una voce fa
// girare nessuno → principale → secondario → nessuno. Due liste di chip
// separate avrebbero costretto a ripassare la stessa lista due volte.
export default function CustomExerciseForm({ initial = null, custom = [], onSave, onDelete, onCancel }) {
  const [name, setName] = useState(initial?.name || '')
  const [mode, setMode] = useState(initial?.mode || 'reps-kg')
  const [equipment, setEquipment] = useState(initial?.equipment || 'altro')
  const [roles, setRoles] = useState(() => {
    const r = {}
    ;(initial?.primary || []).forEach(m => { r[m] = 'primary' })
    ;(initial?.secondary || []).forEach(m => { r[m] = 'secondary' })
    return r
  })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const primary = MUSCLES.filter(m => roles[m.id] === 'primary').map(m => m.id)
  const secondary = MUSCLES.filter(m => roles[m.id] === 'secondary').map(m => m.id)
  const issues = customExerciseIssues({ name, primary }, custom, initial?.docId)
  const canSave = issues.length === 0

  const cycle = (id) => setRoles(r => {
    const next = { ...r }
    if (!r[id]) next[id] = 'primary'
    else if (r[id] === 'primary') next[id] = 'secondary'
    else delete next[id]
    return next
  })

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    await onSave(normalizeCustomExercise({ name, mode, equipment, primary, secondary }))
    setSaving(false)
  }

  if (confirmDelete) {
    return (
      <div className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-surface-2)' }}>
        <p className="text-sm mb-1 text-center" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          Eliminare «{initial.name}»?
        </p>
        <p className="text-xs mb-3 text-center" style={{ color: 'var(--color-slate)' }}>
          Le schede e le sessioni che lo usano restano leggibili: conservano nome e muscoli.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
            Annulla
          </button>
          <button onClick={async () => { await onDelete(initial.docId) }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--color-loss)', color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            Elimina
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-display)' }}>
        {initial ? 'Modifica esercizio' : 'Nuovo esercizio personalizzato'}
      </p>

      <div>
        <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Nome</label>
        <input type="text" value={name} maxLength={60} autoFocus={!initial}
               onChange={e => setName(e.target.value)}
               placeholder="Es. Rematore Pendlay"
               className="w-full p-3 rounded-xl text-sm outline-none"
               style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', border: '1px solid var(--color-teal-dark)', fontFamily: 'var(--font-body)' }} />
      </div>

      <div>
        <p className="text-xs mb-1.5" style={{ color: 'var(--color-slate)' }}>Cosa registri per ogni serie</p>
        <div className="flex flex-col gap-1.5">
          {EXERCISE_MODES.map(m => (
            <Choice key={m.id} active={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</Choice>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs mb-1.5" style={{ color: 'var(--color-slate)' }}>Attrezzo</p>
        <div className="flex flex-wrap gap-1.5">
          {EQUIPMENT_TYPES.map(e => (
            <Choice key={e} compact active={equipment === e} onClick={() => setEquipment(e)}>{e}</Choice>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs mb-0.5" style={{ color: 'var(--color-slate)' }}>Muscoli coinvolti</p>
        <p className="text-[11px] mb-2" style={{ color: 'var(--color-slate)' }}>
          Tocca una voce: principale → secondario → nessuno.
        </p>
        <div className="space-y-2.5">
          {MUSCLE_REGIONS.map(region => (
            <div key={region.id}>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-slate)' }}>{region.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {MUSCLES.filter(m => m.region === region.id).map(m => {
                  const role = roles[m.id]
                  return (
                    <button key={m.id} onClick={() => cycle(m.id)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                      style={{
                        background: role === 'primary' ? 'var(--color-muscle-high)' : role === 'secondary' ? 'var(--color-muscle-low)' : 'var(--color-surface-2)',
                        color: role === 'primary' ? 'var(--color-white)' : role === 'secondary' ? 'var(--color-bg)' : 'var(--color-slate)',
                        fontFamily: 'var(--font-display)',
                      }}>
                      {m.label}{role === 'primary' ? ' ●' : role === 'secondary' ? ' ○' : ''}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {issues.map(msg => (
        <p key={msg} className="text-xs" style={{ color: 'var(--color-loss)' }}>⚠ {msg}</p>
      ))}

      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-3 rounded-2xl text-sm font-semibold"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
          Annulla
        </button>
        <button onClick={handleSave} disabled={!canSave || saving}
          className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
          style={{
            background: (!canSave || saving) ? 'var(--color-surface-2)' : 'var(--color-amber)',
            color:      (!canSave || saving) ? 'var(--color-slate)'     : 'var(--color-bg)',
            fontFamily: 'var(--font-display)'
          }}>
          {saving ? 'Salvo...' : initial ? 'Salva' : 'Crea e aggiungi'}
        </button>
      </div>

      {initial && (
        <button onClick={() => setConfirmDelete(true)}
          className="w-full py-2.5 rounded-2xl text-xs font-semibold"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-loss)', fontFamily: 'var(--font-display)', border: '1px solid var(--color-loss-bg)' }}>
          🗑️ Elimina esercizio
        </button>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

function Choice({ active, compact = false, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`${compact ? 'px-3 py-1.5 rounded-full text-xs capitalize' : 'w-full text-left p-3 rounded-xl text-sm'} font-medium transition-all`}
      style={{
        background: active ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
        color: active ? 'var(--color-white)' : 'var(--color-slate)',
        fontFamily: 'var(--font-display)',
      }}>
      {children}
    </button>
  )
}
