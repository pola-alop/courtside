import { computeWear, wearLevelMeta } from '../../lib/wear'

export default function EquipmentCard({ item, matches = [], onClick }) {
  const wearInfo = computeWear(item, matches)
  const subtitle = getSubtitle(item)
  const modelName = item.model || item.name || '—'
  const isArchived = item.active === false

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl overflow-hidden transition-all active:scale-95 relative"
      style={{
        border: '1px solid var(--color-surface-2)',
        minHeight: '160px',
        opacity: isArchived ? 0.65 : 1,
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
          <div className="flex flex-col items-end gap-1">
            {isArchived && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: 'rgba(107,114,128,0.35)',
                      color: 'var(--color-white)',
                      fontFamily: 'var(--font-display)'
                    }}>
                📦 Archiviata
              </span>
            )}
            {wearInfo && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: wearLevelMeta(wearInfo.level).badgeBg,
                      color: wearLevelMeta(wearInfo.level).color,
                      fontFamily: 'var(--font-display)'
                    }}>
                {wearLevelMeta(wearInfo.level).icon} {wearInfo.shortLabel}
              </span>
            )}
          </div>
        </div>

        {/* Bottom — modello, nickname, info corde */}
        <div>
          <p className="text-base font-bold leading-tight"
             style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            {modelName}
          </p>
          {item.nickname && (
            <p className="text-xs mt-0.5"
               style={{ color: 'var(--color-teal-light)', fontFamily: 'var(--font-display)' }}>
              {item.nickname}
            </p>
          )}
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
    if (item.strings?.brand) return `${item.strings.brand} ${item.strings.model || ''} ${formatTensionSuffix(item)}`.trim()
    if (item.stringBrand)    return `${item.stringBrand} ${item.stringModel || ''} ${formatTensionSuffix(item)}`.trim()
  }
  if (item.type === 'scarpa' && item.surface) {
    return Array.isArray(item.surface) ? item.surface.join(' · ') : item.surface
  }
  if (item.type === 'outfit') {
    return item.maglietta || null
  }
  return null
}

// Tensione verticali/orizzontali con fallback sulla vecchia tensione unica
// (strings.tension / stringTension) per i documenti non ancora migrati
function formatTensionSuffix(item) {
  const legacy   = item.strings?.tension           ?? item.stringTension           ?? null
  const mains    = item.strings?.tensionMains       ?? item.stringTensionMains      ?? legacy
  const crosses  = item.strings?.tensionCrosses     ?? item.stringTensionCrosses    ?? legacy
  if (mains == null && crosses == null) return ''
  if (mains === crosses) return `· ${mains}kg`
  return `· ${mains ?? '—'}/${crosses ?? '—'}kg`
}

const typeIcon    = t  => ({ racchetta: '🎾', scarpa: '👟', outfit: '👕', borsone: '🎒' }[t] || '📦')