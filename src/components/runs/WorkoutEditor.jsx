import { useState } from 'react'
import {
  MAX_REPEAT_TIMES, emptyStep, emptyRepeat, cloneItem, stepTypeMeta,
  formatStepDuration, formatStepEstimate, formatTarget, stepIssue,
} from '../../lib/running'
import StepEditor from './StepEditor'
import WorkoutChart from './WorkoutChart'

// Editor della struttura di una scheda, sul modello della lista fasi di Garmin:
// card delle fasi con la barra del colore del tipo, gruppi "N volte" per le
// ripetute, e in fondo "Aggiungi fase" / "Aggiungi ripetuta". Toccare una fase
// apre la sua sotto-schermata (StepEditor) al posto della lista.
//
// Il riordino passa dal menu ⋮ (Sposta su / Sposta giù) invece che dal
// trascinamento: su mobile, senza una libreria dedicata, il drag dentro una
// modale scrollabile è fragile, e due tap fanno lo stesso lavoro. Si sposta
// dentro il proprio contenitore (lista principale o ripetuta).
//
// Componente controllato: `items` arriva dal chiamante, ogni modifica esce con
// `onChange(items)`. Gli elementi si indirizzano per `id`, mai per indice.
export default function WorkoutEditor({ items, running, onChange }) {
  const [editingId, setEditingId] = useState(null)
  const [menuId, setMenuId] = useState(null)

  const editingStep = editingId ? findStep(items, editingId) : null

  // Tornando alla lista si riporta in vista la card appena modificata: la
  // sotto-schermata la sostituisce, e senza questo si ricomincerebbe da capo.
  const closeStep = () => {
    const id = editingId
    setEditingId(null)
    requestAnimationFrame(() => {
      document.querySelector(`[data-step-id="${id}"]`)?.scrollIntoView({ block: 'center' })
    })
  }

  const addStep = () => {
    const step = emptyStep('corsa')
    onChange([...items, step])
    setEditingId(step.id)
  }
  const addRepeat = () => onChange([...items, emptyRepeat()])
  const addStepToRepeat = (repeatId) => {
    const step = emptyStep('corsa')
    onChange(items.map(it => (it.id === repeatId ? { ...it, steps: [...it.steps, step] } : it)))
    setEditingId(step.id)
  }
  const updateRepeat = (repeatId, patch) => onChange(items.map(it => (it.id === repeatId ? { ...it, ...patch } : it)))
  const updateStep = (id, patch) => onChange(mapSteps(items, s => (s.id === id ? { ...s, ...patch } : s)))
  const remove = (id) => { onChange(removeById(items, id)); setMenuId(null) }
  const duplicate = (id) => { onChange(duplicateById(items, id)); setMenuId(null) }
  const move = (id, dir) => { onChange(moveById(items, id, dir)); setMenuId(null) }

  // Sotto-schermata della fase
  if (editingStep) {
    return (
      <StepEditor
        step={editingStep}
        running={running}
        onChange={patch => updateStep(editingStep.id, patch)}
        onBack={closeStep}
        onRemove={() => { remove(editingStep.id); setEditingId(null) }}
      />
    )
  }

  const stepMenu = (id) => [
    { label: 'Modifica',    onClick: () => { setMenuId(null); setEditingId(id) } },
    { label: 'Duplica',     onClick: () => duplicate(id) },
    { label: 'Sposta su',   onClick: () => move(id, -1) },
    { label: 'Sposta giù',  onClick: () => move(id, 1) },
    { label: 'Elimina',     onClick: () => remove(id), danger: true },
  ]
  const repeatMenu = (id) => [
    { label: 'Aggiungi fase', onClick: () => { setMenuId(null); addStepToRepeat(id) } },
    { label: 'Duplica',       onClick: () => duplicate(id) },
    { label: 'Sposta su',     onClick: () => move(id, -1) },
    { label: 'Sposta giù',    onClick: () => move(id, 1) },
    { label: 'Elimina ripetuta', onClick: () => remove(id), danger: true },
  ]

  const renderStep = (step) => (
    <StepCard
      key={step.id}
      step={step}
      running={running}
      onClick={() => setEditingId(step.id)}
      menu={<Menu open={menuId === step.id} onToggle={() => setMenuId(m => (m === step.id ? null : step.id))}
                  onClose={() => setMenuId(null)} actions={stepMenu(step.id)} />}
    />
  )

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-3" style={{ background: 'var(--color-surface-2)' }}>
        <WorkoutChart items={items} running={running} />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider"
           style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          Fasi
        </p>

        {items.length === 0 && (
          <p className="text-sm text-center py-6" style={{ color: 'var(--color-slate)' }}>
            Nessuna fase: aggiungine una qui sotto.
          </p>
        )}

        {items.map(item => (
          item.kind === 'repeat' ? (
            <RepeatGroup
              key={item.id}
              repeat={item}
              onTimes={times => updateRepeat(item.id, { times })}
              onToggleSkip={() => updateRepeat(item.id, { skipLastRecovery: !item.skipLastRecovery })}
              onAddStep={() => addStepToRepeat(item.id)}
              menu={<Menu open={menuId === item.id} onToggle={() => setMenuId(m => (m === item.id ? null : item.id))}
                          onClose={() => setMenuId(null)} actions={repeatMenu(item.id)} />}
            >
              {item.steps.map(renderStep)}
            </RepeatGroup>
          ) : renderStep(item)
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={addStep}
          className="py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
          style={{ background: 'var(--color-draw)', color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          + Aggiungi fase
        </button>
        <button onClick={addRepeat}
          className="py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
          style={{ background: 'var(--color-draw)', color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          ↻ Aggiungi rip.
        </button>
      </div>
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

function StepCard({ step, running, onClick, menu }) {
  const meta = stepTypeMeta(step.stepType)
  const estimate = formatStepEstimate(step, running)
  const issue = stepIssue(step, running)
  return (
    <div data-step-id={step.id} className="relative flex rounded-xl overflow-visible" style={{ background: 'var(--color-surface-2)' }}>
      <span className="w-1.5 shrink-0 rounded-l-xl" style={{ background: meta.color }} />
      <button onClick={onClick} className="flex-1 min-w-0 text-left px-3 py-2.5">
        <p className="text-sm font-semibold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {meta.label}
        </p>
        <p className="text-xs" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          {formatStepDuration(step.duration)}
        </p>
        <p className="text-[11px] truncate" style={{ color: 'var(--color-slate)' }}>
          {formatTarget(step.target, running)}
        </p>
        {estimate && (
          <p className="text-[11px]" style={{ color: 'var(--color-slate)' }}>{estimate}</p>
        )}
        {step.notes && (
          <p className="text-[11px] italic truncate" style={{ color: 'var(--color-teal-light)' }}>{step.notes}</p>
        )}
        {issue && <p className="text-[11px]" style={{ color: 'var(--color-loss)' }}>⚠ {issue}</p>}
      </button>
      <div className="shrink-0 flex items-start pt-1.5 pr-1">{menu}</div>
    </div>
  )
}

function RepeatGroup({ repeat, onTimes, onToggleSkip, onAddStep, menu, children }) {
  const last = repeat.steps[repeat.steps.length - 1]
  const endsWithRecovery = repeat.steps.length > 1 && (last?.stepType === 'recupero' || last?.stepType === 'riposo')
  const times = repeat.times || 1

  return (
    <div className="rounded-2xl p-2.5 space-y-2" style={{ border: '1px solid rgba(255,255,255,0.14)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StepperButton onClick={() => onTimes(Math.max(1, times - 1))}>−</StepperButton>
          <span className="text-sm font-semibold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            {times} {times === 1 ? 'volta' : 'volte'}
          </span>
          <StepperButton onClick={() => onTimes(Math.min(MAX_REPEAT_TIMES, times + 1))}>+</StepperButton>
        </div>
        {menu}
      </div>

      {children}

      <button onClick={onAddStep}
        className="w-full py-2 rounded-xl text-xs font-semibold"
        style={{ color: 'var(--color-teal)', border: '1px dashed var(--color-teal-dark)', fontFamily: 'var(--font-display)' }}>
        + Fase nella ripetuta
      </button>

      {endsWithRecovery && (
        <button onClick={onToggleSkip} className="w-full text-left text-xs px-1 py-1" style={{ color: 'var(--color-slate)' }}>
          Salta l'ultima fase di {stepTypeMeta(last.stepType).label}:{' '}
          <span style={{ color: 'var(--color-draw)' }}>{repeat.skipLastRecovery ? 'Attivato' : 'Disattivato'}</span>
        </button>
      )}
    </div>
  )
}

function StepperButton({ onClick, children }) {
  return (
    <button onClick={onClick}
      className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
      style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)' }}>
      {children}
    </button>
  )
}

// Menu ⋮ con le azioni sull'elemento. Il velo trasparente a tutto schermo
// chiude il menu al tap fuori, senza listener globali.
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

// ── Helpers ────────────────────────────────────────────────

function findStep(items, id) {
  for (const it of items) {
    if (it.kind === 'repeat') {
      const s = it.steps.find(x => x.id === id)
      if (s) return s
    } else if (it.id === id) {
      return it
    }
  }
  return null
}

function mapSteps(items, fn) {
  return items.map(it => (it.kind === 'repeat' ? { ...it, steps: it.steps.map(fn) } : fn(it)))
}

// Una ripetuta che resta senza fasi sparisce: un "5 volte" vuoto non è niente.
function removeById(items, id) {
  return items
    .filter(it => it.id !== id)
    .map(it => (it.kind === 'repeat' ? { ...it, steps: it.steps.filter(s => s.id !== id) } : it))
    .filter(it => it.kind !== 'repeat' || it.steps.length > 0)
}

function duplicateById(items, id) {
  const out = []
  items.forEach(it => {
    if (it.id === id) { out.push(it, cloneItem(it)); return }
    if (it.kind === 'repeat' && it.steps.some(s => s.id === id)) {
      const steps = []
      it.steps.forEach(s => { steps.push(s); if (s.id === id) steps.push(cloneItem(s)) })
      out.push({ ...it, steps })
      return
    }
    out.push(it)
  })
  return out
}

function moveById(items, id, dir) {
  const swap = (arr) => {
    const i = arr.findIndex(x => x.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= arr.length) return arr
    const copy = [...arr]
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    return copy
  }
  if (items.some(it => it.id === id)) return swap(items)
  return items.map(it => (it.kind === 'repeat' && it.steps.some(s => s.id === id) ? { ...it, steps: swap(it.steps) } : it))
}
