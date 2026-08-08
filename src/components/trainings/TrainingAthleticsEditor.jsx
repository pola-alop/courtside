import { useState } from 'react'
import {
  HR_ZONES, ATHLETIC_LIMITS, emptyAthletics, normalizeAthletics,
  athleticsIssues, hasAthletics, zonesTotalSec, trainingEffectLabel,
  formatDuration,
} from '../../lib/athletics'
import TrainingEffectInfoButton from '../athletics/TrainingEffectInfo'

// Form dei dati atletici di un ALLENAMENTO, aperto dal dettaglio sessione.
//
// Differenza deliberata rispetto allo step 7 di AddMatchModal: qui NON c'è il
// campo durata. La durata di un allenamento è già la somma dei suoi blocchi —
// quella che si trascrive dall'orologio quando si registra la sessione — e
// chiedere una seconda durata "dell'attività" significherebbe mantenere due
// numeri che dicono la stessa cosa e possono divergere. Il `durationSec`
// canonico viene quindi iniettato al salvataggio a partire dai minuti della
// sessione, così `avgSpeedKmh`, `athleticsIssues` (zone più lunghe della
// sessione) e la tile "Tempo" continuano a funzionare senza modifiche.
//
// I widget di input sono volutamente duplicati da AddMatchModal invece di
// essere estratti: sono una manciata di righe banali, e condividerli avrebbe
// richiesto di parametrizzare il wizard match per una differenza (la durata)
// che è concettuale, non cosmetica.
export default function TrainingAthleticsEditor({ athletics, sessionMinutes, saving, onCancel, onSave }) {
  const [draft, setDraft] = useState(() => ({ ...emptyAthletics(), ...(athletics || {}), durationSec: null }))
  const [showZones, setShowZones] = useState(() => zonesTotalSec(athletics?.zones) > 0)

  const sessionSeconds = Math.max(0, Math.round((sessionMinutes || 0) * 60)) || null

  const patch = (p) => setDraft(d => ({ ...d, ...p }))

  const setZone = (i, sec) => {
    const zones = HR_ZONES.map((_, k) => draft.zones?.[k] ?? 0)
    zones[i] = sec ?? 0
    patch({ zones: zones.some(v => v > 0) ? zones : null })
  }

  // La validazione gira sul draft con la durata della sessione iniettata:
  // altrimenti il controllo "zone più lunghe della sessione" non avrebbe un
  // riferimento contro cui misurarsi.
  const issues = athleticsIssues({ ...draft, durationSec: sessionSeconds })
  const canSave = issues.length === 0

  const teLabel = trainingEffectLabel(draft.trainingEffect)
  const anTeLabel = trainingEffectLabel(draft.anaerobicTrainingEffect)
  const zonesTotal = zonesTotalSec(draft.zones)

  const handleSave = () => {
    if (!canSave || saving) return
    // Il draft NON contiene la durata: se nessun altro campo è compilato
    // l'oggetto deve risultare vuoto e finire a `null`, altrimenti su Firestore
    // resterebbe un athletics con la sola durata — un dato che non è mai stato
    // inserito dall'utente.
    const base = normalizeAthletics({ ...draft, durationSec: null })
    onSave(base ? { ...base, durationSec: sessionSeconds } : null)
  }

  const filled = hasAthletics({ ...draft, durationSec: null })

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-display)' }}>
          Dati atletici
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-slate)' }}>
          Trascrivi i dati dal tuo orologio o dall'app. La durata è già quella della
          sessione ({formatDuration(sessionSeconds)}), non va reinserita.
        </p>
      </div>

      <FieldGroup label="Sforzo">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Distanza" suffix="km" placeholder="0,0"
            value={draft.distanceKm} onChange={v => patch({ distanceKm: v })}
            {...ATHLETIC_LIMITS.distanceKm} />
          <NumberField label="Calorie" suffix="kcal" placeholder="0"
            value={draft.calories} onChange={v => patch({ calories: v })}
            {...ATHLETIC_LIMITS.calories} />
        </div>
      </FieldGroup>

      <FieldGroup label="Frequenza cardiaca">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Media" suffix="bpm" placeholder="80"
            value={draft.avgHr} onChange={v => patch({ avgHr: v })} {...ATHLETIC_LIMITS.hr} />
          <NumberField label="Massima" suffix="bpm" placeholder="120"
            value={draft.maxHr} onChange={v => patch({ maxHr: v })} {...ATHLETIC_LIMITS.hr} />
        </div>
      </FieldGroup>

      <FieldGroup label="Training effect" labelExtra={<TrainingEffectInfoButton />}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <NumberField label="Aerobico" placeholder="0,0"
              value={draft.trainingEffect} onChange={v => patch({ trainingEffect: v })}
              {...ATHLETIC_LIMITS.trainingEffect} />
            <p className="text-xs mt-1" style={{ color: teLabel ? 'var(--color-teal)' : 'var(--color-slate)' }}>
              {teLabel || 'Scala da 0,0 a 5,0'}
            </p>
          </div>
          <div>
            <NumberField label="Anaerobico" placeholder="0,0"
              value={draft.anaerobicTrainingEffect} onChange={v => patch({ anaerobicTrainingEffect: v })}
              {...ATHLETIC_LIMITS.anaerobicTrainingEffect} />
            <p className="text-xs mt-1" style={{ color: anTeLabel ? 'var(--color-teal)' : 'var(--color-slate)' }}>
              {anTeLabel || 'Scala da 0,0 a 5,0'}
            </p>
          </div>
        </div>
      </FieldGroup>

      {/* Zone — sezione collassabile: sono 5 righe, e su mobile appesantiscono
          il form per chi non le usa */}
      <div>
        <button onClick={() => setShowZones(s => !s)} className="w-full flex items-center justify-between py-2">
          <span className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
            Tempo in zone d'attività
          </span>
          <span className="text-xs flex items-center gap-2" style={{ color: 'var(--color-slate)' }}>
            {zonesTotal > 0 && <span style={{ fontFamily: 'var(--font-mono)' }}>{formatDuration(zonesTotal)}</span>}
            <span>{showZones ? '▾' : '▸'}</span>
          </span>
        </button>

        {showZones && (
          <div className="space-y-2 mt-1">
            {HR_ZONES.map((z, i) => (
              <ZoneRow key={z.id} zone={z} seconds={draft.zones?.[i] ?? 0} onChange={sec => setZone(i, sec)} />
            ))}
          </div>
        )}
      </div>

      {issues.map(msg => (
        <p key={msg} className="text-xs" style={{ color: 'var(--color-loss)' }}>⚠ {msg}</p>
      ))}

      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-3 rounded-2xl text-sm font-semibold"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
          Annulla
        </button>
        <button onClick={handleSave} disabled={!canSave || saving}
          className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
          style={{
            background: (!canSave || saving) ? 'var(--color-surface-2)' : 'var(--color-amber)',
            color:      (!canSave || saving) ? 'var(--color-slate)'     : 'var(--color-bg)',
            fontFamily: 'var(--font-display)'
          }}>
          {saving ? 'Salvo...' : 'Salva'}
        </button>
      </div>

      {filled && (
        <button
          onClick={() => setDraft({ ...emptyAthletics(), durationSec: null })}
          className="w-full py-2.5 rounded-2xl text-xs font-semibold transition-all"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
          Svuota i dati atletici
        </button>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

function ZoneRow({ zone, seconds, onChange }) {
  const m = Math.floor((seconds || 0) / 60)
  const s = (seconds || 0) % 60
  const setPart = (part, v) => {
    const mm = part === 'm' ? (v ?? 0) : m
    const ss = part === 's' ? (v ?? 0) : s
    onChange(mm * 60 + ss)
  }

  return (
    <div className="rounded-2xl p-3 flex items-center gap-3" style={{ background: 'var(--color-surface-2)' }}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="w-1.5 h-8 rounded-full shrink-0" style={{ background: zone.color }} />
        <div className="min-w-0">
          <p className="text-xs font-semibold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            {zone.label}
          </p>
          <p className="text-[11px] truncate" style={{ color: 'var(--color-slate)' }}>{zone.name}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <BareNumberInput value={m || null} onChange={v => setPart('m', v)} min={0} max={999} placeholder="0" />
        <span className="text-xs" style={{ color: 'var(--color-slate)' }}>min</span>
        <BareNumberInput value={s || null} onChange={v => setPart('s', v)} min={0} max={59} placeholder="00" />
        <span className="text-xs" style={{ color: 'var(--color-slate)' }}>sec</span>
      </div>
    </div>
  )
}

function FieldGroup({ label, labelExtra, children }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
        {label}
        {labelExtra}
      </p>
      {children}
    </div>
  )
}

function NumberField({ label, suffix, value, onChange, min, max, step = 1, placeholder }) {
  return (
    <div>
      <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>
        {label}{suffix ? ` (${suffix})` : ''}
      </label>
      <BareNumberInput value={value} onChange={onChange} min={min} max={max} step={step} placeholder={placeholder} full />
    </div>
  )
}

// Input numerico "nudo": il valore canonico è sempre number|null, mai stringa.
// `type="number"` evita gli stati intermedi non parsabili (es. "2,") e apre il
// tastierino numerico su mobile; il clamp definitivo lo fa normalizeAthletics
// al salvataggio, così non si combatte con l'utente mentre digita.
function BareNumberInput({ value, onChange, min, max, step = 1, placeholder, full = false }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value ?? ''}
      min={min} max={max} step={step}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className={`${full ? 'w-full' : 'w-14 text-center'} p-3 rounded-xl text-sm outline-none`}
      style={{
        background: full ? 'var(--color-surface-2)' : 'var(--color-surface)',
        color: 'var(--color-white)',
        border: '1px solid transparent',
        fontFamily: 'var(--font-mono)',
      }}
    />
  )
}
