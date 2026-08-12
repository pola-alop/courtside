import { useState } from 'react'
import { SURFACES, surfaceIcon } from '../../lib/tennis'
import {
  TRAINING_KINDS, INTENSITIES, emptyBlock, totalMinutes, normalizeBlocks,
  normalizeRatings, formatMinutes, recentFocusIds,
} from '../../lib/training'
import { trainingGameEquivalents } from '../../lib/wear'
import FocusPicker from './FocusPicker'

// Wizard volutamente CORTO (3 step, contro i 7 del match): una partita è un
// evento raro e memorabile, un allenamento è settimanale e ripetitivo. Se
// registrarlo costa quanto registrare un match si smette di farlo dopo tre
// settimane — e allora l'usura dell'attrezzatura si sbilancia (le partite
// continuano a contare, gli allenamenti no), che è peggio del non averli affatto.
// Tutto il resto (dati atletici, valutazioni per colpo, note) si aggiunge dopo,
// dal dettaglio, esattamente come le note degli avversari.
const STEPS = ['Sessione', 'Focus', 'Dettagli']

const EQUIP_TYPES = [
  { id: 'racchetta', label: 'Racchetta', icon: '🎾' },
  { id: 'scarpa',    label: 'Scarpe',    icon: '👟' },
  { id: 'outfit',    label: 'Outfit',    icon: '👕' },
  { id: 'borsone',   label: 'Borsone',   icon: '🎒' },
]

// Passo dello stepper dei minuti: le sessioni reali si organizzano a quarti
// d'ora, non al minuto.
const MINUTE_STEP = 15
const MAX_BLOCK_MINUTES = 300

function initialForm(initial) {
  return {
    date:       initial?.date ? initial.date.split('T')[0] : new Date().toISOString().split('T')[0],
    blocks:     initial?.blocks?.length ? initial.blocks.map(b => ({ ...b })) : [emptyBlock()],
    surface:    initial?.surface || null,
    focus:      initial?.focus ? [...initial.focus] : [],
    intensity:  initial?.intensity || 'media',
    withWhomLabel:      initial?.withWhom?.label || '',
    withWhomOpponentId: initial?.withWhom?.opponentId || null,
    equipment:  { racchetta: null, scarpa: null, outfit: null, borsone: null, ...(initial?.equipment || {}) },
    brokeStrings: Boolean(initial?.brokeStrings),
  }
}

