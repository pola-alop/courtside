import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase/config'
import { useAuthState } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { HR_ZONES } from '../lib/athletics'
import {
  DEFAULT_WALK, WEIGHT_LIMITS, emptyRunningProfile, runningProfileIssues,
  isRunningReady, parsePace, formatPace,
} from '../lib/running'

const HANDS = [
  { id: 'destro',   label: 'Destro'  },
  { id: 'sinistro', label: 'Mancino' },
]

const CURRENT_YEAR = new Date().getFullYear()
const MIN_YEAR = 1930

export default function Profile() {
  const { user } = useAuthState()
  const { profile, loading, update } = useProfile()

  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState(null)
  const [saving, setSaving]   = useState(false)
  const [runForm, setRunForm] = useState(null)

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Il form va ricalcolato da `profile` all'apertura, non una volta al mount,
  // così "Modifica" mostra sempre i dati aggiornati dopo un reload.
  const openEdit = () => {
    setRunForm(null)
    setForm({
      dominantHand: profile?.dominantHand || null,
      level:        profile?.level || '',
      birthYear:    profile?.birthYear    ? String(profile.birthYear)    : '',
      playingSince: profile?.playingSince ? String(profile.playingSince) : '',
    })
    setEditing(true)
  }

  const cancelEdit = () => { setEditing(false); setForm(null) }

  const handleSave = async () => {
    if (saving || !form) return
    setSaving(true)
    await update({
      dominantHand: form.dominantHand || null,
      level:        form.level.trim() || null,
      birthYear:    yearOrNull(form.birthYear),
      playingSince: yearOrNull(form.playingSince),
    })
    setSaving(false)
    setEditing(false)
    setForm(null)
  }

  // ── Zone di corsa ──
  // Stesso schema view/edit del blocco tennis, con un form proprio: il passo si
  // scrive come testo ("5:30") e si converte in secondi/km solo al salvataggio.
  const openRunEdit = () => {
    setEditing(false)
    setForm(null)
    setRunForm(runningToForm(profile?.running))
  }

  const cancelRunEdit = () => setRunForm(null)

  const runDraft = runForm ? formToRunning(runForm) : null
  const runIssues = runDraft ? runningProfileIssues(runDraft) : []

  const handleSaveRunning = async () => {
    if (saving || !runDraft || runIssues.length > 0) return
    setSaving(true)
    await update({ running: runDraft })
    setSaving(false)
    setRunForm(null)
  }

  const handleLogout = async () => {
    await signOut(auth)
  }

  const age        = ageFromYear(profile?.birthYear)
  const experience = ageFromYear(profile?.playingSince)
  const running    = profile?.running
  const runningReady = isRunningReady(running)

  return (
    <div className="px-6 pt-8 pb-4">
      <h1 className="text-2xl font-bold mb-6"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-white)' }}>
        Profile
      </h1>

      {/* Header — avatar a iniziali + nome + email, dati Google, non modificabili qui.
          Niente foto Google: non tutti gli account ne hanno una, e un avatar
          sempre presente è più affidabile di uno che a volte c'è e a volte no. */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center shrink-0"
             style={{ background: 'var(--color-teal-dark)' }}>
          <span className="text-xl font-bold"
                style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            {getInitials(user?.displayName)}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold truncate"
             style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            {user?.displayName || 'Giocatore'}
          </p>
          <p className="text-sm truncate" style={{ color: 'var(--color-slate)' }}>
            {user?.email}
          </p>
        </div>
      </div>

      {!loading && !editing && (
        <>
          <button
            onClick={openEdit}
            className="w-full mb-4 py-2.5 rounded-2xl text-xs font-semibold transition-all"
            style={{
              background: 'var(--color-surface-2)',
              color: 'var(--color-teal)',
              fontFamily: 'var(--font-display)',
              border: '1px solid var(--color-teal-dark)'
            }}>
            ✏️ Modifica profilo
          </button>

          <Section title="Il tuo tennis">
            <Row label="Mano"               value={handLabel(profile?.dominantHand) || '—'} />
            <Row label="Livello / classifica" value={profile?.level || '—'} />
            <Row label="Età"                value={age !== null ? `${age} anni` : '—'} />
            <Row label="Gioca dal"
                 value={profile?.playingSince
                   ? `${profile.playingSince}${experience !== null ? ` · ${experience} ${experience === 1 ? 'anno' : 'anni'}` : ''}`
                   : '—'} />
          </Section>
        </>
      )}

      {editing && form && (
        <div className="space-y-4 mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider"
             style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-display)' }}>
            Modifica profilo
          </p>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Mano</label>
            <div className="flex gap-2">
              {HANDS.map(h => {
                const active = form.dominantHand === h.id
                return (
                  <button key={h.id}
                    onClick={() => setField('dominantHand', active ? null : h.id)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: active ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                      color:      active ? 'var(--color-white)' : 'var(--color-slate)',
                      fontFamily: 'var(--font-display)'
                    }}>
                    {h.label}
                  </button>
                )
              })}
            </div>
          </div>

          <EditInput
            label="Livello / classifica"
            value={form.level}
            onChange={v => setField('level', v)}
            placeholder="Es. 4.3, 3ª categoria..."
          />

          <EditInput
            label="Anno di nascita"
            type="number"
            value={form.birthYear}
            onChange={v => setField('birthYear', v)}
            placeholder="Es. 1995"
            min={MIN_YEAR}
            max={CURRENT_YEAR}
          />

          <EditInput
            label="Gioco dal (anno)"
            type="number"
            value={form.playingSince}
            onChange={v => setField('playingSince', v)}
            placeholder="Es. 2015"
            min={MIN_YEAR}
            max={CURRENT_YEAR}
          />

          <div className="flex gap-3 pt-2">
            <button
              onClick={cancelEdit}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
              Annulla
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
              style={{
                background: saving ? 'var(--color-surface-2)' : 'var(--color-amber)',
                color:      saving ? 'var(--color-slate)'     : 'var(--color-bg)',
                fontFamily: 'var(--font-display)'
              }}>
              {saving ? 'Salvo...' : 'Salva modifiche'}
            </button>
          </div>
        </div>
      )}

      {/* Zone di corsa — la tabella zona → passo che traduce ogni fase di una
          scheda in durata e distanza. Senza, la corsa non si può registrare. */}
      {!loading && !runForm && (
        runningReady ? (
          <Section title="Zone di corsa" action={<SectionAction onClick={openRunEdit}>✏️ Modifica</SectionAction>}>
            {HR_ZONES.map((z, i) => (
              <Row key={z.id}
                   label={<ZoneLabel color={z.color} label={z.label} name={z.name} />}
                   value={`${formatPace(running.zones[i].fast)}–${formatPace(running.zones[i].slow)} /km`} />
            ))}
            <Row label={<ZoneLabel color="var(--color-slate)" label="Camminata" />}
                 value={`${formatPace(running.walk.fast)}–${formatPace(running.walk.slow)} /km`} />
            <Row label="Peso" value={running.weightKg ? `${running.weightKg} kg` : '—'} />
          </Section>
        ) : (
          <div className="mb-4 rounded-2xl px-4 py-4" style={{ background: 'var(--color-surface-2)', border: '1px dashed var(--color-teal-dark)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
              🏃 Zone di corsa
            </p>
            <p className="text-xs mb-3" style={{ color: 'var(--color-slate)' }}>
              Indica a che passo corri in ogni zona: serve a stimare quanto dura ogni fase
              delle tue schede. Finché la tabella non è completa non puoi registrare corse.
            </p>
            <button onClick={openRunEdit}
              className="w-full py-2.5 rounded-2xl text-xs font-semibold transition-all active:scale-95"
              style={{ background: 'var(--color-amber)', color: 'var(--color-bg)', fontFamily: 'var(--font-display)' }}>
              Configura le zone
            </button>
          </div>
        )
      )}

      {runForm && (
        <RunningZonesForm
          form={runForm}
          setForm={setRunForm}
          issues={runIssues}
          saving={saving}
          onCancel={cancelRunEdit}
          onSave={handleSaveRunning}
        />
      )}

      <button
        onClick={handleLogout}
        className="w-full py-4 rounded-2xl font-semibold text-base transition-transform active:scale-95"
        style={{
          background: 'var(--color-surface)',
          color: '#e05555',
          fontFamily: 'var(--font-display)',
          border: '1px solid var(--color-surface-2)'
        }}
      >
        Sign out
      </button>
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

function Section({ title, action, children }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider"
           style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          {title}
        </p>
        {action}
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center px-4 py-3"
         style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span className="text-xs" style={{ color: 'var(--color-slate)' }}>{label}</span>
      <span className="text-xs font-medium text-right"
            style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
        {value}
      </span>
    </div>
  )
}

function SectionAction({ onClick, children }) {
  return (
    <button onClick={onClick} className="text-xs font-semibold"
            style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-display)' }}>
      {children}
    </button>
  )
}

