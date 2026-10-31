import { useState } from 'react'
import { cleanGroupName, groupNameIssue } from '../../lib/opponents'

// Crea o rinomina un gruppo. Un nome vuoto o già usato (senza distinguere le
// maiuscole) mostra l'avviso e blocca il salvataggio: niente nomi d'ufficio.
export default function GroupFormModal({ group = null, groups, onClose, onSave }) {
  const [name, setName]     = useState(group?.name || '')
  const [saving, setSaving] = useState(false)

  const issue   = groupNameIssue(name, groups, group?.id)
  const touched = name.length > 0
  const canSave = !issue

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    await onSave(cleanGroupName(name))
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
           style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4"
             style={{ borderBottom: '1px solid var(--color-surface-2)' }}>
          <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-white)' }}>
            {group ? 'Rinomina gruppo' : 'Nuovo gruppo'}
          </h2>
          <button onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-lg"
                  style={{ color: 'var(--color-slate)', background: 'var(--color-surface-2)' }}>
            ✕
          </button>
        </div>

        <div className="px-6 py-4">
          <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Nome del gruppo *</label>
          <input
            autoFocus
            value={name}
            maxLength={40}
            placeholder="Es. Circolo, Sabato mattina"
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            className="w-full p-3 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--color-surface-2)',
              color: 'var(--color-white)',
              border: `1px solid ${touched && issue ? 'rgba(220,80,80,0.5)' : 'transparent'}`,
              fontFamily: 'var(--font-body)'
            }}
          />
          {touched && issue && (
            <p className="text-xs mt-1" style={{ color: '#ff7070' }}>{issue}</p>
          )}
          {!group && (
            <p className="text-xs mt-3" style={{ color: 'var(--color-slate)' }}>
              I membri si aggiungono dopo, aprendo il gruppo.
            </p>
          )}
        </div>

        <div className="px-6 py-4" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-95"
            style={{
              background: (!canSave || saving) ? 'var(--color-surface-2)' : 'var(--color-amber)',
              color:      (!canSave || saving) ? 'var(--color-slate)'     : 'var(--color-bg)',
              fontFamily: 'var(--font-display)'
            }}>
            {saving ? 'Salvataggio...' : group ? 'Salva nome' : 'Crea gruppo'}
          </button>
        </div>
      </div>
    </div>
  )
}
