import { useState } from 'react'
import { opponentInitials } from '../../lib/opponents'
import { readGender, doublesCategory, doublesCategoryLabel } from '../../lib/gender'

// Scelta dei tre giocatori di un doppio, condivisa dal wizard partita e da
// PlanModal: tre slot (compagno, due avversari) sopra un'unica lista con
// ricerca. Un tap sulla lista riempie lo slot attivo e passa al primo vuoto;
// un giocatore già scelto resta in lista con il suo ruolo e non si può riusare.
// Gli slot si svuotano con la ✕. Il componente non valida: chi lo usa decide se
// gli slot vuoti bloccano il salvataggio (wizard) o no (programma).
//
// `onChange({ partnerId, opponentIds })`, con `opponentIds` sempre di due posti
// (null = vuoto). `userGender` serve solo alla nota sulla categoria.

const SLOTS = [
  { label: 'Compagno'    },
  { label: 'Avversario 1' },
  { label: 'Avversario 2' },
]

const slotIds = (partnerId, opponentIds) => [partnerId || null, opponentIds?.[0] || null, opponentIds?.[1] || null]

export default function DoublesPlayersPicker({ opponents, partnerId, opponentIds, onChange, userGender = null }) {
  const ids = slotIds(partnerId, opponentIds)
  const [active, setActive] = useState(() => Math.max(0, ids.indexOf(null)))
  const [search, setSearch] = useState('')

  const byId = new Map(opponents.map(o => [o.id, o]))
  const query = search.trim().toLowerCase()
  const visible = query ? opponents.filter(o => o.name.toLowerCase().includes(query)) : opponents

  const commit = (next) => onChange({ partnerId: next[0], opponentIds: [next[1], next[2]] })

  const assign = (id) => {
    const next = [...ids]
    next[active] = id
    commit(next)
    const empty = next.indexOf(null)
    if (empty !== -1) setActive(empty)
  }

  const clear = (slot) => {
    const next = [...ids]
    next[slot] = null
    commit(next)
    setActive(slot)
  }

  if (opponents.length === 0) {
    return (
      <div className="rounded-2xl px-4 py-4 text-center" style={{ background: 'var(--color-surface-2)' }}>
        <p className="text-sm" style={{ color: 'var(--color-slate)' }}>
          Nessun giocatore in anagrafica. Aggiungili dalla tab Avversari prima di registrare un doppio.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Slot */}
      <div className="grid grid-cols-3 gap-2">
        {SLOTS.map((slot, i) => {
          const player = byId.get(ids[i])
          const isActive = active === i
          return (
            <div key={slot.label} className="relative min-w-0">
              <button type="button"
                onClick={() => setActive(i)}
                className="w-full h-full text-left rounded-xl px-2.5 py-2 transition-all"
                style={{
                  background: player ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                  border: isActive ? '1px solid var(--color-amber)' : player ? '1px solid var(--color-teal)' : '1px solid transparent',
                }}>
                <span className="block text-[10px] font-semibold"
                      style={{ color: isActive ? 'var(--color-amber-light)' : 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
                  {slot.label}
                </span>
                <span className="block text-xs font-semibold wrap-anywhere pr-4"
                      style={{ color: player ? 'var(--color-white)' : 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
                  {player ? player.name : ids[i] ? '—' : 'Scegli'}
                </span>
              </button>
              {ids[i] && (
                <button type="button" onClick={() => clear(i)} aria-label={`Rimuovi ${slot.label}`}
                        className="absolute top-1 right-1.5 text-[11px] leading-none p-0.5"
                        style={{ color: 'var(--color-teal-light)' }}>
                  ✕
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Ricerca e lista */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Cerca giocatore..."
        className="w-full p-3 rounded-xl text-sm outline-none"
        style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-body)' }}
      />
      {visible.length === 0 ? (
        <p className="text-sm text-center pt-2" style={{ color: 'var(--color-slate)' }}>Nessun giocatore trovato.</p>
      ) : (
        <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '14rem' }}>
          {visible.map(o => {
            const slot = ids.indexOf(o.id)
            const here = slot === active
            const elsewhere = slot !== -1 && !here
            return (
              <button key={o.id} type="button"
                disabled={elsewhere}
                onClick={() => (here ? clear(slot) : assign(o.id))}
                className="w-full text-left rounded-2xl p-3 flex items-center gap-3 transition-all"
                style={{
                  background: here ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                  border: here ? '1px solid var(--color-teal)' : '1px solid transparent',
                  opacity: elsewhere ? 0.5 : 1,
                }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                     style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <span className="text-xs font-bold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                    {opponentInitials(o)}
                  </span>
                </div>
                <p className="text-sm font-semibold wrap-anywhere min-w-0 flex-1" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                  {o.name}
                </p>
                {slot !== -1 && (
                  <span className="text-[10px] font-semibold shrink-0" style={{ color: 'var(--color-teal-light)', fontFamily: 'var(--font-display)' }}>
                    {SLOTS[slot].label}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <CategoryNote players={ids.map(id => byId.get(id) || null)} userGender={userGender} />
    </div>
  )
}

// La categoria si ricava dai generi dei quattro giocatori; a tre slot pieni la
// nota la dà, oppure dice di chi manca il genere. Non blocca mai nulla.
function CategoryNote({ players, userGender }) {
  if (players.some(p => !p)) return null
  const category = doublesCategory([userGender, ...players.map(p => p.gender)])
  if (category) {
    return (
      <p className="text-xs" style={{ color: 'var(--color-teal-light)' }}>
        Doppio {doublesCategoryLabel(category).toLowerCase()}
      </p>
    )
  }
  const missing = players.filter(p => !readGender(p.gender)).map(p => p.name)
  if (!readGender(userGender)) missing.push('il tuo (nel Profilo)')
  return (
    <p className="text-xs wrap-anywhere" style={{ color: 'var(--color-slate)' }}>
      Categoria non ricavabile: manca il genere di {missing.join(', ')}.
    </p>
  )
}
