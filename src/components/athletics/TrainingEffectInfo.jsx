import { useState } from 'react'

// Bottoncino "?" + modale informativa sul Training Effect (Garmin/Firstbeat
// Analytics). Condiviso da AddMatchModal (step Atletica) e MatchDetailModal
// (righe Training effect aerobico/anaerobico): stesso identico contenuto in
// entrambi i posti, niente da duplicare.
export default function TrainingEffectInfoButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Cos'è il training effect"
        className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
        style={{ background: 'rgba(118,195,194,0.18)', color: 'var(--color-teal)', lineHeight: 1 }}>
        ?
      </button>
      {open && <TrainingEffectInfoModal onClose={() => setOpen(false)} />}
    </>
  )
}

function TrainingEffectInfoModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: 'rgba(2,13,25,0.9)', backdropFilter: 'blur(6px)', textTransform: 'none', fontWeight: 400 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-3xl flex flex-col"
           style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)', maxHeight: '85vh' }}>

        <div className="shrink-0 px-6 pt-6 pb-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-surface-2)' }}>
          <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-white)' }}>
            Cos'è il Training Effect?
          </h2>
          <button onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)' }}>
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          <p className="text-sm" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-body)' }}>
            Il <strong>Training Effect</strong> (TE) misura l'impatto di un allenamento sulla tua forma aerobica
            e anaerobica. È una tecnologia di Firstbeat Analytics, usata dai dispositivi Garmin, basata sul
            consumo di ossigeno in eccesso post-esercizio (EPOC): più il corpo fatica a recuperare dopo lo
            sforzo, più alto è il punteggio. Va da 0 a 5 e viene calcolato su due assi separati.
          </p>

          <InfoBlock title="Effetto aerobico">
            Usa la frequenza cardiaca per misurare come l'intensità accumulata durante la partita influisce
            sulla forma cardiovascolare, cioè sulla capacità del corpo di usare l'ossigeno in modo efficiente.
            Sforzi costanti a intensità moderata o scambi lunghi (oltre 180 secondi) hanno l'impatto maggiore
            su questo valore.
          </InfoBlock>

          <InfoBlock title="Effetto anaerobico">
            Usa frequenza cardiaca e velocità/potenza per misurare quanto un allenamento ha sollecitato la
            capacità di sostenere sforzi molto intensi. Ripetute ad alta intensità, brevi (10-120 secondi) —
            come scambi esplosivi o sprint tra un punto e l'altro — hanno l'impatto maggiore su questo valore.
          </InfoBlock>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
              Scala (0-5, valida per entrambi)
            </p>
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
              {SCALE.map((row, i) => (
                <div key={row.range}
                     className="flex justify-between items-center px-4 py-2.5 gap-3"
                     style={{ borderBottom: i < SCALE.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <span className="text-xs shrink-0" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>{row.range}</span>
                  <span className="text-xs text-right" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-body)' }}>{row.label}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px]" style={{ color: 'var(--color-slate)' }}>
            Fonte: manuali Garmin / Firstbeat Analytics.
          </p>
        </div>
      </div>
    </div>
  )
}

function InfoBlock({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
        {title}
      </p>
      <p className="text-sm" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-body)' }}>
        {children}
      </p>
    </div>
  )
}

const SCALE = [
  { range: '0,0 – 0,9', label: 'Nessun effetto' },
  { range: '1,0 – 1,9', label: 'Effetto minore' },
  { range: '2,0 – 2,9', label: 'Mantenimento della forma' },
  { range: '3,0 – 3,9', label: 'Miglioramento della forma' },
  { range: '4,0 – 4,9', label: 'Forte miglioramento' },
  { range: '5,0',       label: 'Eccessivo — rischio di sovraccarico senza un recupero adeguato' },
]
