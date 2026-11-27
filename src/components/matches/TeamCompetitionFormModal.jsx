import { useState } from 'react'
import { Stepper } from './TeamTieFormModal'
import {
  TEAMS_LIMITS, DEFAULT_POINTS, POINTS_LIMITS, COMPETITION_NAME_MAX_LENGTH, SEASON_MAX_LENGTH,
  cleanName, newTeamId, toCount, competitionIssue, competitionBlockIssue, teamUsage, groupTies,
} from '../../lib/teamCompetitions'
import { FORMULA_LIMITS, DEFAULT_FORMULA, TEAM_NAME_MAX_LENGTH, formulaText, formulaTotal } from '../../lib/teamTies'

// Crea o modifica una competizione a squadre: nome, stagione, le squadre del
// girone (una è la tua), andata o andata e ritorno, formula degli scontri,
// punti e quante squadre passano alla fase finale (0 = nessuna fase finale).
// Un campo obbligatorio vuoto resta vuoto e blocca il salvataggio: niente valori
// d'ufficio. In modifica ciò che è già usato non si toglie (`competitionBlockIssue`).
export default function TeamCompetitionFormModal({ competition = null, ties = [], onClose, onSave }) {
  const [form, setForm] = useState(() => competition ? {
    name: competition.name,
    season: competition.season,
    teams: competition.teams.map(t => ({ ...t })),
    myTeamId: competition.myTeamId,
    legs: competition.legs,
    formula: { ...competition.formula },
    points: {
      win: String(competition.points.win), draw: String(competition.points.draw), loss: String(competition.points.loss),
    },
    qualifiers: competition.qualifiers,
  } : {
    name: '',
    season: '',
    // Quattro righe vuote: la forma di partenza del girone, i nomi li scrive l'utente.
    teams: Array.from({ length: 4 }, () => ({ id: newTeamId(), name: '' })),
    myTeamId: null,
    legs: 1,
    formula: { ...DEFAULT_FORMULA },
    points: {
      win: String(DEFAULT_POINTS.win), draw: String(DEFAULT_POINTS.draw), loss: String(DEFAULT_POINTS.loss),
    },
    qualifiers: 2,
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const parsed = {
    ...form,
    points: { win: toCount(form.points.win), draw: toCount(form.points.draw), loss: toCount(form.points.loss) },
  }
  const issue = competitionIssue(parsed)
    || (competition ? competitionBlockIssue(competition, ties, { teams: form.teams, myTeamId: form.myTeamId, legs: form.legs }) : null)
  const touched = form.name.length > 0 || form.teams.some(t => t.name.length > 0)
  const canSave = !issue
  const hasGroupTies = competition ? groupTies(competition, ties).length > 0 : false

  const setTeamName = (id, name) => setForm(f => ({ ...f, teams: f.teams.map(t => (t.id === id ? { ...t, name } : t)) }))
  const addTeam = () => setForm(f => (f.teams.length >= TEAMS_LIMITS.max ? f
    : { ...f, teams: [...f.teams, { id: newTeamId(), name: '' }] }))
  const removeTeam = (id) => setForm(f => {
    const teams = f.teams.filter(t => t.id !== id)
    return {
      ...f, teams,
      myTeamId: f.myTeamId === id ? null : f.myTeamId,
      qualifiers: Math.min(f.qualifiers, Math.max(teams.length - 1, 0)),
    }
  })
  const setPoint = (k, v) => setForm(f => ({ ...f, points: { ...f.points, [k]: v } }))
  const setCount = (key, delta) => setForm(f => {
    const limits = FORMULA_LIMITS[key]
    const next = Math.min(limits.max, Math.max(limits.min, f.formula[key] + delta))
    return { ...f, formula: { ...f.formula, [key]: next } }
  })

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    await onSave({
      name: cleanName(form.name),
      season: cleanName(form.season) || null,
      teams: form.teams.map(t => ({ id: t.id, name: cleanName(t.name) })),
      myTeamId: form.myTeamId,
      legs: form.legs,
      formula: { ...form.formula },
      points: parsed.points,
      qualifiers: form.qualifiers,
    })
    setSaving(false)
    onClose()
  }

  return (
    <div
      className="app-overlay fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(2,13,25,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-3xl flex flex-col"
           style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)', maxHeight: '88vh' }}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0"
             style={{ borderBottom: '1px solid var(--color-surface-2)' }}>
          <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-white)' }}>
            {competition ? 'Modifica competizione' : 'Nuova competizione'}
          </h2>
          <button onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-lg"
                  style={{ color: 'var(--color-slate)', background: 'var(--color-surface-2)' }}>
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Nome *</label>
            <TextInput value={form.name} maxLength={COMPETITION_NAME_MAX_LENGTH} placeholder="Es. Campionato a squadre D3"
                       autoFocus={!competition} invalid={touched && !cleanName(form.name)}
                       onChange={v => set('name', v)} />
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Stagione (facoltativa)</label>
            <TextInput value={form.season} maxLength={SEASON_MAX_LENGTH} placeholder="Es. 2026"
                       onChange={v => set('season', v)} />
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>
              Squadre del girone * ({TEAMS_LIMITS.min}–{TEAMS_LIMITS.max}) — tocca il cerchio per indicare la tua
            </label>
            <div className="space-y-2">
              {form.teams.map(t => {
                const used = competition ? teamUsage(competition, ties, t.id) > 0 : false
                const isMine = form.myTeamId === t.id
                const lockedMine = hasGroupTies && competition?.myTeamId !== t.id
                const canRemove = form.teams.length > TEAMS_LIMITS.min && !used
                return (
                  <div key={t.id} className="flex items-center gap-2">
                    <button type="button" aria-label={`${t.name || 'Questa squadra'} è la mia`} aria-pressed={isMine}
                            onClick={() => set('myTeamId', t.id)}
                            disabled={lockedMine}
                            className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                            style={{
                              background: isMine ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                              border: `1.5px solid ${isMine ? 'var(--color-teal)' : 'var(--color-surface-2)'}`,
                              color: isMine ? 'var(--color-white)' : 'var(--color-slate)',
                              opacity: lockedMine ? 0.4 : 1,
                            }}>
                      {isMine ? 'Tu' : ''}
                    </button>
                    <div className="flex-1 min-w-0">
                      <TextInput value={t.name} maxLength={TEAM_NAME_MAX_LENGTH} placeholder="Nome squadra"
                                 onChange={v => setTeamName(t.id, v)} />
                    </div>
                    <button type="button" onClick={() => removeTeam(t.id)} disabled={!canRemove}
                            aria-label={`Togli ${t.name || 'la squadra'}`}
                            title={used ? 'Ha già scontri o risultati' : undefined}
                            className="w-9 h-9 shrink-0 rounded-full text-sm"
                            style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', opacity: canRemove ? 1 : 0.4 }}>
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>
            {form.teams.length < TEAMS_LIMITS.max && (
              <button type="button" onClick={addTeam}
                      className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-full"
                      style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
                ＋ Squadra
              </button>
            )}
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Girone *</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: 1, label: 'Solo andata' }, { v: 2, label: 'Andata e ritorno' }].map(o => {
                const active = form.legs === o.v
                return (
                  <button key={o.v} type="button" onClick={() => set('legs', o.v)}
                    className="py-3 rounded-2xl text-sm font-semibold transition-all"
                    style={{
                      background: active ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                      color:      active ? 'var(--color-white)' : 'var(--color-slate)',
                      border:     active ? '1px solid var(--color-teal)' : '1px solid transparent',
                      fontFamily: 'var(--font-display)',
                    }}>
                    {o.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Formula degli scontri *</label>
            <div className="space-y-2">
              <Stepper label="Singolari" value={form.formula.singles} limits={FORMULA_LIMITS.singles} onChange={d => setCount('singles', d)} />
              <Stepper label="Doppi" value={form.formula.doubles} limits={FORMULA_LIMITS.doubles} onChange={d => setCount('doubles', d)} />
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--color-slate)' }}>
              {formulaTotal(form.formula) > 0 ? formulaText(form.formula) : 'Nessun incontro'}.
              È la formula di partenza di ogni scontro: si può cambiare scontro per scontro.
            </p>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Punti in classifica *</label>
            <div className="grid grid-cols-3 gap-2">
              <PointBox label="Vittoria" value={form.points.win} onChange={v => setPoint('win', v)} />
              <PointBox label="Pareggio" value={form.points.draw} onChange={v => setPoint('draw', v)} />
              <PointBox label="Sconfitta" value={form.points.loss} onChange={v => setPoint('loss', v)} />
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--color-slate)' }}>
              Il regolamento non è fissato: 3-1-0 è una proposta. Il pareggio c'è solo con un numero pari di incontri.
            </p>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Fase finale *</label>
            <Stepper label="Qualificate" value={form.qualifiers}
                     limits={{ min: 0, max: Math.max(form.teams.length - 1, 0) }}
                     onChange={d => set('qualifiers', Math.min(Math.max(form.teams.length - 1, 0), Math.max(0, form.qualifiers + d)))} />
            <p className="text-xs mt-1.5" style={{ color: 'var(--color-slate)' }}>
              Le prime del girone che passano alla fase finale a eliminazione. Con 0 non c'è fase finale.
            </p>
          </div>

          {issue && (touched || competition) && (
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
            {saving ? 'Salvataggio...' : competition ? 'Salva modifiche' : 'Crea competizione'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

function TextInput({ value, onChange, maxLength, placeholder, autoFocus = false, invalid = false }) {
  return (
    <input
      autoFocus={autoFocus}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className="w-full p-3 rounded-xl text-sm outline-none"
      style={{
        background: 'var(--color-surface-2)', color: 'var(--color-white)',
        border: `1px solid ${invalid ? 'rgba(220,80,80,0.5)' : 'transparent'}`,
        fontFamily: 'var(--font-body)',
      }}
    />
  )
}

function PointBox({ label, value, onChange }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider mb-1 text-center"
         style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>{label}</p>
      <input
        type="number" inputMode="numeric" min={POINTS_LIMITS.min} max={POINTS_LIMITS.max}
        value={value} aria-label={`Punti per ${label.toLowerCase()}`}
        onChange={e => onChange(e.target.value)}
        className="w-full p-3 rounded-xl text-base font-bold text-center outline-none"
        style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-mono)' }}
      />
    </div>
  )
}
