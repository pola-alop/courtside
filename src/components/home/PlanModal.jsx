import { useState } from 'react'
import {
  KIND_META, planConflict, plansOnDay, planStatusLabel, planSubject, keyToDay, dayKey,
} from '../../lib/calendar'
import { todayTime } from '../../lib/activity'
import { MATCH_TYPES, SURFACES, surfaceIcon } from '../../lib/tennis'
import { DEFAULT_BLOCK_MINUTES, formatMinutes, focusLabel, recentFocusIds } from '../../lib/training'
import { sortWorkoutsByUse as sortRunWorkouts } from '../../lib/running'
import { sortWorkoutsByUse as sortGymWorkouts } from '../../lib/gym'
import FocusPicker from '../trainings/FocusPicker'
import OpponentSearchField from '../matches/OpponentSearchField'

// La modale dei programmi: l'unica "di proprietà" della Home, perché i
// programmi esistono solo qui (le sessioni invece vivono in Matches e la Home
// ci arriva con i deep link).
//
//  · nuovo programma: scelta del tipo e, sotto, i campi di quel tipo su una
//    schermata sola — un programma è un promemoria, non una sessione da
//    registrare, e un wizard a passi costerebbe più di quanto vale;
//  · programma esistente: vista con lo stato ricavato (fatto / da fare / non
//    svolto), Registra, Modifica ed Elimina con conferma. "Registra" c'è solo
//    per ciò che non è ancora fatto, oggi o in un giorno passato
//    (`plan.registrable`): apre il wizard della sessione precompilato, che è
//    di Matches — la pagina decide dove portare (`onRegister`).
//
// Obbligatori sono solo il tipo, il giorno (da oggi in avanti) e, per il
// tennis, l'orario d'inizio: il campo e la lezione si prenotano a un'ora, la
// corsa e la palestra si fanno "quando capita". Tutto il resto è facoltativo:
// l'avversario può essere ancora da definire (il tabellone non è uscito), la
// corsa può essere senza scheda.
//
// Il riposo esclude gli altri programmi nei due versi (`planConflict`): i tipi
// in conflitto sono spenti, e spostare un programma su un giorno che non lo
// accetta blocca il salvataggio con il motivo scritto.

const TENNIS_KINDS = ['match', 'training']
const OTHER_KINDS  = ['run', 'gym', 'rest']

// Stesso passo dello stepper del wizard allenamento: le sessioni reali si
// organizzano a quarti d'ora.
const MINUTE_STEP = 15
const MAX_MINUTES = 300

const CONFLICT_TEXT = {
  'rest-day': 'Questo giorno è di riposo: elimina il riposo per programmare altro.',
  'day-busy': 'C\'è già qualcosa in programma: il riposo esclude gli altri programmi.',
}

function initialForm(date, plan) {
  const d = plan?.details || {}
  return {
    date:       plan?.date || date,
    time:       plan?.time || '',
    kind:       plan?.kind || null,
    notes:      plan?.notes || '',
    opponentId: plan?.kind === 'match' ? d.opponentId || null : null,
    surface:    d.surface || null,
    type:       d.type || 'amichevole',
    eventName:  d.eventName || '',
    minutes:    d.minutes || DEFAULT_BLOCK_MINUTES,
    withWhomLabel:      d.withWhom?.label || '',
    withWhomOpponentId: d.withWhom?.opponentId || null,
    focus:      d.focus ? [...d.focus] : [],
    workoutId:  d.workoutId || null,
  }
}

