export default function EquipmentCard({ item, matchCount = 0, onClick }) {
  const wearInfo = getWearInfo(item, matchCount)
  const subtitle = getSubtitle(item)
  const displayName = item.nickname || item.model || item.name || '—'

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl overflow-hidden transition-all active:scale-95 relative"
      style={{
        border: '1px solid var(--color-surface-2)',
        minHeight: '160px',
      }}
    >
      {/* Sfondo sfocato — layer separato per non sfuocare il testo */}
      <div className="absolute inset-0 z-0">
        {item.imageUrl ? (
          <>
            <img
              src={item.imageUrl}
              alt=""
              className="w-full h-full object-cover"
              style={{ filter: 'blur(12px) brightness(0.35) saturate(0.8)', transform: 'scale(1.1)' }}
            />
            {/* Overlay gradiente per leggibilità testo in basso */}
            <div className="absolute inset-0"
                 style={{ background: 'linear-gradient(to top, rgba(2,13,25,0.95) 40%, rgba(2,13,25,0.4) 100%)' }} />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center"
               style={{ background: 'var(--color-surface)' }}>
            <span className="text-5xl opacity-20">{typeIcon(item.type)}</span>
          </div>
        )}
      </div>

      {/* Contenuto sopra lo sfondo */}
      <div className="relative z-10 p-4 flex flex-col justify-between" style={{ minHeight: '160px' }}>

        {/* Top — badge wear + tipo */}
        <div className="flex items-start justify-between">
          <span className="text-lg">{typeIcon(item.type)}</span>
          {wearInfo && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: wearBg(wearInfo.level),
                    color: wearColor(wearInfo.level),
                    fontFamily: 'var(--font-display)'
                  }}>
              {wearIcon(wearInfo.level)} {wearInfo.shortLabel}
            </span>
          )}
        </div>

        {/* Bottom — nome e info */}
        <div>
          {item.brand && (
            <p className="text-xs mb-0.5"
               style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
              {item.brand}
            </p>
          )}
          <p className="text-sm font-bold leading-tight"
             style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            {displayName}
          </p>
          {subtitle && (
            <p className="text-xs mt-1"
               style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Helpers ────────────────────────────────────────────────

function getSubtitle(item) {
  if (item.type === 'racchetta') {
    if (item.strings?.brand) return `${item.strings.brand} ${item.strings.model || ''} ${item.strings.tension ? `· ${item.strings.tension}kg` : ''}`.trim()
    if (item.stringBrand)    return `${item.stringBrand} ${item.stringModel || ''} ${item.stringTension ? `· ${item.stringTension}kg` : ''}`.trim()
  }
  if (item.type === 'scarpa' && item.surface) {
    return Array.isArray(item.surface) ? item.surface.join(' · ') : item.surface
  }
  if (item.type === 'outfit') {
    return item.maglietta || null
  }
  return null
}

function getWearInfo(item, matchCount) {
  if (item.type === 'racchetta') {
    const dateStr = item.strings?.mountedAt || item.stringDate
    if (!dateStr) return null
    const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000)
    if (days > 90) return { level: 'high',   shortLabel: `${days}gg`, label: `Corde: ${days} giorni — considera il cambio` }
    if (days > 45) return { level: 'medium', shortLabel: `${days}gg`, label: `Corde montate ${days} giorni fa` }
    return { level: 'ok', shortLabel: `${days}gg`, label: `Corde ok — ${days} giorni fa` }
  }
  if (item.type === 'outfit' && matchCount > 50)
    return { level: 'medium', shortLabel: `${matchCount} match`, label: `${matchCount} partite giocate` }
  return null
}

const typeIcon    = t  => ({ racchetta: '🎾', scarpa: '👟', outfit: '👕', borsone: '🎒' }[t] || '📦')
const wearBg      = l  => ({ ok: 'rgba(72,179,176,0.2)', medium: 'rgba(244,163,0,0.2)', high: 'rgba(220,80,80,0.2)' }[l])
const wearColor   = l  => ({ ok: 'var(--color-teal-light)', medium: 'var(--color-amber-light)', high: '#ff7070' }[l])
const wearIcon    = l  => ({ ok: '✓', medium: '⚠', high: '●' }[l])