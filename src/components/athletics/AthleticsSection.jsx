import {
  HR_ZONES, hasAthletics, zonesTotalSec, zonePercents, avgSpeedKmh,
  trainingEffectLabel, formatDuration, formatSpeed, formatHr, formatTrainingEffect,
} from '../../lib/athletics'
import TrainingEffectInfoButton from './TrainingEffectInfo'

// Visualizzazione dei dati atletici di una sessione (partita o allenamento).
// Vive qui e non dentro MatchDetailModal perché è identica nei due dettagli:
// stessa shape `athletics`, stesse tile, stesso training effect, stesse zone.
// Interamente nascosta se la sessione non ha dati (le partite registrate prima
// della feature non hanno affatto il campo `athletics`).
export default function AthleticsSection({ athletics, title = 'Dati atletici' }) {
  if (!hasAthletics(athletics)) return null

  const speed = avgSpeedKmh(athletics)

  // Le tile mostrano solo i valori davvero presenti: una griglia con buchi
  // sarebbe peggio di una griglia più corta.
  // Numero nudo nella tile e unità nell'etichetta: con 2 colonne su mobile un
  // "2,54 km" a caratteri grandi va a capo, "2,54" no.
  const tiles = [
    { key: 'dist', label: 'Distanza (km)', show: isSet(athletics.distanceKm),  value: athletics.distanceKm.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), color: 'var(--color-teal)' },
    { key: 'time', label: 'Tempo',         show: isSet(athletics.durationSec), value: formatDuration(athletics.durationSec), color: 'var(--color-white)' },
    { key: 'kcal', label: 'Calorie',       show: isSet(athletics.calories),    value: Math.round(athletics.calories).toLocaleString('it-IT'), color: 'var(--color-amber)' },
    { key: 'hr',   label: 'FC media (bpm)', show: isSet(athletics.avgHr),      value: String(Math.round(athletics.avgHr)), color: 'var(--color-loss)' },
  ].filter(t => t.show)

  const rows = [
    { key: 'maxHr', label: 'FC massima',   show: isSet(athletics.maxHr),          value: formatHr(athletics.maxHr) },
    { key: 'speed', label: 'Velocità media (calcolata)', show: speed !== null,    value: formatSpeed(speed) },
  ].filter(r => r.show)

  const zonesTotal = zonesTotalSec(athletics.zones)

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-wider mb-2"
         style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
        {title}
      </p>

      {tiles.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          {tiles.map(t => (
            <div key={t.key} className="rounded-2xl px-2 py-3 text-center" style={{ background: 'var(--color-surface-2)' }}>
              <p className="text-xl font-bold" style={{ color: t.color, fontFamily: 'var(--font-display)' }}>{t.value}</p>
              <p className="text-[11px] mt-0.5 uppercase tracking-wider" style={{ color: 'var(--color-slate)' }}>{t.label}</p>
            </div>
          ))}
        </div>
      )}

      <TrainingEffectSection
        trainingEffect={athletics.trainingEffect}
        anaerobicTrainingEffect={athletics.anaerobicTrainingEffect}
      />

      {rows.length > 0 && (
        <div className="rounded-2xl overflow-hidden mb-2" style={{ background: 'var(--color-surface-2)' }}>
          {rows.map(r => <Row key={r.key} label={r.label} value={r.value} />)}
        </div>
      )}

      {zonesTotal > 0 && <ZonesBreakdown zones={athletics.zones} total={zonesTotal} />}
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span className="text-xs" style={{ color: 'var(--color-slate)' }}>{label}</span>
      <span className="text-xs font-medium" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>{value}</span>
    </div>
  )
}

// Le soglie di colore (5 segmenti pieni + il cap rosso a 5,0) ricalcano
// esattamente le 6 fasce di trainingEffectLabel/TrainingEffectInfo — stessa
// scala Garmin, stesso colore per la stessa fascia in entrambi i punti.
const TE_SEGMENT_COLORS = ['var(--color-slate)', 'var(--color-slate)', 'var(--color-draw)', 'var(--color-win)', 'var(--color-amber)']
const TE_CAP_COLOR = 'var(--color-loss)'
const TE_AEROBIC_COLOR = 'var(--color-draw)'
const TE_ANAEROBIC_COLOR = 'var(--color-slate)'

