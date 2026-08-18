import { useState } from 'react'
import { LEVELS, PLAYSTYLES } from '../../lib/opponents'

const HANDS = [
  { id: 'destro',   label: 'Destro'  },
  { id: 'sinistro', label: 'Mancino' },
]

export default function AddOpponentModal({ onClose, onSave }) {
  const [form, setForm]     = useState({ name: '', hand: null, level: '', playstyle: '' })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const canSave = form.name.trim().length > 0

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    await onSave({
      name:      form.name.trim(),
      hand:      form.hand || null,
      level:     form.level     || null,
      playstyle: form.playstyle || null,
      notes:     [],
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
      <div
        className="w-full max-w-lg rounded-3xl flex flex-col"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-surface-2)',
          maxHeight: '85vh',
        }}
      >
        {/* Header fisso */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0"
             style={{ borderBottom: '1px solid var(--color-surface-2)' }}>
          <h2 className="text-lg font-bold"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-white)' }}>
            Nuovo avversario
          </h2>
          <button onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-lg"
                  style={{ color: 'var(--color-slate)', background: 'var(--color-surface-2)' }}>
            ✕
          </button>
        </div>

        {/* Corpo scrollabile */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          <Input
            label="Nome *"
            value={form.name}
            onChange={v => set('name', v)}
            placeholder="Es. Marco Rossi"
          />

          <HandSelector value={form.hand} onChange={v => set('hand', v)} />

          <Select
            label="Livello / classifica"
            value={form.level}
            onChange={v => set('level', v)}
            options={LEVELS}
            placeholder="Seleziona un livello..."
          />

          <Select
            label="Stile di gioco"
            value={form.playstyle}
            onChange={v => set('playstyle', v)}
            options={PLAYSTYLES}
            placeholder="Seleziona uno stile..."
          />

          <p className="text-xs" style={{ color: 'var(--color-slate)' }}>
            Le note tattiche si aggiungono dopo, dal dettaglio dell'avversario.
          </p>
        </div>

        {/* Footer fisso */}
        <div className="px-6 py-4 shrink-0" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-95"
            style={{
              background: (!canSave || saving) ? 'var(--color-surface-2)' : 'var(--color-amber)',
              color:      (!canSave || saving) ? 'var(--color-slate)'     : 'var(--color-bg)',
              fontFamily: 'var(--font-display)'
            }}>
            {saving ? 'Salvataggio...' : 'Salva avversario'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

function HandSelector({ value, onChange }) {
  return (
    <div>
      <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Mano</label>
      <div className="flex gap-2">
        {HANDS.map(h => {
          const active = value === h.id
          return (
            <button key={h.id}
              onClick={() => onChange(active ? null : h.id)}
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
  )
}

function Select({ label, value, onChange, options, placeholder }) {
  return (
    <div>
      <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full p-3 rounded-xl text-sm outline-none"
        style={{
          background: 'var(--color-surface-2)',
          color: value ? 'var(--color-white)' : 'var(--color-slate)',
          border: '1px solid transparent',
          fontFamily: 'var(--font-body)'
        }}>
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', placeholder = '' }) {
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
          border: '1px solid transparent',
          fontFamily: 'var(--font-body)'
        }}
      />
    </div>
  )
}

