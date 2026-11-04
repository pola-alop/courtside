import { levelLabel, playstyleLabel, opponentInitials } from '../../lib/opponents'

// Nella vista di un gruppo la card porta anche la rotazione: `rotation` è
// { lastText, plannedText } (testi già pronti, null se non ci sono) e
// `contactHref` il link WhatsApp, presente solo se l'avversario ha il telefono.
// Il link sta ACCANTO al bottone della card, non dentro: un link in un <button>
// non è HTML valido.
export default function OpponentCard({ opponent, record = null, rotation = null, contactHref = null, onClick }) {
  const initials = opponentInitials(opponent)
  const accent   = avatarAccent(opponent.name)
  const h2h      = getH2HInfo(record)
  const planned  = rotation?.plannedText || null
  const subtitle = getLine(opponent, rotation)

  return (
    <div className="flex items-stretch gap-2">
      <button
        onClick={onClick}
        className="flex-1 min-w-0 text-left rounded-2xl p-3 flex items-center gap-3 transition-all active:scale-[0.98]"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}
      >
        {/* Avatar iniziali */}
        <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
             style={{ background: accent.bg }}>
          <span className="text-sm font-bold"
                style={{ color: accent.fg, fontFamily: 'var(--font-display)' }}>
            {initials}
          </span>
        </div>

        {/* Nome + sottotitolo */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate"
             style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            {opponent.name}
          </p>
          {subtitle && (
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-slate)' }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Badge: il programma (ambra, su due righe) oppure il testa-a-testa */}
        {planned ? (
          <span className="shrink-0 text-xs px-2.5 py-1 rounded-2xl font-semibold text-center leading-tight"
                style={{ maxWidth: '6.5rem', background: 'rgba(244,163,0,0.15)', color: 'var(--color-amber-light)', fontFamily: 'var(--font-display)' }}>
            {planned}
          </span>
        ) : (
          <span className="shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ background: h2h.bg, color: h2h.color, fontFamily: 'var(--font-mono)' }}>
            {h2h.label}
          </span>
        )}
      </button>

      {contactHref && (
        <a href={contactHref} target="_blank" rel="noopener noreferrer"
           aria-label={`Scrivi su WhatsApp a ${opponent.name}`}
           className="shrink-0 w-12 rounded-2xl flex items-center justify-center text-lg transition-all active:scale-95"
           style={{ background: 'var(--color-surface)', border: '1px solid var(--color-teal-dark)' }}>
          💬
        </a>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

function getSubtitle(opponent) {
  return [handLabel(opponent.hand), levelLabel(opponent.level), playstyleLabel(opponent.playstyle)]
    .filter(Boolean)
    .join(' · ') || null
}

// Seconda riga. Fuori da un gruppo è il sottotitolo di sempre. Dentro: l'ultima
// partita per chi ha giocato; per chi non ha mai giocato il sottotitolo, a meno
// che il badge sia "In programma" (allora il badge non dice "Mai giocato", e lo
// dice la riga). Così "Mai giocato" compare una volta sola.
function getLine(opponent, rotation) {
  if (!rotation) return getSubtitle(opponent)
  if (rotation.lastText) return rotation.lastText
  return rotation.plannedText ? 'Mai giocato' : getSubtitle(opponent)
}

// Record H2H (Vittorie-Pareggi-Sconfitte): teal se in vantaggio, rosso se
// sotto, ambra se pari, neutro se mai giocato.
function getH2HInfo(record) {
  const wins   = record?.wins   ?? 0
  const losses = record?.losses ?? 0
  const draws  = record?.draws  ?? 0
  if (wins + losses + draws === 0) {
    return { label: 'Mai giocato', bg: 'var(--color-surface-2)', color: 'var(--color-slate)' }
  }
  const label = `${wins}–${draws}–${losses}`
  if (wins > losses) return { label, bg: 'rgba(72,179,176,0.18)', color: 'var(--color-teal-light)' }
  if (losses > wins) return { label, bg: 'rgba(220,80,80,0.15)',  color: '#ff7070' }
  return { label, bg: 'rgba(244,163,0,0.15)', color: 'var(--color-amber-light)' }
}

// Tinta avatar deterministica dal nome (stessa persona → sempre stesso colore)
const AVATAR_ACCENTS = [
  { bg: 'rgba(72,179,176,0.18)', fg: 'var(--color-teal-light)'  },
  { bg: 'rgba(244,163,0,0.18)',  fg: 'var(--color-amber-light)' },
  { bg: 'rgba(161,214,219,0.15)', fg: 'var(--color-teal-light)'  },
  { bg: 'rgba(201,122,45,0.22)', fg: 'var(--color-amber-light)' },
]

function avatarAccent(name) {
  const str = name || ''
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0
  return AVATAR_ACCENTS[Math.abs(hash) % AVATAR_ACCENTS.length]
}

const handLabel = h => ({ destro: 'Destro', sinistro: 'Mancino' }[h] || null)
