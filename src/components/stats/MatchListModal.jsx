import MatchRow from '../matches/MatchRow'

// Drill-down: le partite dietro un numero. È ciò che rende verificabile una
// statistica — un 54% che non si può aprire è un numero da credere sulla
// parola, e alla prima sorpresa si smette di fidarsene.
//
// Qui si arriva in sola lettura (tap su una riga → dettaglio partita, con le
// note modificabili): modificare o eliminare una partita resta un'azione
// dell'area Matches, dove c'è il wizard. Portare qui anche quello
// significherebbe duplicare l'orchestrazione dei modali di Matches.jsx per un
// gesto che nessuno compie mentre sta leggendo delle statistiche.
export default function MatchListModal({ title, sub, matches = [], onClose, onSelectMatch }) {
  const sorted = [...matches].sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
         style={{ background: 'rgba(2,13,25,0.9)', backdropFilter: 'blur(6px)' }}
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg rounded-3xl overflow-hidden flex flex-col"
           style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)', maxHeight: '88vh' }}>

        <div className="shrink-0 px-6 pt-6 pb-4 flex items-start justify-between gap-3"
             style={{ borderBottom: '1px solid var(--color-surface-2)' }}>
          <div className="min-w-0">
            <p className="text-base font-semibold truncate"
               style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
              {title}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-slate)' }}>
              {sub || `${sorted.length} ${sorted.length === 1 ? 'partita' : 'partite'}`}
            </p>
          </div>
          <button onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)' }}>
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          {sorted.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--color-slate)' }}>
              Nessuna partita in questo gruppo.
            </p>
          ) : (
            <div className="space-y-2">
              {sorted.map(m => (
                <MatchRow key={m.id} match={m} onClick={() => onSelectMatch?.(m.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