export default function PlanModal({
  date, plan = null, plans = [], opponents = [], runWorkouts = [], gymWorkouts = [],
  trainings = [], runs = [], gymSessions = [], onSave, onDelete, onRegister, onClose,
}) {
  // view | form | confirmDelete
  const [mode, setMode]     = useState(plan ? 'view' : 'form')
  const [form, setForm]     = useState(() => initialForm(date, plan))
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const names = { opponents, runWorkouts, gymWorkouts }

  const todayKey = dayKey(todayTime())
  const dayOfForm = plansOnDay(plans, form.date)
  const conflictFor = (kind) => planConflict(dayOfForm, kind, plan?.id ?? null)
  const conflict = form.kind ? conflictFor(form.kind) : null
  // Un programma non si sposta nel passato; quello che ci sta già (un non
  // svolto della settimana corrente) può però restare dov'è.
  const dateOk = keyToDay(form.date) != null && (form.date >= todayKey || form.date === plan?.date)
  const needsTime = TENNIS_KINDS.includes(form.kind)
  const valid = Boolean(form.kind) && dateOk && !conflict && (!needsTime || Boolean(form.time))

  const handleSave = async () => {
    if (!valid || saving) return
    setSaving(true)
    await onSave(toPlanDoc(form, opponents, runWorkouts, gymWorkouts), plan?.id ?? null)
    setSaving(false)
    onClose()
  }

  const handleDelete = async () => {
    if (saving) return
    setSaving(true)
    await onDelete(plan.id)
    setSaving(false)
    onClose()
  }

  const title = mode === 'view'
    ? KIND_META[plan.kind]?.label || 'Programma'
    : plan ? 'Modifica programma' : 'Nuovo programma'

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
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs first-letter:uppercase" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                {dayTitle(mode === 'view' ? plan.date : form.date)}
              </p>
              <h2 className="text-lg font-bold mt-0.5 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-white)' }}>
                {mode === 'view' && <span>{KIND_META[plan.kind]?.icon}</span>}
                <span className="truncate">{title}</span>
              </h2>
              {mode === 'view' && <StatusBadge plan={plan} />}
            </div>
            <button onClick={onClose}
                    className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-lg"
                    style={{ color: 'var(--color-slate)', background: 'var(--color-surface-2)' }}>
              ✕
            </button>
          </div>
        </div>

        {/* Corpo scrollabile */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {mode === 'view' && (
            <>
              {plan.registrable && onRegister && (
                <button
                  onClick={() => onRegister(plan)}
                  className="w-full mb-2 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
                  style={{ background: 'var(--color-amber)', color: 'var(--color-bg)', fontFamily: 'var(--font-display)' }}>
                  ✅ Registra {KIND_META[plan.kind]?.label.toLowerCase()}
                </button>
              )}

              <button
                onClick={() => setMode('form')}
                className="w-full mb-4 py-2.5 rounded-2xl text-xs font-semibold transition-all"
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal)', fontFamily: 'var(--font-display)', border: '1px solid var(--color-teal-dark)' }}>
                ✏️ Modifica programma
              </button>

              <PlanSummary plan={plan} names={names} />

              <div className="mt-6 pb-2">
                <button
                  onClick={() => setMode('confirmDelete')}
                  className="w-full py-3 rounded-2xl text-sm font-semibold transition-all"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-loss)', fontFamily: 'var(--font-display)', border: '1px solid var(--color-loss-bg)' }}>
                  🗑️ Elimina programma
                </button>
              </div>
            </>
          )}

          {mode === 'confirmDelete' && (
            <div className="pt-2">
              <ConfirmBox
                message="Eliminare questo programma? L'azione non può essere annullata."
                confirmLabel={saving ? 'Elimino...' : 'Elimina'}
                onCancel={() => setMode('view')}
                onConfirm={handleDelete}
              />
            </div>
          )}

          {mode === 'form' && (
            <PlanForm
              form={form} set={set} setForm={setForm}
              todayKey={todayKey} dateOk={dateOk} conflict={conflict} conflictFor={conflictFor}
              opponents={opponents}
              runWorkouts={sortRunWorkouts(runWorkouts, runs)}
              gymWorkouts={sortGymWorkouts(gymWorkouts, gymSessions)}
              recentFocus={recentFocusIds(trainings)}
            />
          )}
        </div>

        {/* Footer: solo nel modulo */}
        {mode === 'form' && (
          <div className="px-6 py-4 shrink-0 flex gap-2" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
            {plan && (
              <button onClick={() => { setForm(initialForm(date, plan)); setMode('view') }}
                className="px-5 py-4 rounded-2xl text-sm font-medium"
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
                Annulla
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!valid || saving}
              className="flex-1 py-4 rounded-2xl font-semibold text-sm transition-all active:scale-95"
              style={{
                background: (!valid || saving) ? 'var(--color-surface-2)' : 'var(--color-amber)',
                color:      (!valid || saving) ? 'var(--color-slate)'     : 'var(--color-bg)',
                fontFamily: 'var(--font-display)'
              }}>
              {saving ? 'Salvataggio...' : plan ? 'Salva modifiche' : 'Salva programma'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Modulo ─────────────────────────────────────────────────

function PlanForm({ form, set, setForm, todayKey, dateOk, conflict, conflictFor, opponents, runWorkouts, gymWorkouts, recentFocus }) {
  const typeMeta = MATCH_TYPES.find(t => t.id === form.type)
  const needsTime = TENNIS_KINDS.includes(form.kind)

  return (
    <div className="space-y-5">
      <Field label="Cosa">
        <p className="text-[11px] mb-1.5" style={{ color: 'var(--color-slate)' }}>🎾 Tennis</p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {TENNIS_KINDS.map(k => (
            <KindButton key={k} kind={k} active={form.kind === k} disabled={Boolean(conflictFor(k))} onClick={() => set('kind', k)} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {OTHER_KINDS.map(k => (
            <KindButton key={k} kind={k} active={form.kind === k} disabled={Boolean(conflictFor(k))} onClick={() => set('kind', k)} />
          ))}
        </div>
        {conflict && (
          <p className="text-xs mt-2" style={{ color: 'var(--color-loss)' }}>{CONFLICT_TEXT[conflict]}</p>
        )}
        {!form.kind && (conflictFor('match') || conflictFor('rest')) && (
          <p className="text-xs mt-2" style={{ color: 'var(--color-slate)' }}>
            {CONFLICT_TEXT[conflictFor('match') || conflictFor('rest')]}
          </p>
        )}
      </Field>

      {form.kind && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Giorno">
              <input type="date" value={form.date} min={todayKey}
                onChange={e => set('date', e.target.value)}
                className="w-full p-3 rounded-xl text-sm outline-none"
                style={inputStyle(!dateOk)} />
            </Field>
            {form.kind !== 'rest' && (
              <Field label={needsTime ? 'Orario *' : 'Orario'}>
                <input type="time" value={form.time}
                  onChange={e => set('time', e.target.value)}
                  className="w-full p-3 rounded-xl text-sm outline-none"
                  style={inputStyle(false)} />
              </Field>
            )}
          </div>
          {!dateOk && (
            <p className="text-xs -mt-3" style={{ color: 'var(--color-loss)' }}>Si programma da oggi in avanti.</p>
          )}

          {form.kind === 'match' && (
            <>
              <Field label="Avversario" sub="Facoltativo — può essere ancora da definire">
                {opponents.length > 0 ? (
                  <OpponentSearchField
                    opponents={opponents}
                    valueId={form.opponentId}
                    onSelect={o => set('opponentId', o.id)}
                    onClear={() => set('opponentId', null)}
                  />
                ) : (
                  <p className="text-xs" style={{ color: 'var(--color-slate)' }}>
                    Nessun avversario in anagrafica: lo aggiungi quando registri la partita.
                  </p>
                )}
              </Field>

              <Field label="Tipo">
                <div className="grid grid-cols-3 gap-2">
                  {MATCH_TYPES.map(t => (
                    <Chip key={t.id} active={form.type === t.id} onClick={() => set('type', t.id)}>{t.label}</Chip>
                  ))}
                </div>
                {typeMeta?.needsEvent && (
                  <input type="text" value={form.eventName}
                    onChange={e => set('eventName', e.target.value)}
                    placeholder={form.type === 'torneo' ? 'Nome del torneo' : 'Nome del campionato'}
                    className="w-full p-3 rounded-xl text-sm outline-none mt-2"
                    style={inputStyle(false)} />
                )}
              </Field>

              <SurfaceField value={form.surface} onChange={v => set('surface', v)} />
            </>
          )}

          {form.kind === 'training' && (
            <>
              <Field label="Durata prevista">
                <div className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: 'var(--color-surface-2)' }}>
                  <StepButton disabled={form.minutes <= MINUTE_STEP}
                    onClick={() => set('minutes', Math.max(MINUTE_STEP, form.minutes - MINUTE_STEP))}>−</StepButton>
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
                    {formatMinutes(form.minutes)}
                  </span>
                  <StepButton disabled={form.minutes >= MAX_MINUTES}
                    onClick={() => set('minutes', Math.min(MAX_MINUTES, form.minutes + MINUTE_STEP))}>+</StepButton>
                </div>
              </Field>

              <SurfaceField value={form.surface} onChange={v => set('surface', v)} />

              <Field label="Con chi">
                <input type="text" value={form.withWhomLabel}
                  onChange={e => setForm(f => ({ ...f, withWhomLabel: e.target.value, withWhomOpponentId: null }))}
                  placeholder="Es. maestro Luca, muro, da solo..."
                  className="w-full p-3 rounded-xl text-sm outline-none"
                  style={inputStyle(false)} />
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
              </Field>

              <Field label="Focus" sub="Facoltativo — su cosa vuoi lavorare">
                <FocusPicker value={form.focus} recent={recentFocus} onChange={v => set('focus', v)} />
              </Field>
            </>
          )}

          {form.kind === 'run' && (
            <WorkoutField workouts={runWorkouts} value={form.workoutId} onChange={v => set('workoutId', v)}
              empty="Nessuna scheda di corsa in libreria: la crei da + Allenamento › Corsa." />
          )}

          {form.kind === 'gym' && (
            <WorkoutField workouts={gymWorkouts} value={form.workoutId} onChange={v => set('workoutId', v)}
              empty="Nessuna scheda di palestra in libreria: la crei da + Allenamento › Palestra." />
          )}

          <Field label="Nota">
            <textarea value={form.notes} rows={2}
              onChange={e => set('notes', e.target.value)}
              placeholder="Facoltativa"
              className="w-full p-3 rounded-xl text-sm outline-none resize-none"
              style={inputStyle(false)} />
          </Field>
        </>
      )}
    </div>
  )
}

// ── Vista ──────────────────────────────────────────────────

function PlanSummary({ plan, names }) {
  const d = plan.details || {}
  const subject = planSubject(plan, names)
  const rows = []

  if (plan.time) rows.push(['Orario', plan.time])
  if (plan.kind === 'match') {
    rows.push(['Avversario', subject || 'Da definire'])
    const type = MATCH_TYPES.find(t => t.id === d.type)?.label
    if (type) rows.push(['Tipo', d.eventName ? `${type} · ${d.eventName}` : type])
  }
  if (plan.kind === 'training') {
    if (d.minutes) rows.push(['Durata prevista', formatMinutes(d.minutes)])
    if (subject) rows.push(['Con chi', subject])
  }
  if (plan.kind === 'run' || plan.kind === 'gym') {
    rows.push(['Scheda', subject || 'Nessuna'])
  }
  if (d.surface) rows.push(['Superficie', `${surfaceIcon(d.surface)} ${cap(d.surface)}`])

  const focus = plan.kind === 'training' ? (d.focus || []) : []

  return (
    <div className="space-y-4">
      {rows.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span className="text-xs shrink-0" style={{ color: 'var(--color-slate)' }}>{label}</span>
              <span className="text-xs font-medium text-right break-words min-w-0" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {focus.length > 0 && (
        <div>
          <SubTitle>Focus</SubTitle>
          <div className="flex flex-wrap gap-1.5">
            {focus.map(id => (
              <span key={id} className="text-[11px] px-2 py-1 rounded-full"
                    style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal-light)', fontFamily: 'var(--font-display)' }}>
                {focusLabel(id)}
              </span>
            ))}
          </div>
        </div>
      )}

      {plan.notes && (
        <div>
          <SubTitle>Nota</SubTitle>
          <p className="text-sm whitespace-pre-wrap rounded-2xl px-4 py-3"
             style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)' }}>
            {plan.notes}
          </p>
        </div>
      )}

      {plan.kind === 'rest' && rows.length === 0 && !plan.notes && (
        <p className="text-sm text-center" style={{ color: 'var(--color-slate)' }}>
          Giorno di riposo: niente sessioni in programma.
        </p>
      )}
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

function StatusBadge({ plan }) {
  const tone = {
    done:   { color: 'var(--color-win)',  bg: 'var(--color-win-bg)' },
    missed: { color: 'var(--color-loss)', bg: 'var(--color-loss-bg)' },
  }[plan.status] || { color: 'var(--color-teal)', bg: 'var(--color-week-bg)' }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full mt-2"
          style={{ background: tone.bg, color: tone.color, fontFamily: 'var(--font-display)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone.color }} />
      {planStatusLabel(plan)}
    </span>
  )
}

function KindButton({ kind, active, disabled, onClick }) {
  const meta = KIND_META[kind]
  return (
    <button onClick={onClick} disabled={disabled}
      className="py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all"
      style={{
        background: active ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
        color:      active ? 'var(--color-white)' : 'var(--color-slate)',
        border:     active ? `1px solid ${kind === 'match' ? 'var(--color-amber)' : 'var(--color-teal)'}` : '1px solid transparent',
        opacity:    disabled ? 0.35 : 1,
        fontFamily: 'var(--font-display)'
      }}>
      <span>{meta.icon}</span>
      <span>{meta.label}</span>
    </button>
  )
}

function SurfaceField({ value, onChange }) {
  return (
    <Field label="Superficie">
      <div className="grid grid-cols-4 gap-2">
        {SURFACES.map(s => (
          <Chip key={s} active={value === s} onClick={() => onChange(value === s ? null : s)}>
            <span className="block">{surfaceIcon(s)}</span>
            <span className="block capitalize text-[11px]">{s}</span>
          </Chip>
        ))}
      </div>
    </Field>
  )
}

function WorkoutField({ workouts, value, onChange, empty }) {
  return (
    <Field label="Scheda" sub="Facoltativa">
      {workouts.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--color-slate)' }}>{empty}</p>
      ) : (
        <div className="space-y-2">
          {[{ id: null, name: 'Nessuna scheda' }, ...workouts].map(w => {
            const active = value === w.id
            return (
              <button key={w.id ?? 'none'}
                onClick={() => onChange(w.id)}
                className="w-full text-left rounded-xl px-3 py-2.5 text-sm transition-all"
                style={{
                  background: active ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                  border:     active ? '1px solid var(--color-teal)' : '1px solid transparent',
                  color:      active ? 'var(--color-white)' : w.id ? 'var(--color-white)' : 'var(--color-slate)',
                  fontFamily: 'var(--font-display)',
                }}>
                {w.name || '—'}
              </button>
            )
          })}
        </div>
      )}
    </Field>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className="py-2.5 rounded-xl text-xs font-semibold text-center transition-all"
      style={{
        background: active ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
        color:      active ? 'var(--color-white)' : 'var(--color-slate)',
        border:     active ? '1px solid var(--color-teal)' : '1px solid transparent',
        fontFamily: 'var(--font-display)'
      }}>
      {children}
    </button>
  )
}

function StepButton({ disabled, onClick, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-9 h-9 rounded-full text-lg font-semibold"
      style={{ background: 'var(--color-surface)', color: disabled ? 'var(--color-slate)' : 'var(--color-teal)', opacity: disabled ? 0.5 : 1 }}>
      {children}
    </button>
  )
}

function Field({ label, sub, children }) {
  return (
    <div>
      <SubTitle>{label}</SubTitle>
      {sub && <p className="text-[11px] -mt-1 mb-2" style={{ color: 'var(--color-slate)' }}>{sub}</p>}
      {children}
    </div>
  )
}

function SubTitle({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider mb-2"
       style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
      {children}
    </p>
  )
}

function ConfirmBox({ message, confirmLabel, onCancel, onConfirm }) {
  return (
    <div className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-surface-2)' }}>
      <p className="text-sm mb-3 text-center" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{message}</p>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
          Annulla
        </button>
        <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--color-loss)', color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

// Il documento da salvare: `details` cambia con il tipo e si riscrive per
// intero, così cambiare un allenamento in corsa non lascia campi orfani. I nomi
// copiati (avversario, scheda) sono solo il ripiego di `planSubject` se
// l'anagrafica o la scheda sparissero.
function toPlanDoc(form, opponents, runWorkouts, gymWorkouts) {
  const kind = form.kind
  let details = {}
  if (kind === 'match') {
    const meta = MATCH_TYPES.find(t => t.id === form.type)
    details = {
      opponentId:   form.opponentId || null,
      opponentName: opponents.find(o => o.id === form.opponentId)?.name || null,
      surface:      form.surface || null,
      type:         form.type,
      eventName:    meta?.needsEvent ? form.eventName.trim() || null : null,
    }
  } else if (kind === 'training') {
    const label = form.withWhomLabel.trim()
    details = {
      minutes:  form.minutes,
      surface:  form.surface || null,
      withWhom: label ? { label, opponentId: form.withWhomOpponentId } : null,
      focus:    form.focus,
    }
  } else if (kind === 'run' || kind === 'gym') {
    const list = kind === 'run' ? runWorkouts : gymWorkouts
    details = {
      workoutId:   form.workoutId || null,
      workoutName: list.find(w => w.id === form.workoutId)?.name || null,
    }
  }
  return {
    date:  form.date,
    // Il riposo dura tutto il giorno: un orario non avrebbe senso.
    time:  kind === 'rest' ? null : form.time || null,
    kind,
    details,
    notes: form.notes.trim() || null,
  }
}

function inputStyle(invalid) {
  return {
    background: 'var(--color-surface-2)', color: 'var(--color-white)',
    border: `1px solid ${invalid ? 'var(--color-loss)' : 'transparent'}`,
    fontFamily: 'var(--font-body)',
  }
}

function dayTitle(key) {
  const time = keyToDay(key)
  if (time == null) return ''
  return new Date(time).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
}

function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : ''
}
