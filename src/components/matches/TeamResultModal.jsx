import { useState } from 'react'
import { resultIssue, teamName, fixtureTotal, TOTAL_MAX, toCount } from '../../lib/teamCompetitions'

// Inserimento rapido del risultato di uno scontro tra altre squadre (B–C):
// gli incontri vinti da ciascuna e, facoltativi, set e game totali (servono
// solo agli spareggi). Un campo vuoto resta vuoto e blocca il salvataggio.
// `fixture`: lo scontro del calendario (a, b, leg); `existing`: il risultato già
// inserito (a/b nell'ordine del calendario) oppure null.
export default function TeamResultModal({ competition, fixture, existing = null, onClose, onSave, onClear }) {
  const total = fixtureTotal(competition)
  const nameA = teamName(competition, fixture.a) || '—'
  const nameB = teamName(competition, fixture.b) || '—'
  const [form, setForm] = useState(() => ({
    scoreA: existing ? String(existing.scoreA) : '',
    scoreB: existing ? String(existing.scoreB) : '',
    sets: existing?.sets ? existing.sets.map(String) : ['', ''],
    games: existing?.games ? existing.games.map(String) : ['', ''],
  }))
  const [saving, setSaving] = useState(false)
  const [moreOpen, setMoreOpen] = useState(Boolean(existing?.sets || existing?.games))
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const value = {
    scoreA: toCount(form.scoreA), scoreB: toCount(form.scoreB),
    sets: form.sets, games: form.games,
  }
  const touched = form.scoreA !== '' || form.scoreB !== '' || Boolean(existing)
  const issue = resultIssue(value, total)
  const canSave = !issue

  const num = pair => (pair.every(v => v === '') ? null : [Number(pair[0]), Number(pair[1])])

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    await onSave({
      a: fixture.a, b: fixture.b, leg: fixture.leg,
      scoreA: value.scoreA, scoreB: value.scoreB,
      sets: num(form.sets), games: num(form.games),
    })
    setSaving(false)
    onClose()
  }

  const handleClear = async () => {
    if (saving) return
    setSaving(true)
    await onClear(fixture.a, fixture.b, fixture.leg)
    setSaving(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: 'rgba(2,13,25,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-3xl flex flex-col"
           style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)', maxHeight: '88vh' }}>
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4 shrink-0"
             style={{ borderBottom: '1px solid var(--color-surface-2)' }}>
          <div className="min-w-0">
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-white)' }}>
              Risultato
            </h2>
            <p className="text-xs mt-0.5 wrap-anywhere" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
              {nameA} – {nameB}{competition.legs === 2 ? ` · ${fixture.leg === 2 ? 'Ritorno' : 'Andata'}` : ''}
            </p>
          </div>
          <button onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-lg shrink-0"
                  style={{ color: 'var(--color-slate)', background: 'var(--color-surface-2)' }}>
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          <div>
            <label className="text-xs mb-2 block" style={{ color: 'var(--color-slate)' }}>
              Incontri vinti (su {total}) *
            </label>
            <div className="space-y-2">
              <ScoreBox name={nameA} value={form.scoreA} max={total} onChange={v => set('scoreA', v)} />
              <ScoreBox name={nameB} value={form.scoreB} max={total} onChange={v => set('scoreB', v)} />
            </div>
          </div>

          <div>
            <button type="button" onClick={() => setMoreOpen(o => !o)}
                    className="text-xs font-semibold" style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
              {moreOpen ? '▾' : '▸'} Set e game (facoltativi)
            </button>
            {moreOpen && (
              <div className="mt-2 space-y-2">
                <PairRow label="Set" nameA={nameA} nameB={nameB} pair={form.sets} onChange={v => set('sets', v)} />
                <PairRow label="Game" nameA={nameA} nameB={nameB} pair={form.games} onChange={v => set('games', v)} />
                <p className="text-xs" style={{ color: 'var(--color-slate)' }}>
                  Servono agli spareggi della classifica: senza, lo spareggio per set e game non si può calcolare.
                </p>
              </div>
            )}
          </div>

          {issue && touched && <p className="text-xs" style={{ color: '#ff7070' }}>{issue}</p>}
        </div>

        <div className="px-6 py-4 shrink-0 space-y-2" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-95"
            style={{
              background: (!canSave || saving) ? 'var(--color-surface-2)' : 'var(--color-amber)',
              color:      (!canSave || saving) ? 'var(--color-slate)'     : 'var(--color-bg)',
              fontFamily: 'var(--font-display)'
            }}>
            {saving ? 'Salvataggio...' : 'Salva risultato'}
          </button>
          {existing && (
            <button onClick={handleClear} disabled={saving}
                    className="w-full py-3 rounded-2xl text-sm font-semibold"
                    style={{ background: 'var(--color-surface-2)', color: 'var(--color-loss)', fontFamily: 'var(--font-display)', border: '1px solid var(--color-loss-bg)' }}>
              Togli il risultato
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

function ScoreBox({ name, value, max, onChange }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl px-4 py-2" style={{ background: 'var(--color-surface-2)' }}>
      <span className="flex-1 min-w-0 text-sm font-semibold wrap-anywhere"
            style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{name}</span>
      <input
        type="number" inputMode="numeric" min="0" max={max}
        value={value} placeholder="–" aria-label={`Incontri vinti da ${name}`}
        onChange={e => onChange(e.target.value)}
        className="w-16 shrink-0 p-2.5 rounded-xl text-base font-bold text-center outline-none"
        style={{ background: 'var(--color-surface)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-mono)' }}
      />
    </div>
  )
}

function PairRow({ label, nameA, nameB, pair, onChange }) {
  const box = (i, name) => (
    <input
      type="number" inputMode="numeric" min="0" max={TOTAL_MAX}
      value={pair[i]} aria-label={`${label} di ${name}`}
      onChange={e => onChange(i === 0 ? [e.target.value, pair[1]] : [pair[0], e.target.value])}
      className="w-full p-2.5 rounded-xl text-sm text-center outline-none"
      style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-mono)' }}
    />
  )
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="w-12 text-xs shrink-0" style={{ color: 'var(--color-slate)' }}>{label}</span>
        <div className="flex-1 min-w-0">{box(0, nameA)}</div>
        <span style={{ color: 'var(--color-slate)' }}>–</span>
        <div className="flex-1 min-w-0">{box(1, nameB)}</div>
      </div>
    </div>
  )
}
