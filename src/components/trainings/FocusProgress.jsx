import { useState } from 'react'
import { MAX_RATING, focusProgress } from '../../lib/training'

// Quanti colpi mostrare prima del "mostra tutti": chi si allena con costanza
// accumula facilmente 15-20 voci, e la lista integrale seppellirebbe la lista
// delle sessioni sotto di essa.
const PREVIEW_COUNT = 5

// Quante valutazioni servono perché un colpo abbia un "trend": con un solo voto
// non c'è progressione da mostrare, solo una fotografia.
const MIN_RATINGS = 2

// Trend delle auto-valutazioni per colpo. È il payoff delle stelline nel
// dettaglio sessione: risponde a "sto migliorando?" invece che solo a "quanto
// mi sono allenato?".
export default function FocusProgress({ trainings }) {
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const all = focusProgress(trainings).filter(p => p.count >= MIN_RATINGS)
  if (all.length === 0) return null

  const visible = showAll ? all : all.slice(0, PREVIEW_COUNT)

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-4 py-3 text-left">
        <span className="text-sm">📈</span>
        <span className="text-sm font-semibold flex-1" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          Progressi per colpo
        </span>
        <span className="text-xs" style={{ color: 'var(--color-slate)' }}>{all.length}</span>
        <span className="text-xs" style={{ color: 'var(--color-slate)' }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {visible.map(p => <ProgressRow key={p.id} progress={p} />)}

          {all.length > PREVIEW_COUNT && (
            <button onClick={() => setShowAll(s => !s)}
              className="w-full py-2 rounded-xl text-xs font-semibold"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
              {showAll ? 'Mostra meno' : `Mostra tutti (${all.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

function ProgressRow({ progress }) {
  const { label, first, last, delta, series, count } = progress
  const trend = deltaMeta(delta)

  return (
    <div className="rounded-2xl px-3 py-3" style={{ background: 'var(--color-surface-2)' }}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {label}
        </p>
        <span className="flex items-center gap-1 text-xs font-bold shrink-0"
              style={{ color: trend.color, fontFamily: 'var(--font-mono)' }}>
          {trend.arrow} {trend.text}
        </span>
      </div>

      <Sparkline series={series} />

      <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-slate)' }}>
        Da {first} a {last} su {MAX_RATING} · {count} valutazioni
      </p>
    </div>
  )
}

// Barre proporzionali al voto (1..5). Volutamente non un grafico a linee: la
// serie è corta, discreta e su una scala piccola — le barre si leggono meglio a
// questa dimensione, e non suggeriscono un'interpolazione tra due allenamenti.
function Sparkline({ series }) {
  return (
    <div className="flex items-end gap-1 h-8">
      {series.map((p, i) => {
        const isLast = i === series.length - 1
        return (
          <div key={`${p.date}-${i}`} className="flex-1 rounded-sm"
               style={{
                 height: `${(p.value / MAX_RATING) * 100}%`,
                 minHeight: 3,
                 background: isLast ? 'var(--color-amber)' : 'var(--color-teal-dark)',
               }} />
        )
      })}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

function deltaMeta(delta) {
  if (delta > 0) return { arrow: '▲', text: `+${delta}`, color: 'var(--color-win)' }
  if (delta < 0) return { arrow: '▼', text: String(delta), color: 'var(--color-loss)' }
  return { arrow: '=', text: 'stabile', color: 'var(--color-slate)' }
}
