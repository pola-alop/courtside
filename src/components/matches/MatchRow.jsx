import ScoreBoard from './ScoreBoard'
import { RESULT_META, surfaceIcon, MATCH_TYPES, roundMeta } from '../../lib/tennis'

// Riga compatta della lista partite: data + avversario, bollino esito con
// etichetta, punteggio stile tennis, superficie e tipo. Tap → dettaglio.
export default function MatchRow({ match, onClick }) {
  const meta = RESULT_META[match.result] || RESULT_META.draw
  const typeLabel = MATCH_TYPES.find(t => t.id === match.type)?.label || match.type
  const eventSuffix = match.eventName ? ` · ${match.eventName}` : ''
  const round = roundMeta(match.round)

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-3 flex flex-col gap-2 transition-all active:scale-[0.98]"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}
    >
      {/* Top — data + esito */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          {formatShortDate(match.date)}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: meta.bg, color: meta.color, fontFamily: 'var(--font-display)' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
          {meta.label}
        </span>
      </div>

      {/* Punteggio stile tennis */}
      <ScoreBoard
        sets={match.sets}
        format={match.format}
        retired={match.retired}
        opponentName={match.opponentName}
        size="sm"
      />

      {/* Bottom — superficie + tipo, con il turno come bollino a destra.
          Il turno non è accodato alla riga di testo ma sta in un bollino
          proprio: è l'informazione che dà la posta in gioco della partita
          ("era un quarto di finale") e in coda a superficie ed evento sarebbe
          la prima cosa a essere troncata su uno schermo stretto. */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs shrink-0">{surfaceIcon(match.surface)}</span>
          <span className="text-xs truncate min-w-0" style={{ color: 'var(--color-slate)' }}>
            {cap(match.surface)} · {typeLabel}{eventSuffix}
          </span>
        </div>
        {round && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                style={{ background: 'rgba(244,163,0,0.14)', color: 'var(--color-amber-light)', fontFamily: 'var(--font-display)' }}>
            {round.short}
          </span>
        )}
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
