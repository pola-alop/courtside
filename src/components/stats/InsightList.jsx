import { useState } from 'react'

// Lo strato che rende la pagina "parlante". Un 54% non dice niente; "vinci il
// 61% dei game ma solo il 48% delle partite" dice tutto.
//
// Vive a livello di PAGINA e non dentro una sezione: oggi riceve le frasi di
// Rendimento e di Attività già concatenate e riordinate per peso, quindi un picco
// di carico può stare sopra un dato di rendimento. Ogni frase sa a quale tab e a
// quale blocco appartiene (`tab` + `target`), quindi Tecnica, Fisico e Setup si
// aggancieranno aggiungendo la loro lista, senza toccare questo componente.

const VISIBLE = 4

const TONES = {
  good:    { color: 'var(--color-win)',   bg: 'var(--color-win-bg)'   },
  bad:     { color: 'var(--color-amber)', bg: 'rgba(244,163,0,0.12)'  },
  neutral: { color: 'var(--color-slate)', bg: 'var(--color-surface-2)' },
}

export default function InsightList({ insights = [], onNavigate }) {
  const [expanded, setExpanded] = useState(false)

  if (insights.length === 0) return null

  const shown = expanded ? insights : insights.slice(0, VISIBLE)
  const hidden = insights.length - shown.length

  return (
    <div className="space-y-2">
      {shown.map(i => {
        const tone = TONES[i.tone] || TONES.neutral
        return (
          <button key={i.id}
            onClick={() => onNavigate?.(i)}
            className="w-full text-left flex items-start gap-2.5 rounded-2xl px-3 py-2.5 transition-all active:scale-[0.99]"
            style={{ background: tone.bg, border: '1px solid var(--color-surface-2)' }}>
            <span className="text-sm shrink-0 leading-tight mt-0.5">{i.icon}</span>
            <span className="flex-1 min-w-0 text-[11px] leading-relaxed"
                  style={{ color: 'var(--color-white)' }}>
              {i.text}
            </span>
            <span className="text-xs shrink-0 leading-tight mt-0.5" style={{ color: tone.color }}>›</span>
          </button>
        )
      })}

      {(hidden > 0 || expanded) && (
        <button onClick={() => setExpanded(!expanded)}
          className="w-full py-1.5 text-[10px] font-medium transition-all"
          style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          {expanded ? 'Mostra meno' : `Mostra altri ${hidden}`}
        </button>
      )}
    </div>
  )
}
