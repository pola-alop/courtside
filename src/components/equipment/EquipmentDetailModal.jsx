import { useState } from 'react'

export default function EquipmentDetailModal({ item, onClose, onArchive, onDelete, onUpdate }) {
  const [mode, setMode]             = useState('view')  // view | edit | confirmArchive | confirmDelete
  const [editForm, setEditForm]     = useState({
    nickname:      item.nickname      || '',
    stringBrand:   item.strings?.brand  || item.stringBrand  || '',
    stringModel:   item.strings?.model  || item.stringModel  || '',
    stringTension: item.strings?.tension || item.stringTension || '',
    stringDate:    item.strings?.mountedAt
      ? item.strings.mountedAt.split('T')[0]
      : (item.stringDate || ''),
  })
  const [saving, setSaving] = useState(false)

  const setField = (k, v) => setEditForm(f => ({ ...f, [k]: v }))

  const handleSaveEdit = async () => {
    setSaving(true)
    await onUpdate(item.id, {
      nickname: editForm.nickname,
      strings: {
        brand:     editForm.stringBrand,
        model:     editForm.stringModel,
        tension:   editForm.stringTension ? Number(editForm.stringTension) : null,
        mountedAt: editForm.stringDate || null,
      },
      // Mantieni compatibilità con vecchi campi flat
      stringBrand:   editForm.stringBrand,
      stringModel:   editForm.stringModel,
      stringTension: editForm.stringTension ? Number(editForm.stringTension) : null,
      stringDate:    editForm.stringDate,
    })
    setSaving(false)
    setMode('view')
  }

  const wearInfo = getDetailedWearInfo(item)
  const hasImage = Boolean(item.imageUrl)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(2,13,25,0.9)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-3xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-surface-2)',
          maxHeight: '88vh'
        }}
      >
        {/* Immagine hero — container arrotondato */}
        <div
          className="relative shrink-0 mx-4 mt-4"
          style={{
            height: '180px',
            background: 'var(--color-surface-2)',
            borderRadius: '20px',
            overflow: 'hidden',
          }}
        >
          {hasImage ? (
            <>
              <img
                src={item.imageUrl}
                alt={item.model || item.name}
                className="w-full h-full object-contain p-6"
                style={{
                  borderRadius: '16px',   // ← bordi arrotondati sull'img stessa
                }}
              />
              <div
                className="absolute bottom-0 left-0 right-0 h-12"
                style={{
                  background: 'linear-gradient(to top, var(--color-surface-2), transparent)'
                }}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {item.type === 'racchetta'
                ? <RacketIcon size={64} color="rgba(255,255,255,0.1)" />
                : <span className="text-7xl opacity-10">{typeEmoji(item.type)}</span>
              }
            </div>
          )}

          {/* Bottone chiudi */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm"
            style={{ background: 'rgba(2,13,25,0.7)', color: 'var(--color-white)' }}
          >
            ✕
          </button>
        </div>

        {/* Contenuto scrollabile */}
        <div className="overflow-y-auto flex-1 px-6 py-4">

          {/* Intestazione + bottone modifica */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              {item.brand && (
                <p className="text-xs font-semibold uppercase tracking-wider mb-1"
                   style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
                  {item.brand}
                </p>
              )}
              <h2 className="text-xl font-bold"
                  style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                {item.nickname || item.model || item.name || '—'}
              </h2>
              {item.nickname && item.model && (
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-slate)' }}>{item.model}</p>
              )}
            </div>
            {mode === 'view' && (
              <button
                onClick={() => setMode('edit')}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold ml-3 shrink-0"
                style={{
                  background: 'var(--color-surface-2)',
                  color: 'var(--color-teal)',
                  fontFamily: 'var(--font-display)',
                  border: '1px solid var(--color-teal-dark)'
                }}>
                ✏️ Modifica
              </button>
            )}
          </div>

          {/* Badge usura */}
          {wearInfo && mode === 'view' && (
            <div className="mb-4 p-3 rounded-2xl flex items-center gap-3"
                 style={{ background: wearBg(wearInfo.level) }}>
              <span className="text-xl">
                {wearInfo.level === 'high' ? '🔴' : wearInfo.level === 'medium' ? '⚠️' : '✅'}
              </span>
              <div>
                <p className="text-sm font-semibold"
                   style={{ color: wearColor(wearInfo.level), fontFamily: 'var(--font-display)' }}>
                  {wearInfo.label}
                </p>
                {wearInfo.sub && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-slate)' }}>{wearInfo.sub}</p>
                )}
              </div>
            </div>
          )}

          {/* ── MODO VISUALIZZAZIONE ── */}
          {mode === 'view' && <>

            {item.type === 'racchetta' && (
              <>
                {item.nickname && (
                  <Section title="Identificazione">
                    <Row label="Nickname" value={item.nickname} />
                  </Section>
                )}
                <Section title="Specifiche telaio">
                  <Row label="Peso"          value={item.weight     ? `${item.weight}g`         : '—'} />
                  <Row label="Testa"         value={item.headSize   ? `${item.headSize} sq in`  : '—'} />
                  <Row label="Bilanciamento" value={item.balance    || '—'} />
                  <Row label="Pattern"       value={item.pattern    || '—'} />
                  <Row label="Flessibilità"  value={item.flexibility ? `RA ${item.flexibility}` : '—'} />
                </Section>
                <Section title="Corde montate">
                  <Row label="Marca"      value={item.strings?.brand    || item.stringBrand    || '—'} />
                  <Row label="Modello"    value={item.strings?.model    || item.stringModel    || '—'} />
                  <Row label="Tensione"   value={
                    (item.strings?.tension || item.stringTension)
                      ? `${item.strings?.tension || item.stringTension} kg` : '—'
                  } />
                  <Row label="Montate il" value={formatDate(item.strings?.mountedAt || item.stringDate)} />
                </Section>
              </>
            )}

            {item.type === 'scarpa' && (
              <>
                {item.nickname && (
                  <Section title="Identificazione">
                    <Row label="Nickname" value={item.nickname} />
                  </Section>
                )}
                <Section title="Dettagli">
                  <Row label="Superficie" value={
                    Array.isArray(item.surface) ? item.surface.join(', ') : (item.surface || '—')
                  } />
                </Section>
              </>
            )}

            {item.type === 'outfit' && (
              <Section title="Composizione outfit">
                <Row label="Maglietta"    value={item.maglietta    || '—'} />
                <Row label="Pantaloncini" value={item.pantaloncini || '—'} />
                <Row label="Calzini"      value={item.calzini      || '—'} />
                <Row label="Polsini"      value={item.polsini      || '—'} />
                <Row label="Fascia / Cap" value={item.fascia       || '—'} />
              </Section>
            )}

            {item.type === 'borsone' && item.notes && (
              <Section title="Note">
                <p className="text-sm px-4 py-3" style={{ color: 'var(--color-white)' }}>{item.notes}</p>
              </Section>
            )}
          </>}

          {/* ── MODO MODIFICA ── */}
          {mode === 'edit' && (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider"
                 style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-display)' }}>
                Modifica attrezzatura
              </p>

              {/* Nickname — disponibile per racchette e scarpe */}
              {(item.type === 'racchetta' || item.type === 'scarpa') && (
                <EditInput
                  label="Nickname"
                  value={editForm.nickname}
                  onChange={v => setField('nickname', v)}
                  placeholder="Es. Principale, Torneo..."
                />
              )}

              {/* Corde — solo per racchette */}
              {item.type === 'racchetta' && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider"
                     style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
                    Corde montate
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <EditInput label="Marca corda"   value={editForm.stringBrand}   onChange={v => setField('stringBrand', v)} />
                    <EditInput label="Modello corda"  value={editForm.stringModel}   onChange={v => setField('stringModel', v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <EditInput label="Tensione (kg)" type="number" value={editForm.stringTension} onChange={v => setField('stringTension', v)} />
                    <EditInput label="Data montaggio" type="date"  value={editForm.stringDate}    onChange={v => setField('stringDate', v)} />
                  </div>
                </div>
              )}

              {/* Bottoni modifica */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setMode('view')}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                  style={{
                    background: 'var(--color-surface-2)',
                    color: 'var(--color-slate)',
                    fontFamily: 'var(--font-display)'
                  }}>
                  Annulla
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
                  style={{
                    background: saving ? 'var(--color-surface-2)' : 'var(--color-amber)',
                    color: saving ? 'var(--color-slate)' : 'var(--color-bg)',
                    fontFamily: 'var(--font-display)'
                  }}>
                  {saving ? 'Salvo...' : 'Salva modifiche'}
                </button>
              </div>
            </div>
          )}

          {/* ── AZIONI (solo in view mode) ── */}
          {mode === 'view' && (
            <div className="mt-6 space-y-3 pb-2">

              {/* Archivia */}
              {mode !== 'confirmArchive' && mode !== 'confirmDelete' && (
                <button
                  onClick={() => setMode('confirmArchive')}
                  className="w-full py-3 rounded-2xl text-sm font-semibold transition-all"
                  style={{
                    background: 'var(--color-surface-2)',
                    color: 'var(--color-amber)',
                    fontFamily: 'var(--font-display)',
                    border: '1px solid rgba(244,163,0,0.2)'
                  }}>
                  📦 Archivia attrezzatura
                </button>
              )}

              {/* Elimina */}
              {mode !== 'confirmArchive' && mode !== 'confirmDelete' && (
                <button
                  onClick={() => setMode('confirmDelete')}
                  className="w-full py-3 rounded-2xl text-sm font-semibold transition-all"
                  style={{
                    background: 'var(--color-surface-2)',
                    color: '#e05555',
                    fontFamily: 'var(--font-display)',
                    border: '1px solid rgba(220,80,80,0.2)'
                  }}>
                  🗑️ Elimina definitivamente
                </button>
              )}

              {/* Conferma archivia */}
              {mode === 'confirmArchive' && (
                <ConfirmBox
                  message="Archivia questa attrezzatura? Rimarrà nello storico dei match."
                  confirmLabel="Archivia"
                  confirmColor="var(--color-amber)"
                  onCancel={() => setMode('view')}
                  onConfirm={() => { onArchive(item.id); onClose() }}
                />
              )}

              {/* Conferma elimina */}
              {mode === 'confirmDelete' && (
                <ConfirmBox
                  message="Eliminare definitivamente? Questa azione non può essere annullata."
                  confirmLabel="Elimina"
                  confirmColor="#e05555"
                  onCancel={() => setMode('view')}
                  onConfirm={() => { onDelete(item.id); onClose() }}
                />
              )}
            </div>
          )}
        </div>
      </div>
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

