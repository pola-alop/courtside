import { tieStatusMeta, resultText, formulaText } from '../../lib/teamTies'

// Uno scontro come gradino della scala della fase finale (`TournamentLadder`
// con `renderItem`): la squadra avversaria, il risultato ricavato (2-1) e lo
// stato. `item.info` arriva da `finalsRun`: la card non ricalcola niente.
export default function TieStepCard({ item, onClick }) {
  const meta = tieStatusMeta(item.info.status)
  const accent = item.result === 'win' ? 'var(--color-win)' : item.result === 'loss' ? 'var(--color-loss)' : 'var(--color-teal-dark)'

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-3 mb-2 flex flex-col items-stretch gap-1 overflow-hidden transition-all active:scale-[0.98]"
      style={{ background: 'var(--color-surface-2)', borderLeft: `2px solid ${accent}` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <p className="min-w-0 flex-1 basis-32 text-sm font-bold wrap-anywhere"
           style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          vs {item.opponentName}
        </p>
        <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ background: meta.bg, color: meta.color, fontFamily: 'var(--font-display)' }}>
          {meta.label}
        </span>
      </div>
      <p className="text-xs wrap-anywhere" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
        {resultText(item.info.result)} · {formulaText(item.tie.formula)}
      </p>
    </button>
  )
}
