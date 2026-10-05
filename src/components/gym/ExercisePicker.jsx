import { useState } from 'react'
import { MUSCLES, muscleLabel } from '../../lib/gym'
import CustomExerciseForm from './CustomExerciseForm'

// Scelta di un esercizio dal database (fissi + personalizzati): ricerca per
// nome, filtro per muscolo. In fondo alla lista si crea un esercizio nuovo, e
// gli esercizi personalizzati si modificano dal ✏️ sulla loro riga.
//
// Componente controllato dal chiamante: `onPick(exercise)` per ogni scelta,
// `onCreate/onUpdate/onDelete` per i personalizzati (la persistenza è dei
// chiamanti, come per ogni modale del progetto).
export default function ExercisePicker({ index, custom, onPick, onCreate, onUpdate, onDelete, onClose }) {
  const [query, setQuery]   = useState('')
  const [muscle, setMuscle] = useState('all')
  // list | create | { edit: exercise }
  const [view, setView]     = useState('list')

  const q = query.trim().toLowerCase()
  const all = Object.values(index).sort((a, b) => a.name.localeCompare(b.name, 'it'))
  const shown = all.filter(e => {
    if (muscle !== 'all' && !e.primary.includes(muscle) && !e.secondary.includes(muscle)) return false
    if (!q) return true
    return e.name.toLowerCase().includes(q)
      || e.equipment.toLowerCase().includes(q)
      || e.primary.some(m => muscleLabel(m).toLowerCase().includes(q))
  })

  const handleCreate = async (data) => {
    const exercise = await onCreate(data)
    onPick(exercise)
  }

  const handleUpdate = async (data) => {
    await onUpdate(view.edit.docId, data)
    setView('list')
  }

  const handleDelete = async (docId) => {
    await onDelete(docId)
    setView('list')
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: 'rgba(2,13,25,0.92)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-3xl flex flex-col"
           style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)', maxHeight: '88vh', height: '88vh' }}>

        <div className="px-6 pt-6 pb-4 shrink-0" style={{ borderBottom: '1px solid var(--color-surface-2)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-white)' }}>
              {view === 'list' ? 'Scegli un esercizio' : 'Esercizio personalizzato'}
            </h2>
            <button onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-lg"
                    style={{ color: 'var(--color-slate)', background: 'var(--color-surface-2)' }}>
              ✕
            </button>
          </div>

          {view === 'list' && (
            <div className="space-y-2">
              <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                     placeholder="Cerca per nome, attrezzo o muscolo..."
                     className="w-full p-3 rounded-xl text-sm outline-none"
                     style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-body)' }} />
              <select value={muscle} onChange={e => setMuscle(e.target.value)}
                      className="w-full p-2.5 rounded-xl text-xs outline-none"
                      style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                <option value="all">Tutti i muscoli</option>
                {MUSCLES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          {view === 'list' && (
            <div className="space-y-2">
              <button onClick={() => setView('create')}
                className="w-full py-3 rounded-2xl text-sm font-semibold"
                style={{ color: 'var(--color-teal)', border: '1px dashed var(--color-teal-dark)', fontFamily: 'var(--font-display)' }}>
                ＋ Crea un esercizio personalizzato
              </button>

              {shown.length === 0 && (
                <p className="text-sm text-center py-6" style={{ color: 'var(--color-slate)' }}>
                  Nessun esercizio trovato. Puoi crearlo qui sopra.
                </p>
              )}

              {shown.map(e => (
                <div key={e.id} className="flex items-stretch rounded-xl" style={{ background: 'var(--color-surface-2)' }}>
                  <button onClick={() => onPick(e)} className="flex-1 min-w-0 text-left px-3 py-2.5">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                      {e.name}
                      {e.custom && <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                         style={{ background: 'var(--color-teal-dark)', color: 'var(--color-white)' }}>tuo</span>}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--color-slate)' }}>
                      {e.equipment}
                      {' · '}
                      <span style={{ color: 'var(--color-amber)' }}>{e.primary.map(muscleLabel).join(', ') || '—'}</span>
                      {e.secondary.length > 0 && <> · {e.secondary.map(muscleLabel).join(', ')}</>}
                    </p>
                  </button>
                  {e.custom && (
                    <button onClick={() => setView({ edit: e })} aria-label="Modifica esercizio"
                      className="w-10 shrink-0 flex items-center justify-center text-xs"
                      style={{ color: 'var(--color-teal)' }}>
                      ✏️
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {view === 'create' && (
            <CustomExerciseForm custom={custom} onSave={handleCreate} onCancel={() => setView('list')} />
          )}

          {view?.edit && (
            <CustomExerciseForm initial={view.edit} custom={custom} onSave={handleUpdate}
                                onDelete={handleDelete} onCancel={() => setView('list')} />
          )}
        </div>
      </div>
    </div>
  )
}