function EditInput({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div>
      <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
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

function ConfirmBox({ message, confirmLabel, confirmColor, onCancel, onConfirm }) {
  return (
    <div className="p-4 rounded-2xl"
         style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-surface-2)' }}>
      <p className="text-sm mb-3 text-center"
         style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
        {message}
      </p>
      <div className="flex gap-3">
        <button onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
          Annulla
        </button>
        <button onClick={onConfirm}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: confirmColor, color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return dateStr }
}

function getDetailedWearInfo(item) {
  if (item.type === 'racchetta') {
    const dateStr = item.strings?.mountedAt || item.stringDate
    if (!dateStr) return null
    const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000)
    if (days > 90) return { level: 'high',   label: 'Considera il cambio corde', sub: `Montate ${days} giorni fa` }
    if (days > 45) return { level: 'medium', label: 'Corde usate',               sub: `Montate ${days} giorni fa` }
    return { level: 'ok', label: 'Corde in buone condizioni', sub: `Montate ${days} giorni fa` }
  }
  return null
}

const typeIcon  = t => ({ racchetta: '🎾', scarpa: '👟', outfit: '👕', borsone: '🎒' }[t] || '📦')
const wearBg    = l => ({ ok: 'rgba(72,179,176,0.12)', medium: 'rgba(244,163,0,0.12)', high: 'rgba(220,80,80,0.12)' }[l])
const wearColor = l => ({ ok: 'var(--color-teal-light)', medium: 'var(--color-amber-light)', high: '#ff7070' }[l])