import { suggestIntensity } from '../../lib/fit'
import { intensityMeta } from '../../lib/training'

// «Quanto è stata dura» suggerita dai dati dell'orologio, con un tap per
// confermarla. È un suggerimento e non un valore: la scelta è dell'utente, e
// non viene salvata finché non la tocca (vedi `suggestIntensity` in fit.js per
// il perché). Non compare se non c'è niente da suggerire o se coincide già con
// quanto dichiarato.
export default function IntensitySuggestion({ athletics, current, onUse }) {
  const s = suggestIntensity(athletics)
  if (!s || s.id === current) return null
  const meta = intensityMeta(s.id)

  return (
    <div className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--color-surface-2)' }}>
      <p className="flex-1 min-w-0 text-[11px] leading-snug" style={{ color: 'var(--color-slate)' }}>
        Dall'orologio sembra <strong style={{ color: meta.color }}>{meta.label.toLowerCase()}</strong>
        {' '}({s.basis}).
      </p>
      <button type="button" onClick={() => onUse(s.id)}
        className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95"
        style={{ background: 'var(--color-teal-dark)', color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
        Usa
      </button>
    </div>
  )
}
