import { useState } from 'react'
import { useFitDetailsBatch } from '../../hooks/useFitDetailsBatch'
import { MAX_FIT_SESSIONS } from '../../lib/fitStats'

// Cancello dei blocchi che leggono i dettagli del .FIT (lap e serie).
//
// Stats monta tutti i blocchi del tab appena lo si apre, ma questi hanno bisogno
// di un documento Firestore per sessione: leggerli subito significherebbe pagare
// fino a 40 letture per blocco a chi guarda solo il volume. Il blocco resta
// quindi CHIUSO, dichiara quante letture costerebbe e legge solo al tap. Una
// volta letti, i documenti restano in cache (vedi `useFitDetailsBatch`):
// cambiare periodo o riaprire il blocco non rilegge quelli già scaricati.
//
// `fit` = { list, total, capped } da `pickLatest`. `children` riceve
// `{ byId, failed }` solo a lettura finita.

export default function FitGate({ fit, unit, children }) {
  const [open, setOpen] = useState(false)
  const ids = fit.list.map(s => s.fitId)
  const { byId, done, total, failed, loading } = useFitDetailsBatch(ids, open)

  if (fit.total === 0) {
    return (
      <p className="text-[11px]" style={{ color: 'var(--color-slate)' }}>
        Nessuna di queste {unit} nel periodo ha il file .FIT importato: le serie e i lap vengono
        solo da lì.
      </p>
    )
  }

  if (!open) {
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)}
                className="w-full rounded-xl px-3 py-3 text-[12px] font-semibold transition-all active:scale-[0.98]"
                style={{ background: 'var(--color-teal-dark)', color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          Analizza {fit.list.length} {unit}
          <span className="font-normal" style={{ fontFamily: 'var(--font-mono)' }}> · {fit.list.length} {fit.list.length === 1 ? 'lettura' : 'letture'}</span>
        </button>
        <p className="text-[10px] mt-2 leading-relaxed" style={{ color: 'var(--color-slate)' }}>
          {fit.capped
            ? `Le ultime ${MAX_FIT_SESSIONS} di ${fit.total} con il file .FIT. `
            : ''}
          I dettagli dell'orologio si scaricano solo adesso, uno per sessione, e restano in memoria finché non chiudi l'app.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div>
        <div className="h-1.5 rounded-full" style={{ background: 'var(--color-surface-2)' }}>
          <div className="h-full rounded-full transition-all"
               style={{ width: `${total ? (done / total) * 100 : 0}%`, background: 'var(--color-teal-dark)' }} />
        </div>
        <p className="text-[10px] mt-2" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          Lette {done} su {total}
        </p>
      </div>
    )
  }

  return (
    <div>
      {children({ byId, failed })}
      {fit.capped && (
        <p className="text-[10px] mt-3 leading-relaxed" style={{ color: 'var(--color-slate)' }}>
          Analizzate le ultime {MAX_FIT_SESSIONS} di {fit.total} sessioni con il file .FIT del periodo.
        </p>
      )}
      {failed > 0 && (
        <p className="text-[10px] mt-1.5 leading-relaxed" style={{ color: 'var(--color-amber)' }}>
          {failed === 1 ? 'Un documento non è stato letto' : `${failed} documenti non sono stati letti`} (rete): riapri l'app per riprovare.
        </p>
      )}
    </div>
  )
}
