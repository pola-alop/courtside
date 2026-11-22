import { tieStatusMeta, resultText, formulaText, homeLabel } from '../../lib/teamTies'

// Riga della lista «A squadre»: la squadra avversaria, data e formula, il
// risultato ricavato dagli incontri (2-1) e lo stato. Tap → dettaglio.
// `info` arriva da `describeTie`: la card non ricalcola niente.
export default function TeamTieCard({ tie, info, onClick }) {
  const meta = tieStatusMeta(info.status)
  const details = [formatDate(tie.date), homeLabel(tie.home), formulaText(tie.formula)].filter(Boolean).join(' · ')

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-3 flex flex-col items-stretch gap-2 overflow-hidden transition-all active:scale-[0.98]"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}
    >
      {/* Nome e stato vanno a capo (la card si allunga): niente testo tagliato */}
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1.5">
        <div className="min-w-0 flex-1 basis-40">
          <p className="text-sm font-bold break-words"
             style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            vs {tie.opponentTeam}
          </p>
          <p className="text-xs mt-0.5 break-words" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
            {details}
          </p>
        </div>
        <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ background: meta.bg, color: meta.color, fontFamily: 'var(--font-display)' }}>
          {meta.label}
        </span>
      </div>

      {/* Traccia: un segmento per incontro (vinto, perso, da giocare) e il
          risultato; con incontri ancora aperti dice quanti. */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1">
          {info.rubbers.map(r => (
            <span key={r.slot} className="flex-1 rounded-full"
                  style={{ height: '0.375rem', background: segmentColor(r.winner) }} />
          ))}
        </div>
        <span className="text-xs font-semibold shrink-0 tabular-nums"
              style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
          {resultText(info.result)}
        </span>
      </div>
      {info.result.pending > 0 && info.result.decided > 0 && (
        <p className="text-xs" style={{ color: 'var(--color-slate)' }}>
          {info.result.pending === 1 ? '1 incontro da segnare' : `${info.result.pending} incontri da segnare`}
        </p>
      )}
    </button>
  )
}

// ── Helpers ────────────────────────────────────────────────

function segmentColor(winner) {
  if (winner === 'us') return 'var(--color-win)'
  if (winner === 'them') return 'var(--color-loss)'
  return 'var(--color-surface-2)'
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return dateStr }
}