function ZoneLabel({ color, label, name }) {
  return (
    <span className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      <span style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{label}</span>
      {name && <span>{name}</span>}
    </span>
  )
}

// Tabella zona → passo. Due colonne per riga, "veloce" e "lento", invece di un
// solo campo "5:30-6:10": due numeri distinti si validano uno per uno e il
// tastierino decimale di iOS (che non ha i due punti) resta usabile — "5.30" e
// "5,30" sono accettati come 5:30.
function RunningZonesForm({ form, setForm, issues, saving, onCancel, onSave }) {
  const setZone = (i, key, v) => setForm(f => ({
    ...f, zones: f.zones.map((z, k) => (k === i ? { ...z, [key]: v } : z)),
  }))
  const setWalk = (key, v) => setForm(f => ({ ...f, walk: { ...f.walk, [key]: v } }))
  const canSave = issues.length === 0

  return (
    <div className="space-y-4 mb-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider"
           style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-display)' }}>
          Zone di corsa
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-slate)' }}>
          Il passo (min/km) a cui corri in ogni zona, da Z0 (la più lenta) a Z6, le sette zone del tuo Garmin. Li trovi
          nelle zone di passo o di frequenza cardiaca del tuo orologio.
        </p>
      </div>

      <div className="rounded-2xl p-3 space-y-2" style={{ background: 'var(--color-surface-2)' }}>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-slate)' }}>
          <span className="flex-1">Zona</span>
          <span className="w-16 text-center">Veloce</span>
          <span className="w-2" />
          <span className="w-16 text-center">Lento</span>
        </div>
        {HR_ZONES.map((z, i) => (
          <PaceRow key={z.id}
            label={<ZoneLabel color={z.color} label={z.label} name={z.name} />}
            fast={form.zones[i].fast} slow={form.zones[i].slow}
            onFast={v => setZone(i, 'fast', v)} onSlow={v => setZone(i, 'slow', v)} />
        ))}
        <div className="pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <PaceRow
            label={<ZoneLabel color="var(--color-slate)" label="Camminata" />}
            fast={form.walk.fast} slow={form.walk.slow}
            onFast={v => setWalk('fast', v)} onSlow={v => setWalk('slow', v)} />
        </div>
      </div>

      <EditInput
        label={`Peso (kg) — facoltativo, serve solo alle fasi a calorie`}
        type="number"
        value={form.weightKg}
        onChange={v => setForm(f => ({ ...f, weightKg: v }))}
        placeholder="Es. 72"
        min={WEIGHT_LIMITS.min}
        max={WEIGHT_LIMITS.max}
      />

      {issues.map(msg => (
        <p key={msg} className="text-xs" style={{ color: 'var(--color-loss)' }}>⚠ {msg}</p>
      ))}

      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="flex-1 py-3 rounded-2xl text-sm font-semibold"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
          Annulla
        </button>
        <button onClick={onSave} disabled={!canSave || saving}
          className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
          style={{
            background: (!canSave || saving) ? 'var(--color-surface-2)' : 'var(--color-amber)',
            color:      (!canSave || saving) ? 'var(--color-slate)'     : 'var(--color-bg)',
            fontFamily: 'var(--font-display)'
          }}>
          {saving ? 'Salvo...' : 'Salva zone'}
        </button>
      </div>
    </div>
  )
}

