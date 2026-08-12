import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase/config'
import { useAuthState } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'

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

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Il form va ricalcolato da `profile` all'apertura, non una volta al mount,
  // così "Modifica" mostra sempre i dati aggiornati dopo un reload.
  const openEdit = () => {
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

  const handleLogout = async () => {
    await signOut(auth)
  }

  const age        = ageFromYear(profile?.birthYear)
  const experience = ageFromYear(profile?.playingSince)

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

function Section({ title, children }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-wider mb-2"
         style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
        {title}
      </p>
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

function yearOrNull(str) {
  const n = Number(str)
  if (!str || !Number.isInteger(n) || n < MIN_YEAR || n > CURRENT_YEAR) return null
  return n
}