function TrainingEffectSection({ trainingEffect, anaerobicTrainingEffect }) {
  const hasAerobic = isSet(trainingEffect)
  const hasAnaerobic = isSet(anaerobicTrainingEffect)
  if (!hasAerobic && !hasAnaerobic) return null

  return (
    <div className="rounded-2xl px-4 py-3 mb-2" style={{ background: 'var(--color-surface-2)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-slate)' }}>
          Training effect
        </span>
        <TrainingEffectInfoButton />
      </div>

      <div className="flex mb-4">
        {hasAerobic && (
          <div className="flex-1 pt-2 pr-3" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <p className="text-2xl font-bold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
              {formatTrainingEffect(trainingEffect)}
            </p>
            <span className="text-[11px] flex items-center gap-1.5 mt-0.5" style={{ color: 'var(--color-slate)' }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TE_AEROBIC_COLOR }} />
              Aerobico
            </span>
          </div>
        )}
        {hasAnaerobic && (
          <div className="flex-1 pt-2 pl-3" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <p className="text-2xl font-bold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
              {formatTrainingEffect(anaerobicTrainingEffect)}
            </p>
            <span className="text-[11px] flex items-center gap-1.5 mt-0.5" style={{ color: 'var(--color-slate)' }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TE_ANAEROBIC_COLOR }} />
              Anaerobico
            </span>
          </div>
        )}
      </div>

      {hasAerobic && (
        <div className={hasAnaerobic ? 'mb-4' : ''}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>Aerobico</span>
            <span className="text-[11px]" style={{ color: 'var(--color-slate)' }}>{trainingEffectLabel(trainingEffect)}</span>
          </div>
          <TrainingEffectBar value={trainingEffect} />
        </div>
      )}

      {hasAnaerobic && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>Anaerobico</span>
            <span className="text-[11px]" style={{ color: 'var(--color-slate)' }}>{trainingEffectLabel(anaerobicTrainingEffect)}</span>
          </div>
          <TrainingEffectBar value={anaerobicTrainingEffect} />
        </div>
      )}
    </div>
  )
}

// Il colore di ogni fascia (0-1, 1-2, ... 4-5, 5.0) — stesse soglie di
// trainingEffectLabel/TrainingEffectInfo, usata sia per i segmenti della
// barra sia per il pallino, che deve sempre avere il colore della fascia in
// cui cade il valore reale.
function teColorAt(value) {
  const i = Math.min(4, Math.floor(Math.max(0, value)))
  return value >= 5 ? TE_CAP_COLOR : TE_SEGMENT_COLORS[i]
}

// Barra a 5 segmenti pieni (0..5, una fascia per punto) più un cap sottile
// che rappresenta la fascia "Eccessivo" a 5,0. Il pallino indica il valore
// reale, con il colore della fascia sotto di esso.
function TrainingEffectBar({ value }) {
  const pct = Math.min(100, Math.max(0, (value / 5) * 100))
  const dotColor = teColorAt(value)

  return (
    <div className="flex items-center gap-1">
      <div className="relative flex-1 flex h-2.5">
        {TE_SEGMENT_COLORS.map((color, i) => (
          <div key={i} className="h-full"
            style={{
              flex: 1,
              background: color,
              marginRight: i < TE_SEGMENT_COLORS.length - 1 ? 2 : 0,
              borderTopLeftRadius: i === 0 ? 9999 : 0,
              borderBottomLeftRadius: i === 0 ? 9999 : 0,
            }} />
        ))}
        <div className="absolute top-1/2 w-4 h-4 rounded-full"
          style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)', background: dotColor, border: '3px solid var(--color-surface-2)' }} />
      </div>
      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TE_CAP_COLOR }} />
    </div>
  )
}

function ZonesBreakdown({ zones, total }) {
  const percents = zonePercents(zones)

  return (
    <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--color-surface-2)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-slate)' }}>
          Tempo in zone
        </span>
        <span className="text-[11px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          {formatDuration(total)}
        </span>
      </div>

      {/* Barra impilata: le zone a 0 non occupano spazio */}
      <div className="flex w-full h-2.5 rounded-full overflow-hidden mb-3" style={{ background: 'var(--color-surface)' }}>
        {HR_ZONES.map((z, i) => (
          percents[i] > 0 ? (
            <div key={z.id} style={{ width: `${percents[i]}%`, background: z.color }} />
          ) : null
        ))}
      </div>

      <div className="space-y-1.5">
        {HR_ZONES.map((z, i) => {
          const sec = zones?.[i] || 0
          if (sec <= 0) return null
          return (
            <div key={z.id} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: z.color }} />
              <span className="text-[11px] font-semibold shrink-0" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                {z.label}
              </span>
              <span className="text-[11px] flex-1 truncate" style={{ color: 'var(--color-slate)' }}>{z.name}</span>
              <span className="text-[11px] shrink-0" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
                {formatDuration(sec)}
              </span>
              <span className="text-[11px] w-9 text-right shrink-0" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                {Math.round(percents[i])}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

// Un campo atletico è "presente" solo se è davvero un numero: `0` è un valore
// legittimo (es. 0 calorie non ha senso, ma 0 non deve sparire per falsy).
const isSet = v => typeof v === 'number' && Number.isFinite(v)
