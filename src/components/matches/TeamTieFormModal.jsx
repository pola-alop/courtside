import { useState } from 'react'
import {
  FORMULA_LIMITS, DEFAULT_FORMULA, TEAM_NAME_MAX_LENGTH,
  cleanTeamName, tieIssue, formulaText, formulaFloor, formulaBlockIssue,
} from '../../lib/teamTies'
import { ROUNDS } from '../../lib/tennis'
import { isFinalTie, legOf, readTotals, pairIssue, teamName, tieContext, TOTAL_MAX } from '../../lib/teamCompetitions'

// Crea o modifica uno scontro: squadra avversaria, data, casa/trasferta
// (facoltativo, si può togliere) e formula. In modifica la formula non può
// scendere sotto l'incontro più alto già usato (`floor`). Un campo obbligatorio
// vuoto resta vuoto e blocca il salvataggio: niente valori d'ufficio.
//
// Dentro una competizione (`competition` + `slot` per un nuovo scontro, oppure
// uno `tie` che ne fa già parte) cambia così:
//   girone  → la squadra è quella dello scontro del calendario (non si scrive),
//             la formula parte da quella della competizione e ci sono set e
//             game totali, facoltativi, per gli spareggi;
//   finale  → la squadra è testo libero (viene da un altro girone) e si sceglie
//             il turno.
// `slot`: { phase, opponentTeamId?, leg? }.
export default function TeamTieFormModal({ tie = null, competition = null, slot = null, matches = [], onClose, onSave }) {
  const phase = tie ? (tie.competitionId ? (isFinalTie(tie) ? 'finale' : 'girone') : null) : (slot?.phase || null)
  const inCompetition = Boolean(competition && phase)
  const isGroup = inCompetition && phase === 'girone'
  const isFinal = inCompetition && phase === 'finale'
  const opponentTeamId = isGroup ? (tie ? tie.opponentTeamId : slot?.opponentTeamId) || null : null
  const leg = isGroup ? (tie ? legOf(tie) : slot?.leg || 1) : null
  const groupOpponent = isGroup ? teamName(competition, opponentTeamId) || tie?.opponentTeam || '' : ''
  const context = inCompetition ? tieContext({ competitionId: competition.id, phase, leg, round: tie?.round }, competition) : null

  const [form, setForm] = useState(() => {
    const totals = readTotals(tie?.totals)
    return {
      opponentTeam: isGroup ? groupOpponent : tie?.opponentTeam || '',
      date: tie?.date ? tie.date.split('T')[0] : new Date().toISOString().split('T')[0],
      home: tie?.home ?? null,
      formula: tie ? { ...tie.formula } : { ...(inCompetition ? competition.formula : DEFAULT_FORMULA) },
      round: tie?.round || null,
      sets: totals.sets ? totals.sets.map(String) : ['', ''],
      games: totals.games ? totals.games.map(String) : ['', ''],
    }
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const floor = tie ? formulaFloor(tie, matches) : { singles: 0, doubles: 0 }
  const issue = tieIssue(form) || formulaBlockIssue(form.formula, floor)
    || (isFinal && !form.round ? 'Scegli il turno della fase finale.' : null)
    || (isGroup ? pairIssue('set', form.sets) || pairIssue('game', form.games) : null)
  const touched = form.opponentTeam.length > 0
  const canSave = !issue

  const setCount = (key, delta) => setForm(f => {
    const limits = FORMULA_LIMITS[key]
    const next = Math.min(limits.max, Math.max(limits.min, f.formula[key] + delta))
    return { ...f, formula: { ...f.formula, [key]: next } }
  })

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    const data = {
      date: new Date(form.date).toISOString(),
      opponentTeam: cleanTeamName(form.opponentTeam),
      home: form.home,
      formula: { ...form.formula },
    }
    if (inCompetition) {
      const empty = pair => pair.every(v => v === '' || v == null)
      const num = pair => (empty(pair) ? null : [Number(pair[0]), Number(pair[1])])
      const sets = num(form.sets)
      const games = num(form.games)
      Object.assign(data, {
        competitionId: competition.id,
        phase,
        leg,
        opponentTeamId,
        round: isFinal ? form.round : null,
        totals: isGroup && (sets || games) ? { sets, games } : null,
      })
    }
    await onSave(data)
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
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0"
             style={{ borderBottom: '1px solid var(--color-surface-2)' }}>
          <div className="min-w-0">
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-white)' }}>
              {tie ? 'Modifica scontro' : 'Nuovo scontro'}
            </h2>
            {inCompetition && (
              <p className="text-xs mt-0.5 wrap-anywhere" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                {competition.name} · {context}
              </p>
            )}
          </div>
          <button onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-lg"
                  style={{ color: 'var(--color-slate)', background: 'var(--color-surface-2)' }}>
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Squadra avversaria{isGroup ? '' : ' *'}</label>
            {isGroup ? (
              // Nel girone la squadra è quella dello scontro del calendario.
              <p className="w-full p-3 rounded-xl text-sm wrap-anywhere"
                 style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', fontFamily: 'var(--font-body)' }}>
                {groupOpponent}
              </p>
            ) : (
              <input
                autoFocus={!tie}
                value={form.opponentTeam}
                maxLength={TEAM_NAME_MAX_LENGTH}
                placeholder="Es. Tennis Club Roma"
                onChange={e => set('opponentTeam', e.target.value)}
                className="w-full p-3 rounded-xl text-sm outline-none"
                style={{
                  background: 'var(--color-surface-2)', color: 'var(--color-white)',
                  border: `1px solid ${touched && !cleanTeamName(form.opponentTeam) ? 'rgba(220,80,80,0.5)' : 'transparent'}`,
                  fontFamily: 'var(--font-body)',
                }}
              />
            )}
          </div>

          {isFinal && (
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Turno *</label>
              <div className="flex flex-wrap gap-2">
                {ROUNDS.filter(r => r.depth != null).map(r => {
                  const active = form.round === r.id
                  return (
                    <button key={r.id} type="button" onClick={() => set('round', r.id)}
                      className="px-3 py-2 rounded-full text-xs font-semibold transition-all"
                      style={{
                        background: active ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                        color:      active ? 'var(--color-white)' : 'var(--color-slate)',
                        border:     active ? '1px solid var(--color-teal)' : '1px solid transparent',
                        fontFamily: 'var(--font-display)',
                      }}>
                      {r.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Data *</label>
            <input
              type="date"
              value={form.date}
              onChange={e => set('date', e.target.value)}
              className="w-full p-3 rounded-xl text-sm outline-none"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-body)' }}
            />
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Dove (facoltativo)</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: true, label: 'In casa' }, { v: false, label: 'In trasferta' }].map(o => {
                const active = form.home === o.v
                return (
                  // Un secondo tap sulla scelta attiva la toglie: «non indicato».
                  <button key={String(o.v)} type="button" onClick={() => set('home', active ? null : o.v)}
                    className="py-3 rounded-2xl text-sm font-semibold transition-all"
                    style={{
                      background: active ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                      color:      active ? 'var(--color-white)' : 'var(--color-slate)',
                      border:     active ? '1px solid var(--color-teal)' : '1px solid transparent',
                      fontFamily: 'var(--font-display)'
                    }}>
                    {o.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Formula *</label>
            <div className="space-y-2">
              <Stepper label="Singolari" value={form.formula.singles} limits={FORMULA_LIMITS.singles}
                       onChange={d => setCount('singles', d)} />
              <Stepper label="Doppi" value={form.formula.doubles} limits={FORMULA_LIMITS.doubles}
                       onChange={d => setCount('doubles', d)} />
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--color-slate)' }}>
              {form.formula.singles + form.formula.doubles > 0 ? formulaText(form.formula) : 'Nessun incontro'}.
              Con un numero pari di incontri il pareggio è possibile.
            </p>
          </div>

          {isGroup && (
            <TotalsFields sets={form.sets} games={form.games}
                          onSets={v => set('sets', v)} onGames={v => set('games', v)} />
          )}

          {issue && (touched || tie || isGroup) && (
            <p className="text-xs" style={{ color: '#ff7070' }}>{issue}</p>
          )}
        </div>

        <div className="px-6 py-4 shrink-0" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-95"
            style={{
              background: (!canSave || saving) ? 'var(--color-surface-2)' : 'var(--color-amber)',
              color:      (!canSave || saving) ? 'var(--color-slate)'     : 'var(--color-bg)',
              fontFamily: 'var(--font-display)'
            }}>
            {saving ? 'Salvataggio...' : tie ? 'Salva modifiche' : 'Crea scontro'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Set e game totali dello scontro (noi–loro), facoltativi: servono solo agli
// spareggi della classifica. Richiudibile, vuoto di partenza.
function TotalsFields({ sets, games, onSets, onGames }) {
  const filled = [...sets, ...games].some(v => v !== '')
  const [open, setOpen] = useState(filled)
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)}
              className="text-xs font-semibold" style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
        {open ? '▾' : '▸'} Set e game (facoltativi)
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <PairInput label="Set" pair={sets} onChange={onSets} />
          <PairInput label="Game" pair={games} onChange={onGames} />
          <p className="text-xs" style={{ color: 'var(--color-slate)' }}>
            Totali dello scontro, noi–loro. Servono agli spareggi della classifica: senza,
            lo spareggio per set e game non si può calcolare.
          </p>
        </div>
      )}
    </div>
  )
}

function PairInput({ label, pair, onChange }) {
  const box = (i, who) => (
    <input
      type="number" inputMode="numeric" min="0" max={TOTAL_MAX}
      value={pair[i]} placeholder={who} aria-label={`${label} ${who.toLowerCase()}`}
      onChange={e => onChange(i === 0 ? [e.target.value, pair[1]] : [pair[0], e.target.value])}
      className="w-full p-2.5 rounded-xl text-sm text-center outline-none"
      style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-mono)' }}
    />
  )
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 text-xs shrink-0" style={{ color: 'var(--color-slate)' }}>{label}</span>
      <div className="flex-1 min-w-0">{box(0, 'Noi')}</div>
      <span style={{ color: 'var(--color-slate)' }}>–</span>
      <div className="flex-1 min-w-0">{box(1, 'Loro')}</div>
    </div>
  )
}

function Stepper({ label, value, limits, onChange }) {
  const btn = (disabled) => ({
    background: 'var(--color-surface-2)',
    color: disabled ? 'var(--color-slate)' : 'var(--color-white)',
    opacity: disabled ? 0.5 : 1,
  })
  return (
    <div className="flex items-center justify-between rounded-2xl px-4 py-2" style={{ background: 'var(--color-surface-2)' }}>
      <span className="text-sm font-semibold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onChange(-1)} disabled={value <= limits.min}
                aria-label={`Meno ${label.toLowerCase()}`}
                className="w-9 h-9 rounded-full text-lg font-bold" style={{ ...btn(value <= limits.min), border: '1px solid var(--color-surface)' }}>−</button>
        <span className="w-6 text-center text-base font-bold tabular-nums"
              style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>{value}</span>
        <button type="button" onClick={() => onChange(1)} disabled={value >= limits.max}
                aria-label={`Più ${label.toLowerCase()}`}
                className="w-9 h-9 rounded-full text-lg font-bold" style={{ ...btn(value >= limits.max), border: '1px solid var(--color-surface)' }}>+</button>
      </div>
    </div>
  )
}
