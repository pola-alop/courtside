import { useState } from 'react'
import { normalizeItems, workoutIssues, starterItems } from '../../lib/running'
import WorkoutEditor from './WorkoutEditor'

// Modifica (o creazione) di una scheda della libreria, fuori da una sessione.
// Eliminare una scheda è sicuro: ogni corsa registrata ne porta una copia
// della struttura e il nome, quindi resta leggibile anche dopo.
export default function WorkoutEditModal({ workout = null, runsCount = 0, running, onClose, onSave, onDelete }) {
  const [name, setName]     = useState(workout?.name || '')
  const [items, setItems]   = useState(() => (workout?.items ? structuredClone(workout.items) : starterItems()))
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const issues = workoutIssues(items, running)
  const canSave = name.trim().length > 0 && issues.length === 0

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    await onSave({ name: name.trim(), items: normalizeItems(items) })
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

        <div className="px-6 pt-6 pb-4 shrink-0" style={{ borderBottom: '1px solid var(--color-surface-2)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-white)' }}>
              {workout ? 'Modifica scheda' : 'Nuova scheda'}
            </h2>
            <button onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-lg"
                    style={{ color: 'var(--color-slate)', background: 'var(--color-surface-2)' }}>
              ✕
            </button>
          </div>
          <input
            type="text"
            value={name}
            maxLength={60}
            onChange={e => setName(e.target.value)}
            placeholder="Nome della scheda"
            className="w-full p-3 rounded-xl text-sm outline-none"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', border: '1px solid var(--color-teal-dark)', fontFamily: 'var(--font-body)' }}
          />
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {confirmDelete ? (
            <div className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-surface-2)' }}>
              <p className="text-sm mb-1 text-center" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                Eliminare la scheda «{workout?.name}»?
              </p>
              <p className="text-xs mb-3 text-center" style={{ color: 'var(--color-slate)' }}>
                {runsCount > 0
                  ? `${runsCount === 1 ? 'La corsa registrata' : `Le ${runsCount} corse registrate`} con questa scheda restano, con la loro struttura.`
                  : 'Non è collegata a nessuna corsa.'}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
                  Annulla
                </button>
                <button onClick={async () => { await onDelete(workout.id); onClose() }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--color-loss)', color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                  Elimina
                </button>
              </div>
            </div>
          ) : (
            <>
              <WorkoutEditor items={items} running={running} onChange={setItems} />
              {workout && (
                <button onClick={() => setConfirmDelete(true)}
                  className="w-full py-3 rounded-2xl text-sm font-semibold transition-all"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-loss)', fontFamily: 'var(--font-display)', border: '1px solid var(--color-loss-bg)' }}>
                  🗑️ Elimina scheda
                </button>
              )}
            </>
          )}
        </div>

        {!confirmDelete && (
          <div className="px-6 py-4 shrink-0" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
            {issues.length > 0 && (
              <p className="text-[11px] mb-2 text-center" style={{ color: 'var(--color-loss)' }}>⚠ {issues[0]}</p>
            )}
            <button onClick={handleSave} disabled={!canSave || saving}
              className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-95"
              style={{
                background: (!canSave || saving) ? 'var(--color-surface-2)' : 'var(--color-amber)',
                color:      (!canSave || saving) ? 'var(--color-slate)'     : 'var(--color-bg)',
                fontFamily: 'var(--font-display)'
              }}>
              {saving ? 'Salvataggio...' : 'Salva scheda'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