export default function AddTrainingModal({ initial = null, opponents = [], equipment = [], trainings = [], onClose, onSave }) {
  const [step, setStep]     = useState(1)
  const [form, setForm]     = useState(() => initialForm(initial))
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // I focus recenti si calcolano dallo storico, escludendo la sessione che si
  // sta modificando (altrimenti si suggerirebbe da sé).
  const recent = recentFocusIds(trainings.filter(t => t.id !== initial?.id))

  const minutes = totalMinutes(form.blocks)

  const stepValid = (() => {
    switch (step) {
      case 1: return Boolean(form.date) && Boolean(form.surface) && normalizeBlocks(form.blocks).length > 0
      // Focus e dettagli sono facoltativi: bloccare qui significherebbe
      // impedire di registrare una sessione "al volo".
      default: return true
    }
  })()

  const isLast = step === STEPS.length
  const goNext = () => { if (stepValid) setStep(s => Math.min(s + 1, STEPS.length)) }
  const goBack = () => setStep(s => Math.max(s - 1, 1))

  const handleSave = async () => {
    if (!stepValid || saving) return
    setSaving(true)
    const label = form.withWhomLabel.trim()
    await onSave({
      date:      new Date(form.date).toISOString(),
      blocks:    normalizeBlocks(form.blocks),
      surface:   form.surface,
      focus:     form.focus,
      // Le valutazioni si danno dal dettaglio, ma vanno preservate in modifica —
      // scartando quelle rimaste orfane se un colpo è stato tolto dal focus.
      ratings:   normalizeRatings(initial?.ratings, form.focus),
      intensity: form.intensity,
      withWhom:  label ? { label, opponentId: form.withWhomOpponentId } : null,
      brokeStrings: form.brokeStrings,
      equipment: form.equipment,
      athletics: initial?.athletics ?? null,
      notes:     initial?.notes || [],
    })
    setSaving(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(2,13,25,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-3xl flex flex-col"
           style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)', maxHeight: '88vh' }}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 shrink-0" style={{ borderBottom: '1px solid var(--color-surface-2)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {step > 1 && (
                <button onClick={goBack} className="text-sm font-medium" style={{ color: 'var(--color-teal)' }}>
                  ← Indietro
                </button>
              )}
              <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-white)' }}>
                {initial ? 'Modifica allenamento' : 'Nuovo allenamento'}
              </h2>
            </div>
            <button onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-lg"
                    style={{ color: 'var(--color-slate)', background: 'var(--color-surface-2)' }}>
              ✕
            </button>
          </div>
          <StepIndicator step={step} />
        </div>

        {/* Corpo scrollabile */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {step === 1 && <StepSession form={form} set={set} setForm={setForm} minutes={minutes} />}
          {step === 2 && (
            <div className="space-y-4">
              <StepTitle title="Su cosa hai lavorato?"
                         sub="Facoltativo — colpi e schemi allenati in questa sessione" />
              <FocusPicker value={form.focus} recent={recent} onChange={v => set('focus', v)} />
            </div>
          )}
          {step === 3 && (
            <StepDetails form={form} set={set} setForm={setForm} opponents={opponents} equipment={equipment} />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 shrink-0" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
          <button
            onClick={isLast ? handleSave : goNext}
            disabled={!stepValid || saving}
            className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-95"
            style={{
              background: (!stepValid || saving) ? 'var(--color-surface-2)' : 'var(--color-amber)',
              color:      (!stepValid || saving) ? 'var(--color-slate)'     : 'var(--color-bg)',
              fontFamily: 'var(--font-display)'
            }}>
            {saving ? 'Salvataggio...' : isLast ? (initial ? 'Salva modifiche' : 'Salva allenamento') : 'Avanti'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Step indicator ─────────────────────────────────────────

function StepIndicator({ step }) {
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((label, i) => {
        const n = i + 1
        const active = n === step
        const done = n < step
        return (
          <div key={label} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full h-1 rounded-full"
                 style={{ background: done || active ? 'var(--color-teal-dark)' : 'var(--color-surface-2)' }} />
            {active && (
              <span className="text-[10px] font-semibold" style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
                {n}. {label}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1 — Sessione (data, blocchi, superficie) ──────────

function StepSession({ form, set, setForm, minutes }) {
  const updateBlock = (i, patch) => setForm(f => {
    const blocks = f.blocks.map(b => ({ ...b }))
    blocks[i] = { ...blocks[i], ...patch }
    return { ...f, blocks }
  })
  const addBlock = () => setForm(f => ({ ...f, blocks: [...f.blocks, emptyBlock()] }))
  const removeBlock = (i) => setForm(f => ({ ...f, blocks: f.blocks.filter((_, k) => k !== i) }))

  return (
    <div className="space-y-4">
      <StepTitle title="Com'era strutturata la sessione?"
                 sub="Un allenamento reale è quasi sempre misto: aggiungi un blocco per ogni parte" />

      <div>
        <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Data</label>
        <input
          type="date"
          value={form.date}
          onChange={e => set('date', e.target.value)}
          className="w-full p-3 rounded-xl text-sm outline-none"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-body)', colorScheme: 'dark' }}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider"
             style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
            Blocchi
          </p>
          <span className="text-xs font-bold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
            {formatMinutes(minutes)}
          </span>
        </div>

        <div className="space-y-2">
          {form.blocks.map((b, i) => (
            <BlockRow
              key={i}
              block={b}
              canRemove={form.blocks.length > 1}
              onChange={patch => updateBlock(i, patch)}
              onRemove={() => removeBlock(i)}
            />
          ))}
        </div>

        <button onClick={addBlock}
          className="w-full mt-2 py-2.5 rounded-2xl text-xs font-semibold transition-all active:scale-95"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal)', fontFamily: 'var(--font-display)', border: '1px dashed var(--color-teal-dark)' }}>
          + Aggiungi blocco
        </button>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2"
           style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          Superficie
        </p>
        <div className="grid grid-cols-2 gap-2">
          {SURFACES.map(s => {
            const active = form.surface === s
            return (
              <button key={s}
                onClick={() => set('surface', s)}
                className="py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                style={{
                  background: active ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                  color:      active ? 'var(--color-white)' : 'var(--color-slate)',
                  border:     active ? '1px solid var(--color-teal)' : '1px solid transparent',
                  fontFamily: 'var(--font-display)'
                }}>
                <span>{surfaceIcon(s)}</span>
                <span className="capitalize">{s}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function BlockRow({ block, canRemove, onChange, onRemove }) {
  const minutes = Number(block.minutes) || 0
  const step = (delta) => onChange({ minutes: Math.max(0, Math.min(MAX_BLOCK_MINUTES, minutes + delta)) })

  return (
    <div className="rounded-2xl p-3 space-y-2" style={{ background: 'var(--color-surface-2)' }}>
      <div className="flex items-center gap-2">
        <select
          value={block.kind}
          onChange={e => onChange({ kind: e.target.value })}
          className="flex-1 min-w-0 p-2.5 rounded-xl text-xs outline-none"
          style={{ background: 'var(--color-surface)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-display)' }}>
          {TRAINING_KINDS.map(k => (
            <option key={k.id} value={k.id}>{k.icon} {k.label}</option>
          ))}
        </select>
        {canRemove && (
          <button onClick={onRemove} aria-label="Rimuovi blocco"
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0"
            style={{ background: 'var(--color-surface)', color: 'var(--color-loss)' }}>
            ✕
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => step(-MINUTE_STEP)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-base font-bold"
          style={{ background: 'var(--color-surface)', color: 'var(--color-white)' }}>−</button>
        <div className="flex items-baseline gap-1">
          <input
            type="number"
            inputMode="numeric"
            min={0} max={MAX_BLOCK_MINUTES} step={5}
            value={minutes || ''}
            placeholder="0"
            onChange={e => onChange({ minutes: e.target.value === '' ? 0 : Number(e.target.value) })}
            className="w-16 text-center p-2 rounded-xl text-sm outline-none"
            style={{ background: 'var(--color-surface)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-mono)' }}
          />
          <span className="text-xs" style={{ color: 'var(--color-slate)' }}>min</span>
        </div>
        <button onClick={() => step(MINUTE_STEP)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-base font-bold"
          style={{ background: 'var(--color-surface)', color: 'var(--color-white)' }}>+</button>
      </div>
    </div>
  )
}

// ── Step 3 — Dettagli (intensità, con chi, attrezzatura) ───

function StepDetails({ form, set, setForm, opponents, equipment }) {
  const activeEquipment = equipment.filter(e => e.active !== false)
  const hasAnyEquipment = EQUIP_TYPES.some(t => activeEquipment.some(e => e.type === t.id))

  const pickEquip = (type, id) => {
    setForm(f => ({ ...f, equipment: { ...f.equipment, [type]: f.equipment[type] === id ? null : id } }))
  }

  // Anteprima del consumo che questa sessione produrrà sull'attrezzatura:
  // rende visibile il legame allenamento → usura nel momento in cui si sceglie
  // l'intensità, invece di farlo scoprire settimane dopo in Equipment.
  const eq = trainingGameEquivalents({ blocks: form.blocks, intensity: form.intensity })

  return (
    <div className="space-y-4">
      <StepTitle title="Come è andata?" sub="Tutto facoltativo — puoi completarlo dopo dal dettaglio" />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2"
           style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          Intensità
        </p>
        <div className="grid grid-cols-3 gap-2">
          {INTENSITIES.map(i => {
            const active = form.intensity === i.id
            return (
              <button key={i.id}
                onClick={() => set('intensity', i.id)}
                className="py-3 rounded-2xl text-sm font-semibold transition-all"
                style={{
                  background: active ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                  color:      active ? 'var(--color-white)' : 'var(--color-slate)',
                  border:     active ? `1px solid ${i.color}` : '1px solid transparent',
                  fontFamily: 'var(--font-display)'
                }}>
                {i.label}
              </button>
            )
          })}
        </div>
        {(eq.strings > 0 || eq.shoes > 0) && (
          <p className="text-[11px] mt-2" style={{ color: 'var(--color-slate)' }}>
            Consumo stimato: <strong style={{ color: 'var(--color-teal)' }}>{Math.round(eq.strings)}</strong> game-eq sulle corde ·{' '}
            <strong style={{ color: 'var(--color-teal)' }}>{Math.round(eq.shoes)}</strong> sulla suola
          </p>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2"
           style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          Con chi
        </p>
        <input
          type="text"
          value={form.withWhomLabel}
          onChange={e => setForm(f => ({ ...f, withWhomLabel: e.target.value, withWhomOpponentId: null }))}
          placeholder="Es. maestro Luca, muro, da solo..."
          className="w-full p-3 rounded-xl text-sm outline-none"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-body)' }}
        />
        {opponents.length > 0 && (
          <>
            <p className="text-[11px] mt-2 mb-1.5" style={{ color: 'var(--color-slate)' }}>
              Oppure collega un avversario dell'anagrafica:
            </p>
            <OpponentSearchField
              opponents={opponents}
              valueId={form.withWhomOpponentId}
              onSelect={o => setForm(f => ({ ...f, withWhomOpponentId: o.id, withWhomLabel: o.name }))}
              onClear={() => setForm(f => ({ ...f, withWhomOpponentId: null, withWhomLabel: '' }))}
            />
          </>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2"
           style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          Attrezzatura usata
        </p>
        {!hasAnyEquipment ? (
          <div className="rounded-2xl px-4 py-4 text-center" style={{ background: 'var(--color-surface-2)' }}>
            <p className="text-sm" style={{ color: 'var(--color-slate)' }}>
              Nessuna attrezzatura in uso. Aggiungila nella sezione Equipment per collegarla agli allenamenti.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {EQUIP_TYPES.map(t => {
              const items = activeEquipment.filter(e => e.type === t.id)
              if (items.length === 0) return null
              return (
                <div key={t.id}>
                  <p className="text-[11px] mb-1.5" style={{ color: 'var(--color-slate)' }}>{t.icon} {t.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {items.map(e => {
                      const selected = form.equipment[t.id] === e.id
                      return (
                        <button key={e.id}
                          onClick={() => pickEquip(t.id, e.id)}
                          className="px-3 py-2 rounded-xl text-xs font-medium transition-all text-left"
                          style={{
                            background: selected ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                            border:     selected ? '1px solid var(--color-teal)' : '1px solid transparent',
                            fontFamily: 'var(--font-display)'
                          }}>
                          <span style={{ color: 'var(--color-white)' }}>{e.model || e.name || '—'}</span>
                          {e.nickname && (
                            <span className="block text-[11px] mt-0.5" style={{ color: 'var(--color-white)', opacity: 0.6 }}>
                              {e.nickname}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* In allenamento le corde si rompono molto più che in partita: segnarlo
          qui fa comparire il promemoria di reincordare nel dettaglio sessione */}
      <button
        onClick={() => set('brokeStrings', !form.brokeStrings)}
        className="w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left"
        style={{
          background: form.brokeStrings ? 'var(--color-loss-bg)' : 'var(--color-surface-2)',
          border: form.brokeStrings ? '1px solid var(--color-loss)' : '1px solid transparent',
        }}>
        <span className="text-lg">{form.brokeStrings ? '💥' : '🎾'}</span>
        <span className="text-sm font-semibold flex-1"
              style={{ color: form.brokeStrings ? 'var(--color-loss)' : 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
          Ho rotto le corde
        </span>
        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] shrink-0"
              style={{
                background: form.brokeStrings ? 'var(--color-loss)' : 'var(--color-surface)',
                color: 'var(--color-white)',
              }}>
          {form.brokeStrings ? '✓' : ''}
        </span>
      </button>
    </div>
  )
}

// Sostituisce le bubble con tutti gli avversari (non scala oltre una manciata
// di nomi) con una ricerca: box chiuso finché non si tocca, poi filtra man
// mano che si scrive, come lo step "Contro chi?" del wizard match.
function OpponentSearchField({ opponents, valueId, onSelect, onClear }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const selected = opponents.find(o => o.id === valueId)
  const query = search.trim().toLowerCase()
  const results = query ? opponents.filter(o => o.name.toLowerCase().includes(query)) : opponents

  if (selected) {
    return (
      <div className="w-full p-3 rounded-xl text-sm flex items-center justify-between"
           style={{ background: 'var(--color-teal-dark)', border: '1px solid var(--color-teal)' }}>
        <span style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{selected.name}</span>
        <button onClick={onClear} className="text-xs font-semibold" style={{ color: 'var(--color-teal-light)' }}>
          Rimuovi ✕
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Cerca avversario..."
        className="w-full p-3 rounded-xl text-sm outline-none"
        style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-body)' }}
      />
      {open && (
        <div className="absolute left-0 right-0 mt-1.5 rounded-xl overflow-y-auto z-10"
             style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-teal-dark)', maxHeight: '11rem' }}>
          {results.length === 0 ? (
            <p className="text-xs text-center py-3" style={{ color: 'var(--color-slate)' }}>Nessun avversario trovato.</p>
          ) : (
            results.map(o => (
              <button key={o.id}
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onSelect(o); setSearch(''); setOpen(false) }}
                className="w-full text-left px-3 py-2.5 text-sm transition-all"
                style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                {o.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Comuni ─────────────────────────────────────────────────

function StepTitle({ title, sub }) {
  return (
    <div>
      <p className="text-base font-bold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{title}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--color-slate)' }}>{sub}</p>}
    </div>
  )
}
