import { surfaceIcon } from '../../lib/tennis'
import {
  blocksSummary, totalMinutes, formatMinutes, focusLabel, intensityMeta,
} from '../../lib/training'

// Quanti chip di focus mostrare prima di collassare in "+N": tre entrano su
// una riga anche a viewport stretto, il resto andrebbe a capo.
const VISIBLE_FOCUS = 3

// Riga compatta della lista allenamenti: data + intensità, tipi di blocco e
// durata, chip dei colpi lavorati, superficie e con chi. Tap → dettaglio.
export default function TrainingRow({ training, onClick }) {
  const intensity = intensityMeta(training.intensity)
  const minutes = totalMinutes(training.blocks)
  const focus = training.focus || []
  const shown = focus.slice(0, VISIBLE_FOCUS)
  const hidden = focus.length - shown.length

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-3 flex flex-col gap-2 transition-all active:scale-[0.98]"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}
    >
      {/* Top — data + intensità */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          {formatShortDate(training.date)}
        </span>
        {intensity && (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'var(--color-surface-2)', color: intensity.color, fontFamily: 'var(--font-display)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: intensity.color }} />
            {intensity.label}
          </span>
        )}
      </div>

      {/* Tipi di blocco + durata totale */}
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold truncate"
           style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {blocksSummary(training.blocks) || 'Allenamento'}
        </p>
        <span className="text-sm font-bold shrink-0"
              style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-mono)' }}>
          {formatMinutes(minutes)}
        </span>
      </div>

      {/* Colpi lavorati */}
      {shown.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {shown.map(id => (
            <span key={id}
              className="px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal-light)', fontFamily: 'var(--font-display)' }}>
              {focusLabel(id)}
            </span>
          ))}
          {hidden > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
              +{hidden}
            </span>
          )}
        </div>
      )}

      {/* Bottom — superficie + con chi */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs">{surfaceIcon(training.surface)}</span>
        <span className="text-xs truncate" style={{ color: 'var(--color-slate)' }}>
          {[cap(training.surface), training.withWhom?.label].filter(Boolean).join(' · ')}
        </span>
        {training.brokeStrings && <span className="text-xs shrink-0" title="Corde rotte">💥</span>}
      </div>
    </button>
  )
}

// ── Helpers ────────────────────────────────────────────────

function formatShortDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
  } catch { return dateStr }
}

const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')