function PaceRow({ label, fast, slow, onFast, onSlow }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 min-w-0 text-xs truncate" style={{ color: 'var(--color-slate)' }}>{label}</span>
      <PaceInput value={fast} onChange={onFast} placeholder="5:00" />
      <span className="w-2 text-center text-xs" style={{ color: 'var(--color-slate)' }}>–</span>
      <PaceInput value={slow} onChange={onSlow} placeholder="5:30" />
    </div>
  )
}

// Testo libero con tastierino decimale; all'uscita dal campo il valore viene
// riscritto nel formato canonico ("5.3" → "5:30") se è un passo leggibile.
function PaceInput({ value, onChange, placeholder }) {
  const invalid = value.trim() !== '' && parsePace(value) === null
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onBlur={() => { const p = parsePace(value); if (p) onChange(formatPace(p)) }}
      className="w-16 p-2 rounded-xl text-sm text-center outline-none"
      style={{
        background: 'var(--color-surface)',
        color: 'var(--color-white)',
        border: `1px solid ${invalid ? 'var(--color-loss)' : 'transparent'}`,
        fontFamily: 'var(--font-mono)'
      }}
    />
  )
}

function EditInput({ label, value, onChange, type = 'text', placeholder = '', min, max }) {
  return (
    <div>
      <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        min={min}
        max={max}
        onChange={e => onChange(e.target.value)}
        className="w-full p-3 rounded-xl text-sm outline-none"
        style={{
          background: 'var(--color-surface-2)',
          color: 'var(--color-white)',
          border: '1px solid var(--color-teal-dark)',
          fontFamily: 'var(--font-body)'
        }}
      />
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────
// `HANDS`/`handLabel` duplicati localmente, stessa convenzione di
// OpponentDetailModal/OpponentCard: niente costante condivisa per due righe.

const handLabel = h => ({ destro: 'Destro', sinistro: 'Mancino' }[h] || null)

function getInitials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Anno → età/anzianità in anni pieni rispetto ad oggi. Non usiamo il compleanno
// esatto (non lo chiediamo, solo l'anno) quindi è un'approssimazione dichiarata
// dal fatto stesso che mostriamo solo l'anno, non la data.
function ageFromYear(year) {
  if (!year) return null
  return CURRENT_YEAR - year
}

// Profilo corsa salvato → form a stringhe. Alla prima apertura la camminata è
// precompilata con un default ragionevole: è la riga che nessuno sa a memoria.
function runningToForm(running) {
  const base = running?.zones?.length ? running : emptyRunningProfile()
  const walk = base.walk?.fast ? base.walk : DEFAULT_WALK
  return {
    zones: base.zones.map(z => ({ fast: z?.fast ? formatPace(z.fast) : '', slow: z?.slow ? formatPace(z.slow) : '' })),
    walk: { fast: formatPace(walk.fast), slow: formatPace(walk.slow) },
    weightKg: base.weightKg ? String(base.weightKg) : '',
  }
}

function formToRunning(form) {
  const weight = Number(String(form.weightKg).replace(',', '.'))
  return {
    zones: form.zones.map(z => ({ fast: parsePace(z.fast), slow: parsePace(z.slow) })),
    walk: { fast: parsePace(form.walk.fast), slow: parsePace(form.walk.slow) },
    weightKg: form.weightKg === '' || !Number.isFinite(weight) ? null : Math.round(weight * 10) / 10,
  }
}

function yearOrNull(str) {
  const n = Number(str)
  if (!str || !Number.isInteger(n) || n < MIN_YEAR || n > CURRENT_YEAR) return null
  return n
}
