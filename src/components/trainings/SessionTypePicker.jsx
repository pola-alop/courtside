import { Link } from 'react-router-dom'

// Primo tap di "+ Allenamento": che tipo di allenamento? Tennis, corsa e
// palestra sono tutti allenamenti in preparazione delle partite e vivono nella
// stessa lista; cambia solo il wizard che si apre. La palestra non ha
// prerequisiti: il database esercizi è nell'app.
//
// La corsa è bloccata finché le zone di passo del Profilo non sono complete:
// senza, nessuna fase della scheda si traduce in una durata. Invece di
// nasconderla si dice perché è spenta e dove sbloccarla.
export default function SessionTypePicker({ runningReady, profileLoading = false, onPick, onClose }) {
  const options = [
    { id: 'tennis', icon: '🎾', label: 'Tennis', sub: 'Sessione con la racchetta: blocchi, focus, attrezzatura', enabled: true },
    {
      id: 'corsa', icon: '🏃', label: 'Corsa', sub: 'Scheda a fasi e ripetute, in stile Garmin',
      enabled: runningReady,
      blocked: !runningReady && !profileLoading ? 'Prima configura le zone di passo nel Profilo.' : null,
    },
    { id: 'palestra', icon: '🏋️', label: 'Palestra', sub: 'Scheda di esercizi con serie e carichi, e il manichino dei muscoli', enabled: true },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6"
      style={{ background: 'rgba(2,13,25,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-3xl p-5 space-y-3"
           style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-white)' }}>
            Nuovo allenamento
          </h2>
          <button onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-lg"
                  style={{ color: 'var(--color-slate)', background: 'var(--color-surface-2)' }}>
            ✕
          </button>
        </div>

        {options.map(o => (
          <div key={o.id} className="rounded-2xl" style={{ background: 'var(--color-surface-2)' }}>
            <button disabled={!o.enabled} onClick={() => onPick(o.id)}
              className="w-full flex items-center gap-3 p-4 text-left transition-all active:scale-[0.98]"
              style={{ opacity: o.enabled ? 1 : 0.5 }}>
              <span className="text-2xl">{o.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                  {o.label}
                </span>
                <span className="block text-xs" style={{ color: 'var(--color-slate)' }}>{o.sub}</span>
              </span>
              {o.enabled && <span style={{ color: 'var(--color-teal)' }}>›</span>}
            </button>
            {o.blocked && (
              <div className="px-4 pb-3 -mt-1">
                <Link to="/profile" className="text-xs font-semibold" style={{ color: 'var(--color-amber)' }}>
                  🔒 {o.blocked} Vai al Profilo ›
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
