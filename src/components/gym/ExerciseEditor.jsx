import { useState } from 'react'
import {
  LIMITS, emptyItem, emptySet, cloneItem, resolveExercise, itemIssue,
  workoutTotals, muscleScores, heatOf, SESSION_FULL_SETS, formatVolume, muscleLabel, CUSTOM_PREFIX,
} from '../../lib/gym'
import ExercisePicker from './ExercisePicker'
import BodyMap, { BodyMapLegend } from './BodyMap'

// Editor degli esercizi di una scheda: una card per esercizio, con le serie.
// Le serie uguali (il caso comune, "3 × 10 @ 40 kg") si scrivono in una riga
// sola; "Serie diverse" apre una riga per serie (piramidi, drop, ecc.).
// In fondo, "Aggiungi esercizio" apre il database, e sotto compare il
// manichino con i muscoli che la scheda allena.
//
// Componente controllato: `items` arriva dal chiamante, ogni modifica esce con
// `onChange(items)`. Gli esercizi si indirizzano per `id`, mai per indice.
// Il riordino passa dal menu ⋮ come nell'editor della corsa (niente drag).
export default function ExerciseEditor({ items, exerciseApi, onChange }) {
  const { index, custom } = exerciseApi
  const [picking, setPicking] = useState(false)
  const [menuId, setMenuId]   = useState(null)

  const addExercise = (exercise) => {
    onChange([...items, emptyItem(exercise)])
    setPicking(false)
  }

  // Creare un esercizio personalizzato lo aggiunge subito alla scheda: si è
  // arrivati lì perché serviva. Ritorna un esercizio "minimo" (id + modalità).
  const createCustom = async (data) => {
    const docId = await exerciseApi.add(data)
    return { id: CUSTOM_PREFIX + docId, mode: data.mode }
  }

  const patchItem = (id, patch) => onChange(items.map(it => (it.id === id ? { ...it, ...patch } : it)))
  const remove    = (id) => { onChange(items.filter(it => it.id !== id)); setMenuId(null) }
  const duplicate = (id) => {
    const out = []
    items.forEach(it => { out.push(it); if (it.id === id) out.push(cloneItem(it)) })
    onChange(out); setMenuId(null)
  }
  const move = (id, dir) => {
    const i = items.findIndex(x => x.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= items.length) return
    const copy = [...items]
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    onChange(copy); setMenuId(null)
  }

  const totals = workoutTotals(items, index)
  const scores = muscleScores(items, index)
  const heat = Object.fromEntries(Object.entries(scores).map(([m, v]) => [m, heatOf(v, SESSION_FULL_SETS)]))
  const touched = Object.entries(scores).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider"
             style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
            Esercizi
          </p>
          {totals.sets > 0 && (
            <span className="text-[11px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
              {totals.exercises} es. · {totals.sets} serie{totals.volumeKg > 0 ? ` · ${formatVolume(totals.volumeKg)}` : ''}
            </span>
          )}
        </div>

        {items.length === 0 && (
          <p className="text-sm text-center py-6" style={{ color: 'var(--color-slate)' }}>
            Nessun esercizio: aggiungine uno qui sotto.
          </p>
        )}

        {items.map(item => (
          <ExerciseCard
            key={item.id}
            item={item}
            index={index}
            onPatch={patch => patchItem(item.id, patch)}
            menu={
              <Menu open={menuId === item.id}
                    onToggle={() => setMenuId(m => (m === item.id ? null : item.id))}
                    onClose={() => setMenuId(null)}
                    actions={[
                      { label: 'Duplica',    onClick: () => duplicate(item.id) },
                      { label: 'Sposta su',  onClick: () => move(item.id, -1) },
                      { label: 'Sposta giù', onClick: () => move(item.id, 1) },
                      { label: 'Elimina',    onClick: () => remove(item.id), danger: true },
                    ]} />
            }
          />
        ))}

        {items.length < LIMITS.items.max && (
          <button onClick={() => setPicking(true)}
            className="w-full py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: 'var(--color-draw)', color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            + Aggiungi esercizio
          </button>
        )}
      </div>

      {touched.length > 0 && (
        <div className="rounded-2xl p-3 space-y-2" style={{ background: 'var(--color-surface-2)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider"
             style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
            Muscoli coinvolti
          </p>
          <div className="rounded-xl py-2" style={{ background: 'var(--color-bg)' }}>
            <BodyMap heat={heat} />
          </div>
          <BodyMapLegend />
          <p className="text-[11px] text-center" style={{ color: 'var(--color-slate)' }}>
            {touched.slice(0, 4).map(([m]) => muscleLabel(m)).join(', ')}
            {touched.length > 4 ? ` e altri ${touched.length - 4}` : ''}
          </p>
        </div>
      )}

      {picking && (
        <ExercisePicker
          index={index}
          custom={custom}
          onPick={addExercise}
          onCreate={createCustom}
          onUpdate={exerciseApi.update}
          onDelete={exerciseApi.remove}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

function ExerciseCard({ item, index, onPatch, menu }) {
  const ex = resolveExercise(item, index)
  const sets = item.sets || []
  const issue = itemIssue(item, index)
  const uniform = sets.length > 0 && sets.every(s => s.reps === sets[0].reps && s.kg === sets[0].kg && s.sec === sets[0].sec)
  const [detail, setDetail] = useState(false)
  const perSet = detail || !uniform

  const setSets = (next) => onPatch({ sets: next })
  const patchSet = (i, patch) => setSets(sets.map((s, k) => (k === i ? { ...s, ...patch } : s)))
  const addSet = () => setSets([...sets, sets.length ? { ...sets[sets.length - 1] } : emptySet(ex.mode)])
  const removeSet = (i) => setSets(sets.filter((_, k) => k !== i))
  // Serie uguali: cambiare il numero copia la prima; cambiare un valore lo scrive su tutte.
  const setCount = (n) => {
    const base = sets[0] || emptySet(ex.mode)
    setSets(Array.from({ length: n }, (_, k) => sets[k] || { ...base }))
  }
  const patchAll = (patch) => setSets(sets.map(s => ({ ...s, ...patch })))

  const timeMode = ex.mode === 'time'
  const kgMode = ex.mode === 'reps-kg'

  return (
    <div className="rounded-2xl p-3 space-y-3" style={{ background: 'var(--color-surface-2)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{ex.name}</p>
          <p className="text-[11px]" style={{ color: 'var(--color-slate)' }}>
            {ex.equipment} · <span style={{ color: 'var(--color-amber)' }}>{ex.primary.map(muscleLabel).join(', ') || '—'}</span>
          </p>
        </div>
        <div className="shrink-0 -mt-1 -mr-1">{menu}</div>
      </div>

      {!perSet ? (
        <div className="flex items-end gap-2">
          <Field label="Serie">
            <NumberBox value={sets.length} onChange={v => setCount(Math.max(1, Math.min(LIMITS.sets.max, Math.round(v || 1))))} min={1} max={LIMITS.sets.max} />
          </Field>
          <span className="pb-3 text-xs" style={{ color: 'var(--color-slate)' }}>×</span>
          {timeMode ? (
            <Field label="Secondi">
              <NumberBox value={sets[0]?.sec} onChange={v => patchAll({ sec: v })} min={LIMITS.sec.min} max={LIMITS.sec.max} />
            </Field>
          ) : (
            <Field label="Rip.">
              <NumberBox value={sets[0]?.reps} onChange={v => patchAll({ reps: v })} min={LIMITS.reps.min} max={LIMITS.reps.max} />
            </Field>
          )}
          {kgMode && (
            <>
              <span className="pb-3 text-xs" style={{ color: 'var(--color-slate)' }}>@</span>
              <Field label="Kg">
                <NumberBox value={sets[0]?.kg} onChange={v => patchAll({ kg: v })} min={LIMITS.kg.min} max={LIMITS.kg.max} step={LIMITS.kg.step} placeholder="—" />
              </Field>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {sets.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 text-[11px] text-center" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>{i + 1}</span>
              {timeMode ? (
                <NumberBox value={s.sec} onChange={v => patchSet(i, { sec: v })} min={LIMITS.sec.min} max={LIMITS.sec.max} suffix="sec" />
              ) : (
                <NumberBox value={s.reps} onChange={v => patchSet(i, { reps: v })} min={LIMITS.reps.min} max={LIMITS.reps.max} suffix="rip." />
              )}
              {kgMode && (
                <NumberBox value={s.kg} onChange={v => patchSet(i, { kg: v })} min={LIMITS.kg.min} max={LIMITS.kg.max} step={LIMITS.kg.step} suffix="kg" placeholder="—" />
              )}
              <button onClick={() => removeSet(i)} aria-label="Elimina serie" disabled={sets.length <= 1}
                className="w-7 h-7 rounded-full text-xs shrink-0"
                style={{ color: 'var(--color-slate)', background: 'var(--color-surface)', opacity: sets.length <= 1 ? 0.3 : 1 }}>
                ✕
              </button>
            </div>
          ))}
          <button onClick={addSet} disabled={sets.length >= LIMITS.sets.max}
            className="w-full py-2 rounded-xl text-xs font-semibold"
            style={{ color: 'var(--color-teal)', border: '1px dashed var(--color-teal-dark)', fontFamily: 'var(--font-display)' }}>
            + Serie
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        {uniform ? (
          <button onClick={() => setDetail(d => !d)} className="text-[11px]" style={{ color: 'var(--color-teal)' }}>
            {detail ? '▾ Serie uguali' : '▸ Serie diverse'}
          </button>
        ) : <span className="text-[11px]" style={{ color: 'var(--color-slate)' }}>Serie diverse</span>}
        {issue && <span className="text-[11px]" style={{ color: 'var(--color-loss)' }}>⚠ {issue}</span>}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex-1 min-w-0">
      <label className="text-[11px] mb-1 block" style={{ color: 'var(--color-slate)' }}>{label}</label>
      {children}
    </div>
  )
}

function NumberBox({ value, onChange, min, max, step = 1, placeholder, suffix }) {
  return (
    <div className="relative flex-1 min-w-0">
      <input
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        min={min} max={max} step={step}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="w-full p-3 rounded-xl text-sm outline-none text-center"
        style={{ background: 'var(--color-surface)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-mono)', paddingRight: suffix ? 34 : undefined }}
      />
      {suffix && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none" style={{ color: 'var(--color-slate)' }}>
          {suffix}
        </span>
      )}
    </div>
  )
}

// Menu ⋮ con le azioni sull'elemento. Il velo trasparente a tutto schermo
// chiude il menu al tap fuori, senza listener globali (stesso di WorkoutEditor).
function Menu({ open, onToggle, onClose, actions }) {
  return (
    <div className="relative">
      <button onClick={onToggle} aria-label="Azioni"
        className="w-8 h-8 flex items-center justify-center text-lg font-bold rounded-full"
        style={{ color: 'var(--color-white)' }}>
        ⋮
      </button>
      {open && (
        <>
          <button aria-label="Chiudi menu" className="fixed inset-0 z-10 cursor-default" onClick={onClose} />
          <div className="absolute right-0 top-9 z-20 rounded-xl overflow-hidden min-w-40"
               style={{ background: 'var(--color-surface)', border: '1px solid var(--color-teal-dark)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
            {actions.map(a => (
              <button key={a.label} onClick={a.onClick}
                className="w-full text-left px-4 py-2.5 text-sm"
                style={{ color: a.danger ? 'var(--color-loss)' : 'var(--color-white)', fontFamily: 'var(--font-display)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
