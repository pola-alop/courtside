import { useState } from 'react'
import { groupMembers, opponentInitials } from '../../lib/opponents'

// Selezione multipla dei membri: parte già spuntata sui membri attuali, quindi
// la stessa schermata aggiunge (nuova spunta) e toglie (spunta tolta). Al
// salvataggio consegna solo la differenza, che il hook scrive con
// arrayUnion/arrayRemove.
export default function GroupMembersModal({ group, opponents, onClose, onSave }) {
  const initial = new Set(groupMembers(group, opponents).map(o => o.id))
  const [selected, setSelected] = useState(initial)
  const [query, setQuery]       = useState('')
  const [saving, setSaving]     = useState(false)

  const toggle = id => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const toAdd    = opponents.filter(o => selected.has(o.id) && !initial.has(o.id)).map(o => o.id)
  const toRemove = opponents.filter(o => !selected.has(o.id) && initial.has(o.id)).map(o => o.id)
  const changed  = toAdd.length + toRemove.length > 0

  const q = query.trim().toLowerCase()
  const visible = q ? opponents.filter(o => o.name.toLowerCase().includes(q)) : opponents

  const handleSave = async () => {
    if (!changed || saving) return
    setSaving(true)
    await onSave({ add: toAdd, remove: toRemove })
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
           style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)', maxHeight: '85vh' }}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0"
             style={{ borderBottom: '1px solid var(--color-surface-2)' }}>
          <div className="min-w-0">
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-white)' }}>
              Membri
            </h2>
            <p className="text-xs truncate" style={{ color: 'var(--color-slate)' }}>
              {group.name} · {selected.size} selezionati
            </p>
          </div>
          <button onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-lg shrink-0"
                  style={{ color: 'var(--color-slate)', background: 'var(--color-surface-2)' }}>
            ✕
          </button>
        </div>

        <div className="px-6 pt-4 shrink-0">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cerca avversario..."
            className="w-full p-3 rounded-xl text-sm outline-none"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-body)' }}
          />
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
          {visible.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--color-slate)' }}>Nessun avversario trovato.</p>
          ) : visible.map(o => {
            const on = selected.has(o.id)
            return (
              <button key={o.id} onClick={() => toggle(o.id)}
                className="w-full text-left rounded-2xl p-3 flex items-stretch gap-3 transition-all"
                style={{
                  background: on ? 'rgba(72,179,176,0.12)' : 'var(--color-surface-2)',
                  border: `1px solid ${on ? 'var(--color-teal-dark)' : 'transparent'}`
                }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 self-center"
                     style={{ background: 'var(--color-surface)' }}>
                  <span className="text-xs font-bold" style={{ color: 'var(--color-teal-light)', fontFamily: 'var(--font-display)' }}>
                    {opponentInitials(o)}
                  </span>
                </div>
                <p className="flex-1 min-w-0 text-sm font-semibold truncate self-center"
                   style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                  {o.name}
                </p>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 self-center"
                      style={{
                        background: on ? 'var(--color-teal-dark)' : 'transparent',
                        color: 'var(--color-white)',
                        border: on ? 'none' : '1px solid var(--color-slate)'
                      }}>
                  {on ? '✓' : ''}
                </span>
              </button>
            )
          })}
        </div>

        <div className="px-6 py-4 shrink-0" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
          <button
            onClick={handleSave}
            disabled={!changed || saving}
            className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-95"
            style={{
              background: (!changed || saving) ? 'var(--color-surface-2)' : 'var(--color-amber)',
              color:      (!changed || saving) ? 'var(--color-slate)'     : 'var(--color-bg)',
              fontFamily: 'var(--font-display)'
            }}>
            {saving ? 'Salvataggio...' : 'Salva membri'}
          </button>
        </div>
      </div>
    </div>
  )
}
