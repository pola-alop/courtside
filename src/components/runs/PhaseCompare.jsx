import { useState } from 'react'
import { HR_ZONES } from '../../lib/athletics'
import {
  flattenItems, stepTypeMeta, targetMeta, formatStepDuration, formatStepTime, formatPace,
} from '../../lib/running'
import { matchLaps, lapPaceSec, zoneForPace } from '../../lib/fit'

// Fase per fase: ciò che la scheda prevedeva contro ciò che l'orologio ha
// misurato in ogni fase (un lap per fase, ripetute srotolate). Compare solo
// per le corse importate da un file .FIT con la scheda: le fasi portano
// `fitStep`, l'indice dello step del file, che le lega ai loro lap.
//
// La zona "reale" è dedotta dal passo tenuto, con la tabella del Profilo: dice
// quanto la zona dichiarata per la fase descrive come l'hai corsa davvero.
// Collassabile: una corsa a ripetute ha decine di righe.
export default function PhaseCompare({ items, laps, running }) {
  const [open, setOpen] = useState(false)
  const flat = flattenItems(items)
  const matched = matchLaps(flat, laps)
  const count = matched.filter(m => m.lap).length
  if (count === 0) return null

  return (
    <div className="mb-4">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between py-2">
        <span className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          Fase per fase
        </span>
        <span className="text-xs flex items-center gap-2" style={{ color: 'var(--color-slate)' }}>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{count} fasi</span>
          <span>{open ? '▾' : '▸'}</span>
        </span>
      </button>

      {open && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
          <div className="flex px-4 pt-2.5 pb-1 text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-slate)' }}>
            <span className="flex-1">Pianificato</span>
            <span>Reale</span>
          </div>
          {flat.map(({ step, repeatId, iteration }, i) => {
            const lap = matched[i].lap
            const type = stepTypeMeta(step.stepType)
            const target = targetMeta(step.target)
            const pace = lap ? lapPaceSec(lap) : null
            // La zona reale ha senso solo per le fasi di corsa: una camminata o una
            // pausa non hanno una zona di passo da confrontare.
            const realZone = pace && target.zoneIndex != null ? zoneForPace(pace, running) : null
            const differs = realZone !== null && realZone !== target.zoneIndex
            return (
              <div key={`${step.id}-${i}`} className="flex items-start gap-2 px-4 py-2.5"
                   style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="w-1.5 h-8 rounded-full shrink-0 mt-0.5" style={{ background: type.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--color-white)' }}>
                    {type.label}{repeatId ? ` ${iteration + 1}` : ''}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                    {formatStepDuration(step.duration)} · {target.label}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {lap ? (
                    <>
                      <p className="text-xs" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
                        {formatStepTime(lap.sec)}{pace ? ` · ${formatPace(pace)}/km` : ''}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                        {lap.hr ? `FC ${lap.hr}` : ''}{lap.power ? ` · ${lap.power} W` : ''}
                        {realZone !== null && (
                          <span style={{ color: differs ? 'var(--color-amber)' : 'var(--color-slate)' }}>
                            {` · ${HR_ZONES[realZone].label}`}
                          </span>
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px]" style={{ color: 'var(--color-slate)' }}>—</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
