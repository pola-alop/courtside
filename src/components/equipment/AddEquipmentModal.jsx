import { useState } from 'react'
import catalog from '../../data/catalog.json'

const TYPES = [
  { id: 'racchetta', label: 'Racchetta', icon: '🎾' },
  { id: 'scarpa',    label: 'Scarpe',    icon: '👟' },
  { id: 'outfit',    label: 'Outfit',    icon: '👕' },
  { id: 'borsone',   label: 'Borsone',   icon: '🎒' },
]

const SURFACES = ['terra', 'cemento', 'erba', 'indoor']

const RACKETS = catalog.racchette.flatMap(({ racket }) =>
  racket.flatMap(({ type, models }) => models.map(m => ({ ...m, type })))
).map((m, i) => ({ ...m, catalogKey: `${m.id}-${i}` }))

const SHOES = catalog.scarpe.flatMap(({ shoes }) =>
  shoes.flatMap(({ type, models }) => models.map(m => ({ ...m, type })))
).map((m, i) => ({ ...m, catalogKey: `${m.id}-${i}` }))

export default function AddEquipmentModal({ onClose, onSave, initialType = null }) {
  const [step, setStep]     = useState(initialType ? 'form' : 'type')
  const [type, setType]     = useState(initialType)
  const [source, setSource] = useState('catalog')
  const [form, setForm]     = useState({})
  const [saving, setSaving] = useState(false)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    await onSave({ type, source, ...form })
    setSaving(false)
    onClose()
  }

  const handleTypeSelect = (t) => {
    setType(t)
    setStep('form')
  }

  const handleBack = () => {
    if (initialType) { onClose() }
    else { setStep('type'); setForm({}) }
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
          <div className="flex items-center gap-3">
            {step === 'form' && (
              <button onClick={handleBack} className="text-sm font-medium"
                      style={{ color: 'var(--color-teal)' }}>
                ← Indietro
              </button>
            )}
            <h2 className="text-lg font-bold"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--color-white)' }}>
              {step === 'type'
                ? 'Aggiungi attrezzatura'
                : `Aggiungi ${TYPES.find(t => t.id === type)?.label}`}
            </h2>
          </div>
          <button onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-lg"
                  style={{ color: 'var(--color-slate)', background: 'var(--color-surface-2)' }}>
            ✕
          </button>
        </div>

        {/* Corpo scrollabile */}
        <div className="overflow-y-auto flex-1 px-6 py-4">

          {/* Step 1 — scelta tipo */}
          {step === 'type' && (
            <div className="grid grid-cols-2 gap-3">
              {TYPES.map(t => (
                <button key={t.id} onClick={() => handleTypeSelect(t.id)}
                  className="flex flex-col items-center gap-2 p-5 rounded-2xl transition-all active:scale-95"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-surface-2)' }}>
                  <span className="text-3xl">{t.icon}</span>
                  <span className="text-sm font-semibold"
                        style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Step 2 — form */}
          {step === 'form' && (
            <div className="space-y-4">

              {/* RACCHETTA */}
              {type === 'racchetta' && <>
                <SourceToggle value={source} onChange={setSource} />
                {source === 'catalog' ? (
                  <select
                    value={form.catalogKey || ''}
                    onChange={e => {
                      const r = RACKETS.find(r => r.catalogKey === e.target.value)
                      if (r) setForm(f => ({
                        ...f,
                        brand: r.brand, model: r.model, weight: r.weight,
                        balance: r.balance, headSize: r.headSize, pattern: r.pattern,
                        flexibility: r.flexibility, imageUrl: r.imageUrl,
                        catalogId: r.id, catalogKey: r.catalogKey
                      }))
                    }}
                    className="w-full p-3 rounded-xl text-sm"
                    style={{
                      background: 'var(--color-surface-2)',
                      color: form.catalogKey ? 'var(--color-white)' : 'var(--color-slate)',
                      border: '1px solid var(--color-surface-2)'
                    }}>
                    <option value="">Seleziona racchetta...</option>
                    {RACKETS.map(r => (
                      <option key={r.catalogKey} value={r.catalogKey}>{r.brand} {r.model}</option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-3">
                    <Input label="Marca" value={form.brand || ''} onChange={v => set('brand', v)} />
                    <Input label="Modello" value={form.model || ''} onChange={v => set('model', v)} />
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Peso (g)" type="number" value={form.weight || ''} onChange={v => set('weight', Number(v))} />
                      <Input label="Testa (sq in)" type="number" value={form.headSize || ''} onChange={v => set('headSize', Number(v))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Bilanciamento" value={form.balance || ''} onChange={v => set('balance', v)} />
                      <Input label="Pattern" value={form.pattern || ''} onChange={v => set('pattern', v)} placeholder="16x19" />
                    </div>
                  </div>
                )}

                {/* Nickname — appare sempre per racchette */}
                <div className="pt-1">
                  <p className="text-xs font-semibold mb-3 uppercase tracking-wider"
                     style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-display)' }}>
                    Identificazione
                  </p>
                  <Input
                    label="Nickname (opzionale)"
                    value={form.nickname || ''}
                    onChange={v => set('nickname', v)}
                    placeholder="Es. Principale, Torneo, Allenamento..."
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--color-slate)' }}>
                    Utile se hai più racchette dello stesso modello
                  </p>
                </div>

                {/* Corde */}
                <div className="pt-1">
                  <p className="text-xs font-semibold mb-3 uppercase tracking-wider"
                     style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
                    Corde montate
                  </p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Marca corda" value={form.stringBrand || ''} onChange={v => set('stringBrand', v)} />
                      <Input label="Modello corda" value={form.stringModel || ''} onChange={v => set('stringModel', v)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Tensione verticali (kg)"   type="number" value={form.stringTensionMains   || ''} onChange={v => set('stringTensionMains', Number(v))} />
                      <Input label="Tensione orizzontali (kg)" type="number" value={form.stringTensionCrosses || ''} onChange={v => set('stringTensionCrosses', Number(v))} />
                    </div>
                    <Input label="Data montaggio" type="date" value={form.stringDate || ''} onChange={v => set('stringDate', v)} />
                  </div>
                </div>
              </>}

              {/* SCARPA */}
              {type === 'scarpa' && <>
                <SourceToggle value={source} onChange={setSource} />
                {source === 'catalog' ? (
                  <select
                    value={form.catalogKey || ''}
                    onChange={e => {
                      const s = SHOES.find(s => s.catalogKey === e.target.value)
                      if (s) setForm(f => ({
                        ...f,
                        brand: s.brand, model: s.model,
                        surface: s.surface, imageUrl: s.imageUrl,
                        catalogId: s.id, catalogKey: s.catalogKey
                      }))
                    }}
                    className="w-full p-3 rounded-xl text-sm"
                    style={{
                      background: 'var(--color-surface-2)',
                      color: form.catalogKey ? 'var(--color-white)' : 'var(--color-slate)',
                      border: '1px solid var(--color-surface-2)'
                    }}>
                    <option value="">Seleziona scarpa...</option>
                    {SHOES.map(s => (
                      <option key={s.catalogKey} value={s.catalogKey}>{s.brand} {s.model}</option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-3">
                    <Input label="Marca" value={form.brand || ''} onChange={v => set('brand', v)} />
                    <Input label="Modello" value={form.model || ''} onChange={v => set('model', v)} />
                    <div>
                      <p className="text-xs mb-2" style={{ color: 'var(--color-slate)' }}>Superficie</p>
                      <div className="flex flex-wrap gap-2">
                        {SURFACES.map(s => (
                          <button key={s}
                            onClick={() => {
                              const curr = form.surface || []
                              set('surface', curr.includes(s) ? curr.filter(x => x !== s) : [...curr, s])
                            }}
                            className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                            style={{
                              background: (form.surface || []).includes(s) ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                              color: 'var(--color-white)'
                            }}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Nickname scarpa */}
                <div className="pt-1">
                  <p className="text-xs font-semibold mb-3 uppercase tracking-wider"
                     style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-display)' }}>
                    Identificazione
                  </p>
                  <Input
                    label="Nickname (opzionale)"
                    value={form.nickname || ''}
                    onChange={v => set('nickname', v)}
                    placeholder="Es. Terra, Cemento, Gara..."
                  />
                </div>
              </>}

              {/* OUTFIT */}
              {type === 'outfit' && (
                <div className="space-y-3">
                  <Input label="Nome outfit" value={form.name || ''} onChange={v => set('name', v)} placeholder="Es. Setup Torneo" />
                  <Input label="Maglietta" value={form.maglietta || ''} onChange={v => set('maglietta', v)} />
                  <Input label="Pantaloncini" value={form.pantaloncini || ''} onChange={v => set('pantaloncini', v)} />
                  <Input label="Calzini" value={form.calzini || ''} onChange={v => set('calzini', v)} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Polsini" value={form.polsini || ''} onChange={v => set('polsini', v)} />
                    <Input label="Fascia / Cappellino" value={form.fascia || ''} onChange={v => set('fascia', v)} />
                  </div>
                </div>
              )}

              {/* BORSONE */}
              {type === 'borsone' && (
                <div className="space-y-3">
                  <Input label="Marca" value={form.brand || ''} onChange={v => set('brand', v)} />
                  <Input label="Modello" value={form.model || ''} onChange={v => set('model', v)} />
                  <Input label="Note" value={form.notes || ''} onChange={v => set('notes', v)} placeholder="Capienza, colore..." />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer fisso con bottone salva */}
        {step === 'form' && (
          <div className="px-6 py-4 shrink-0"
               style={{ borderTop: '1px solid var(--color-surface-2)' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-95"
              style={{
                background: saving ? 'var(--color-surface-2)' : 'var(--color-amber)',
                color: saving ? 'var(--color-slate)' : 'var(--color-bg)',
                fontFamily: 'var(--font-display)'
              }}>
              {saving ? 'Salvataggio...' : 'Salva attrezzatura'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function SourceToggle({ value, onChange }) {
  return (
    <div className="flex rounded-xl overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
      {['catalog', 'custom'].map(s => (
        <button key={s} onClick={() => onChange(s)}
          className="flex-1 py-2 text-sm font-medium transition-all"
          style={{
            background: value === s ? 'var(--color-teal-dark)' : 'transparent',
            color: value === s ? 'var(--color-white)' : 'var(--color-slate)',
            fontFamily: 'var(--font-display)'
          }}>
          {s === 'catalog' ? '📋 Catalogo' : '✏️ Custom'}
        </button>
      ))}
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