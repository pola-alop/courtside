import { useState, useRef, useEffect } from 'react'
import {
  STEP_TYPES, DURATION_TYPES, HR_CONDITIONS, TARGETS, DEFAULT_HR_ESTIMATE_SEC,
  MAX_NOTE_LENGTH, stepTypeMeta, stepIssue, targetPaceRange, formatStepEstimate,
} from '../../lib/running'

// Sotto-schermata di una fase, sul modello della schermata Garmin: tre blocchi
// (Info fase, Durata, Obiettivo intensità). Modifica la fase sul posto
// (`onChange(patch)`): non c'è un "Salva" della fase, si salva la scheda intera.
//
// Cambiare tipo di durata NON cancella i valori degli altri tipi dal draft:
// tornare da "Distanza" a "Tempo" ritrova il tempo di prima. È normalizeItems,
// al salvataggio, a tenere solo i campi del tipo scelto.
export default function StepEditor({ step, running, onChange, onBack, onRemove }) {
  const [showNotes, setShowNotes] = useState(Boolean(step.notes))
  const rootRef = useRef(null)

  // La sotto-schermata si apre dentro un corpo già scrollato (la lista fasi):
  // senza riportarla in cima si aprirebbe a metà, sotto il "Tipo di fase".
  useEffect(() => { rootRef.current?.scrollIntoView({ block: 'start' }) }, [])
  const d = step.duration || {}
  const fermo = step.target === 'fermo'
  const hasWeight = typeof running?.weightKg === 'number'
  const issue = stepIssue(step, running)
  const estimate = formatStepEstimate(step, running)

  const setDuration = (patch) => onChange({ duration: { ...d, ...patch } })

  // Il nuovo tipo prende i propri default solo per i campi che non ha ancora.
  const setDurationType = (type) => {
    const defaults = {
      time:     { sec: d.sec ?? stepTypeMeta(step.stepType).defaultSec },
      distance: { meters: d.meters ?? 1000, unit: d.unit ?? 'km' },
      calories: { kcal: d.kcal ?? 100 },
      hr:       { bpm: d.bpm ?? 130, condition: d.condition ?? 'sotto', estimatedSec: d.estimatedSec ?? DEFAULT_HR_ESTIMATE_SEC },
    }[type]
    onChange({ duration: { ...d, ...defaults, type } })
  }

  // Cambiando tipo di fase la zona segue il default del nuovo tipo solo se era
  // ancora quella di default del vecchio: una scelta esplicita non si tocca.
  const setStepType = (id) => {
    const oldDefault = stepTypeMeta(step.stepType).defaultTarget
    const target = step.target === oldDefault ? stepTypeMeta(id).defaultTarget : step.target
    const patch = { stepType: id, target }
    if (target === 'fermo' && (d.type === 'distance' || d.type === 'calories')) {
      patch.duration = { ...d, type: 'time', sec: d.sec ?? stepTypeMeta(id).defaultSec }
    }
    onChange(patch)
  }

  // Da fermo non si percorre distanza: scegliere "Fermo" riporta una fase a
  // distanza/calorie sul tempo, invece di lasciarla in uno stato non valido.
  const setTarget = (id) => {
    const patch = { target: id }
    if (id === 'fermo' && (d.type === 'distance' || d.type === 'calories')) {
      patch.duration = { ...d, type: 'time', sec: d.sec ?? stepTypeMeta(step.stepType).defaultSec }
    }
    onChange(patch)
  }

  const durationDisabled = (type) => {
    if (type === 'distance') return fermo
    if (type === 'calories') return fermo || !hasWeight
    return false
  }

  return (
    <div ref={rootRef} className="space-y-4">
      {/* Header della sotto-schermata */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm font-medium" style={{ color: 'var(--color-teal)' }}>
          ← Fasi
        </button>
        <p className="text-sm font-bold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {stepTypeMeta(step.stepType).label}
        </p>
        <button onClick={onRemove} className="text-sm font-medium" style={{ color: 'var(--color-loss)' }}>
          Rimuovi
        </button>
      </div>

      {/* Info fase */}
      <Block title="Info fase">
        <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Tipo di fase</label>
        <select value={step.stepType} onChange={e => setStepType(e.target.value)}
          className="w-full p-3 rounded-xl text-sm outline-none"
          style={{ background: 'var(--color-surface)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-display)' }}>
          {STEP_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>

        {showNotes ? (
          <div className="mt-3">
            <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Note</label>
            <textarea
              value={step.notes || ''}
              onChange={e => onChange({ notes: e.target.value })}
              maxLength={MAX_NOTE_LENGTH}
              rows={2}
              placeholder="Es. in salita, allunghi progressivi..."
              className="w-full p-3 rounded-xl text-sm outline-none resize-none"
              style={{ background: 'var(--color-surface)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-body)' }}
            />
          </div>
        ) : (
          <button onClick={() => setShowNotes(true)}
            className="w-full mt-3 flex items-center justify-between py-1 text-sm"
            style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            Aggiungi note
            <span className="text-lg" style={{ color: 'var(--color-teal)' }}>+</span>
          </button>
        )}
      </Block>

      {/* Durata */}
      <Block title="Durata">
        <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Tipo di durata</label>
        <div className="grid grid-cols-2 gap-2">
          {DURATION_TYPES.map(t => {
            const active = d.type === t.id
            const disabled = durationDisabled(t.id)
            return (
              <button key={t.id} disabled={disabled} onClick={() => setDurationType(t.id)}
                className="py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: active ? 'var(--color-teal-dark)' : 'var(--color-surface)',
                  color: active ? 'var(--color-white)' : 'var(--color-slate)',
                  opacity: disabled ? 0.4 : 1,
                  fontFamily: 'var(--font-display)'
                }}>
                {t.label}
              </button>
            )
          })}
        </div>
        {!hasWeight && (
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-slate)' }}>
            Per le fasi a calorie aggiungi il peso nelle zone di corsa del Profilo.
          </p>
        )}

        <div className="mt-3">
          {d.type === 'time' && (
            <>
              <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Durata</label>
              <MinSecInput value={d.sec} onChange={sec => setDuration({ sec })} />
            </>
          )}

          {d.type === 'distance' && (
            <DistanceInput meters={d.meters} unit={d.unit || 'km'}
              onChange={(meters, unit) => setDuration({ meters, unit })} />
          )}

          {d.type === 'calories' && (
            <>
              <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Calorie (kcal)</label>
              <NumberInput value={d.kcal} onChange={kcal => setDuration({ kcal })} placeholder="100" />
            </>
          )}

          {d.type === 'hr' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Fino a quando la frequenza cardiaca…</label>
                <div className="grid grid-cols-2 gap-2">
                  {HR_CONDITIONS.map(c => (
                    <button key={c.id} onClick={() => setDuration({ condition: c.id })}
                      className="py-2.5 rounded-xl text-xs font-semibold"
                      style={{
                        background: d.condition === c.id ? 'var(--color-teal-dark)' : 'var(--color-surface)',
                        color: d.condition === c.id ? 'var(--color-white)' : 'var(--color-slate)',
                        fontFamily: 'var(--font-display)'
                      }}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Frequenza cardiaca (bpm)</label>
                <NumberInput value={d.bpm} onChange={bpm => setDuration({ bpm })} placeholder="130" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Durata stimata</label>
                <MinSecInput value={d.estimatedSec} onChange={estimatedSec => setDuration({ estimatedSec })} />
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-slate)' }}>
                  Quanto ci metti di solito: una soglia di frequenza non si traduce in una
                  durata, e senza questa stima la fase non si può disegnare.
                </p>
              </div>
            </div>
          )}
        </div>
      </Block>

      {/* Obiettivo intensità */}
      <Block title="Zona">
        <p className="text-[11px] mb-2" style={{ color: 'var(--color-slate)' }}>
          La zona in cui corri questa fase: il suo passo traduce distanza e tempo l'una nell'altro.
        </p>
        <div className="space-y-1.5">
          {TARGETS.map(t => {
            const active = step.target === t.id
            const range = targetPaceRange(t.id, running)
            return (
              <button key={t.id} onClick={() => setTarget(t.id)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all"
                style={{
                  background: active ? 'var(--color-teal-dark)' : 'var(--color-surface)',
                  border: active ? '1px solid var(--color-teal)' : '1px solid transparent',
                }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color, border: '1px solid var(--color-slate)' }} />
                <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                  {t.label}
                </span>
                <span className="text-[11px] flex-1 truncate" style={{ color: active ? 'var(--color-white)' : 'var(--color-slate)' }}>
                  {t.zoneIndex != null ? t.name : ''}
                </span>
                {range && (
                  <span className="text-[11px] shrink-0" style={{ color: active ? 'var(--color-white)' : 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                    {range}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </Block>

      {estimate && !issue && (
        <p className="text-xs" style={{ color: 'var(--color-teal)' }}>{estimate}</p>
      )}
      {issue && <p className="text-xs" style={{ color: 'var(--color-loss)' }}>⚠ {issue}</p>}

      <button onClick={onBack}
        className="w-full py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
        style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal)', fontFamily: 'var(--font-display)', border: '1px solid var(--color-teal-dark)' }}>
        Fatto
      </button>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

function Block({ title, children }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-2"
         style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
        {title}
      </p>
      <div className="rounded-2xl p-3" style={{ background: 'var(--color-surface-2)' }}>
        {children}
      </div>
    </div>
  )
}

// Minuti + secondi in due campi numerici: il valore canonico è sempre in
// secondi (number|null), come le durate di athletics.
function MinSecInput({ value, onChange }) {
  const total = typeof value === 'number' ? Math.max(0, Math.round(value)) : 0
  const m = Math.floor(total / 60)
  const s = total % 60
  const set = (mm, ss) => {
    const next = (mm || 0) * 60 + (ss || 0)
    onChange(next > 0 ? next : null)
  }
  return (
    <div className="flex items-center gap-2">
      <NumberInput value={m || null} onChange={v => set(v, s)} placeholder="0" narrow />
      <span className="text-xs" style={{ color: 'var(--color-slate)' }}>min</span>
      <NumberInput value={s || null} onChange={v => set(m, Math.min(59, v || 0))} placeholder="00" narrow max={59} />
      <span className="text-xs" style={{ color: 'var(--color-slate)' }}>sec</span>
    </div>
  )
}

// La distanza si salva in metri; l'unità scelta resta sulla fase solo per
// mostrarla com'è stata pensata ("400 m" non è "0,4 km").
function DistanceInput({ meters, unit, onChange }) {
  const shown = typeof meters === 'number' ? (unit === 'km' ? meters / 1000 : meters) : null
  return (
    <div>
      <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Distanza</label>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <NumberInput value={shown} step={unit === 'km' ? 0.1 : 50} placeholder={unit === 'km' ? '1,0' : '400'}
            onChange={v => onChange(v == null ? null : Math.round(unit === 'km' ? v * 1000 : v), unit)} />
        </div>
        <div className="flex gap-1">
          {['m', 'km'].map(u => (
            <button key={u} onClick={() => onChange(meters, u)}
              className="px-3 py-2.5 rounded-xl text-xs font-semibold"
              style={{
                background: unit === u ? 'var(--color-teal-dark)' : 'var(--color-surface)',
                color: unit === u ? 'var(--color-white)' : 'var(--color-slate)',
                fontFamily: 'var(--font-display)'
              }}>
              {u}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function NumberInput({ value, onChange, placeholder, step = 1, narrow = false, max }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value ?? ''}
      min={0} max={max} step={step}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className={`${narrow ? 'w-16 text-center' : 'w-full'} p-3 rounded-xl text-sm outline-none`}
      style={{ background: 'var(--color-surface)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-mono)' }}
    />
  )
}
