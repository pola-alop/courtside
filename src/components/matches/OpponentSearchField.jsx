import { useState } from 'react'

// Usato dal wizard allenamento ("Con chi") e dai programmi della Home
// (avversario della partita, compagno dell'allenamento).
//
// Sostituisce le bubble con tutti gli avversari (non scala oltre una manciata
// di nomi) con una ricerca: box chiuso finché non si tocca, poi filtra man
// mano che si scrive, come lo step "Contro chi?" del wizard match.
export default function OpponentSearchField({ opponents, valueId, onSelect, onClear }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const selected = opponents.find(o => o.id === valueId)
  const query = search.trim().toLowerCase()
  const results = query ? opponents.filter(o => o.name.toLowerCase().includes(query)) : opponents

  if (selected) {
    return (
      <div className="w-full p-3 rounded-xl text-sm flex items-center justify-between"
           style={{ background: 'var(--color-teal-dark)', border: '1px solid var(--color-teal)' }}>
        <span style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{selected.name}</span>
        <button onClick={onClear} className="text-xs font-semibold" style={{ color: 'var(--color-teal-light)' }}>
          Rimuovi ✕
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Cerca avversario..."
        className="w-full p-3 rounded-xl text-sm outline-none"
        style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-body)' }}
      />
      {open && (
        <div className="absolute left-0 right-0 mt-1.5 rounded-xl overflow-y-auto z-10"
             style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-teal-dark)', maxHeight: '11rem' }}>
          {results.length === 0 ? (
            <p className="text-xs text-center py-3" style={{ color: 'var(--color-slate)' }}>Nessun avversario trovato.</p>
          ) : (
            results.map(o => (
              <button key={o.id}
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onSelect(o); setSearch(''); setOpen(false) }}
                className="w-full text-left px-3 py-2.5 text-sm transition-all"
                style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                {o.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
