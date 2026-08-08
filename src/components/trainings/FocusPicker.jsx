import { useState } from 'react'
import { FOCUS_CATEGORIES, FOCUS_BY_ID, focusLabel } from '../../lib/training'

// Selettore dei colpi/schemi lavorati in una sessione.
//
// Sono ~45 voci: una lista piatta sarebbe inusabile su mobile, quindi
// l'accordion per categoria è chiuso di default e in cima c'è la riga "usati di
// recente" — nella pratica si lavora sempre sugli stessi 5-6 temi, quindi quella
// riga copre la stragrande maggioranza delle selezioni senza aprire nulla.
export default function FocusPicker({ value = [], recent = [], onChange }) {
  const [openCategory, setOpenCategory] = useState(null)

  const toggle = (id) => {
    onChange(value.includes(id) ? value.filter(f => f !== id) : [...value, id])
  }

  // I recenti già selezionati restano nella riga (deselezionabili), ma quelli
  // scelti dall'accordion non ci vengono aggiunti: la riga è uno storico, non
  // un riepilogo della selezione corrente — quello è il blocco qui sotto.
  const recentVisible = recent.filter(id => FOCUS_BY_ID[id])

  return (
    <div className="space-y-4">
      {recentVisible.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2"
             style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-display)' }}>
            Usati di recente
          </p>
          <div className="flex flex-wrap gap-2">
            {recentVisible.map(id => (
              <FocusChip key={id} label={focusLabel(id)} active={value.includes(id)} onClick={() => toggle(id)} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {FOCUS_CATEGORIES.map(cat => {
          const open = openCategory === cat.id
          const selectedHere = cat.items.filter(i => value.includes(i.id)).length
          return (
            <div key={cat.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
              <button
                onClick={() => setOpenCategory(open ? null : cat.id)}
                className="w-full flex items-center gap-2 px-4 py-3 text-left">
                <span className="text-sm">{cat.icon}</span>
                <span className="text-sm font-semibold flex-1"
                      style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                  {cat.label}
                </span>
                {selectedHere > 0 && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--color-teal-dark)', color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                    {selectedHere}
                  </span>
                )}
                <span className="text-xs" style={{ color: 'var(--color-slate)' }}>{open ? '▾' : '▸'}</span>
              </button>

              {open && (
                <div className="px-4 pb-3 flex flex-wrap gap-2">
                  {cat.items.map(item => (
                    <FocusChip key={item.id} label={item.label} active={value.includes(item.id)} onClick={() => toggle(item.id)} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Riepilogo della selezione: con l'accordion chiuso è l'unico punto in cui
          si vede tutto insieme quello che si è scelto */}
      {value.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider"
               style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
              Selezionati ({value.length})
            </p>
            <button onClick={() => onChange([])}
              className="text-xs font-semibold" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
              Svuota
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {value.map(id => (
              <button key={id} onClick={() => toggle(id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{ background: 'var(--color-teal-dark)', color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                {focusLabel(id)}
                <span style={{ opacity: 0.7 }}>✕</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

function FocusChip({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-95"
      style={{
        background: active ? 'var(--color-teal-dark)' : 'var(--color-surface)',
        color:      active ? 'var(--color-white)' : 'var(--color-slate)',
        border:     active ? '1px solid var(--color-teal)' : '1px solid var(--color-surface-2)',
        fontFamily: 'var(--font-display)',
      }}>
      {label}
    </button>
  )
}
