import { useState } from 'react'
import { computeWear, wearLevelMeta } from '../../lib/wear'

export default function EquipmentDetailModal({
  item, matches = [], onClose, onArchive, onUnarchive, onDelete, onUpdate, onAddStrings, onDeleteStringsHistory
}) {
  const [mode, setMode]             = useState('view')  // view | edit | addStrings | confirmArchive | confirmUnarchive | confirmDelete
  const [editForm, setEditForm]     = useState(null)
  const [newStringsForm, setNewStringsForm] = useState(null)
  const [saving, setSaving] = useState(false)

  // Storico: voce in attesa di conferma eliminazione / popup di esito
  const [historyDeleteTarget, setHistoryDeleteTarget] = useState(null)
  const [historyDeleteDone, setHistoryDeleteDone]     = useState(false)

  const setField = (k, v) => setEditForm(f => ({ ...f, [k]: v }))

  // Il modale resta montato mentre "item" si aggiorna (es. dopo una nuova
  // incordatura): il form va quindi ricalcolato da item ad ogni apertura,
  // non una volta sola al mount, altrimenti "Modifica" mostra dati stantii.
  const openEdit = () => {
    const { mains, crosses } = getCurrentTensions(item)
    setEditForm({
      nickname:            item.nickname      || '',
      stringBrand:         item.strings?.brand  || item.stringBrand  || '',
      stringModel:         item.strings?.model  || item.stringModel  || '',
      stringTensionMains:   mains   ?? '',
      stringTensionCrosses: crosses ?? '',
      stringDate:    item.strings?.mountedAt
        ? item.strings.mountedAt.split('T')[0]
        : (item.stringDate || ''),
    })
    setMode('edit')
  }

  // Modifica: corregge nickname e i dati dell'incordatura ATTUALE sul posto,
  // senza toccare lo storico (per quello c'è "Nuova incordatura")
  const handleSaveEdit = async () => {
    setSaving(true)
    const data = { nickname: editForm.nickname }
    if (item.type === 'racchetta') {
      data.strings = {
        brand:          editForm.stringBrand || null,
        model:          editForm.stringModel || null,
        tensionMains:   editForm.stringTensionMains   ? Number(editForm.stringTensionMains)   : null,
        tensionCrosses: editForm.stringTensionCrosses ? Number(editForm.stringTensionCrosses) : null,
        mountedAt: editForm.stringDate ? new Date(editForm.stringDate).toISOString() : null,
      }
    }
    await onUpdate(item.id, data)
    setSaving(false)
    setEditForm(null)
    setMode('view')
  }

  const openAddStrings = () => {
    const { mains, crosses } = getCurrentTensions(item)
    setNewStringsForm({
      brand:          item.strings?.brand    || item.stringBrand    || '',
      model:          item.strings?.model    || item.stringModel    || '',
      tensionMains:   mains   ?? '',
      tensionCrosses: crosses ?? '',
      mountedAt: new Date().toISOString().split('T')[0],
    })
    setMode('addStrings')
  }

  // Nuova incordatura: l'attuale diventa storica, questa diventa quella attuale
  const handleSaveNewStrings = async () => {
    setSaving(true)
    await onAddStrings(item.id, {
      brand:          newStringsForm.brand || null,
      model:          newStringsForm.model || null,
      tensionMains:   newStringsForm.tensionMains   ? Number(newStringsForm.tensionMains)   : null,
      tensionCrosses: newStringsForm.tensionCrosses ? Number(newStringsForm.tensionCrosses) : null,
      mountedAt: newStringsForm.mountedAt ? new Date(newStringsForm.mountedAt).toISOString() : new Date().toISOString(),
    })
    setSaving(false)
    setNewStringsForm(null)
    setMode('view')
  }

  const handleConfirmDeleteHistory = async () => {
    const entry = historyDeleteTarget
    setHistoryDeleteTarget(null)
    await onDeleteStringsHistory(item.id, entry)
    setHistoryDeleteDone(true)
  }

  const wearInfo = computeWear(item, matches)
  const hasImage = Boolean(item.imageUrl)
  const isArchived = item.active === false

  return (
    <>
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
        {/* Immagine hero — solo immagine, nessun container */}
        <div className="relative shrink-0 mx-4 mt-4 flex justify-center" style={{ height: '180px' }}>
          {hasImage ? (
            <img
              src={item.imageUrl}
              alt={item.model || item.name}
              className="h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-7xl opacity-10">{typeIcon(item.type)}</span>
            </div>
          )}

          {/* Bottone chiudi — solo nella scheda principale di dettaglio */}
          {mode === 'view' && (
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm"
              style={{ background: 'rgba(2,13,25,0.7)', color: 'var(--color-white)' }}
            >
              ✕
            </button>
          )}
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
                onClick={openEdit}
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

          {/* Badge archiviata */}
          {isArchived && mode === 'view' && (
            <div className="mb-4 p-3 rounded-2xl flex items-center gap-3"
                 style={{ background: 'rgba(107,114,128,0.15)' }}>
              <span className="text-xl">📦</span>
              <p className="text-sm font-semibold"
                 style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
                Attrezzatura archiviata
              </p>
            </div>
          )}

          {/* Badge usura — livello, dettaglio e barra di consumo (0→100%) */}
          {wearInfo && mode === 'view' && (
            <div className="mb-4 p-3 rounded-2xl"
                 style={{ background: wearLevelMeta(wearInfo.level).boxBg }}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{wearLevelMeta(wearInfo.level).emoji}</span>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold"
                       style={{ color: wearLevelMeta(wearInfo.level).color, fontFamily: 'var(--font-display)' }}>
                      {wearInfo.label}
                    </p>
                    {wearInfo.percent != null && (
                      <span className="text-sm font-bold"
                            style={{ color: wearLevelMeta(wearInfo.level).color, fontFamily: 'var(--font-mono)' }}>
                        {wearInfo.percent}%
                      </span>
                    )}
                  </div>
                  {wearInfo.sub && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-slate)' }}>{wearInfo.sub}</p>
                  )}
                </div>
              </div>
              {/* Barra: percentuale di vita consumata (limitata al 100% in larghezza) */}
              {wearInfo.percent != null && (
                <div className="mt-3 h-1.5 rounded-full overflow-hidden"
                     style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full rounded-full"
                       style={{
                         width: `${Math.min(wearInfo.percent, 100)}%`,
                         background: wearLevelMeta(wearInfo.level).bar,
                       }} />
                </div>
              )}
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
                <Section title="Corde attuali">
                  <Row label="Marca"      value={item.strings?.brand    || item.stringBrand    || '—'} />
                  <Row label="Modello"    value={item.strings?.model    || item.stringModel    || '—'} />
                  <Row label="Tensione verticali"   value={formatTension(getCurrentTensions(item).mains)} />
                  <Row label="Tensione orizzontali" value={formatTension(getCurrentTensions(item).crosses)} />
                  <Row label="Montate il" value={formatDate(item.strings?.mountedAt || item.stringDate)} />
                </Section>
                <button
                  onClick={openAddStrings}
                  className="w-full mb-4 py-2.5 rounded-2xl text-xs font-semibold transition-all"
                  style={{
                    background: 'var(--color-surface-2)',
                    color: 'var(--color-amber)',
                    fontFamily: 'var(--font-display)',
                    border: '1px solid rgba(244,163,0,0.2)'
                  }}>
                  🧵 Registra nuova incordatura
                </button>
                <StringsHistorySection
                  history={item.stringsHistory}
                  onRequestDelete={setHistoryDeleteTarget}
                />
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
          {mode === 'edit' && editForm && (
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

              {/* Corde — solo per racchette. Corregge l'incordatura ATTUALE,
                  non registra un cambio corde (per quello: "Nuova incordatura") */}
              {item.type === 'racchetta' && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider"
                     style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
                    Corde attuali
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <EditInput label="Marca corda"   value={editForm.stringBrand}   onChange={v => setField('stringBrand', v)} />
                    <EditInput label="Modello corda"  value={editForm.stringModel}   onChange={v => setField('stringModel', v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <EditInput label="Tensione verticali (kg)"   type="number" value={editForm.stringTensionMains}   onChange={v => setField('stringTensionMains', v)} />
                    <EditInput label="Tensione orizzontali (kg)" type="number" value={editForm.stringTensionCrosses} onChange={v => setField('stringTensionCrosses', v)} />
                  </div>
                  <EditInput label="Data montaggio" type="date" value={editForm.stringDate} onChange={v => setField('stringDate', v)} />
                </div>
              )}

              {/* Bottoni modifica */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setMode('view'); setEditForm(null) }}
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

          {/* ── MODO NUOVA INCORDATURA ── */}
          {mode === 'addStrings' && newStringsForm && (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider"
                 style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-display)' }}>
                Nuova incordatura
              </p>
              <p className="text-xs" style={{ color: 'var(--color-slate)' }}>
                L'incordatura attuale verrà spostata nello storico.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <EditInput label="Marca corda"    value={newStringsForm.brand}   onChange={v => setNewStringsForm(f => ({ ...f, brand: v }))} />
                <EditInput label="Modello corda"  value={newStringsForm.model}   onChange={v => setNewStringsForm(f => ({ ...f, model: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <EditInput label="Tensione verticali (kg)"   type="number" value={newStringsForm.tensionMains}   onChange={v => setNewStringsForm(f => ({ ...f, tensionMains: v }))} />
                <EditInput label="Tensione orizzontali (kg)" type="number" value={newStringsForm.tensionCrosses} onChange={v => setNewStringsForm(f => ({ ...f, tensionCrosses: v }))} />
              </div>
              <EditInput label="Data montaggio" type="date" value={newStringsForm.mountedAt} onChange={v => setNewStringsForm(f => ({ ...f, mountedAt: v }))} />

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setMode('view'); setNewStringsForm(null) }}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                  style={{
                    background: 'var(--color-surface-2)',
                    color: 'var(--color-slate)',
                    fontFamily: 'var(--font-display)'
                  }}>
                  Annulla
                </button>
                <button
                  onClick={handleSaveNewStrings}
                  disabled={saving}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
                  style={{
                    background: saving ? 'var(--color-surface-2)' : 'var(--color-amber)',
                    color: saving ? 'var(--color-slate)' : 'var(--color-bg)',
                    fontFamily: 'var(--font-display)'
                  }}>
                  {saving ? 'Salvo...' : 'Salva incordatura'}
                </button>
              </div>
            </div>
          )}

          {/* ── AZIONI (view + conferme) ── */}
          {(mode === 'view' || mode === 'confirmArchive' || mode === 'confirmUnarchive' || mode === 'confirmDelete') && (
            <div className="mt-6 space-y-3 pb-2">

              {/* Archivia / Riattiva */}
              {mode === 'view' && (
                isArchived ? (
                  <button
                    onClick={() => setMode('confirmUnarchive')}
                    className="w-full py-3 rounded-2xl text-sm font-semibold transition-all"
                    style={{
                      background: 'var(--color-surface-2)',
                      color: 'var(--color-teal)',
                      fontFamily: 'var(--font-display)',
                      border: '1px solid rgba(72,179,176,0.3)'
                    }}>
                    🔓 Riattiva attrezzatura
                  </button>
                ) : (
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
                )
              )}

              {/* Elimina */}
              {mode === 'view' && (
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

              {/* Conferma riattiva */}
              {mode === 'confirmUnarchive' && (
                <ConfirmBox
                  message="Riattivare questa attrezzatura? Tornerà tra quelle in uso."
                  confirmLabel="Riattiva"
                  confirmColor="var(--color-teal-dark)"
                  onCancel={() => setMode('view')}
                  onConfirm={() => { onUnarchive(item.id); onClose() }}
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

    {/* Conferma eliminazione voce storico */}
    {historyDeleteTarget && (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center px-6"
        style={{ background: 'rgba(2,13,25,0.85)' }}
        onClick={e => { if (e.target === e.currentTarget) setHistoryDeleteTarget(null) }}
      >
        <div className="w-full max-w-xs rounded-3xl p-6"
             style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
          <p className="text-sm mb-1 text-center font-semibold"
             style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            Eliminare questa incordatura dallo storico?
          </p>
          <p className="text-xs mb-4 text-center" style={{ color: 'var(--color-slate)' }}>
            {[historyDeleteTarget.brand, historyDeleteTarget.model].filter(Boolean).join(' ') || '—'}
            {' · '}
            {formatDate(historyDeleteTarget.mountedAt)}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setHistoryDeleteTarget(null)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
              Annulla
            </button>
            <button
              onClick={handleConfirmDeleteHistory}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: '#e05555', color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
              Elimina
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Esito eliminazione voce storico */}
    {historyDeleteDone && (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center px-6"
        style={{ background: 'rgba(2,13,25,0.85)' }}
        onClick={e => { if (e.target === e.currentTarget) setHistoryDeleteDone(false) }}
      >
        <div className="w-full max-w-xs rounded-3xl p-6 text-center"
             style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
          <span className="text-4xl mb-3 block">✅</span>
          <p className="text-base font-semibold mb-1"
             style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            Incordatura eliminata
          </p>
          <p className="text-sm mb-5" style={{ color: 'var(--color-slate)' }}>
            È stata rimossa dallo storico.
          </p>
          <button
            onClick={() => setHistoryDeleteDone(false)}
            className="w-full py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: 'var(--color-amber)', color: 'var(--color-bg)', fontFamily: 'var(--font-display)' }}>
            Ok
          </button>
        </div>
      </div>
    )}
    </>
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

const HISTORY_PREVIEW_COUNT = 3

function StringsHistorySection({ history, onRequestDelete }) {
  const [expanded, setExpanded] = useState(false)

  const sorted = [...(history || [])].sort(
    (a, b) => new Date(b.mountedAt || 0) - new Date(a.mountedAt || 0)
  )
  if (sorted.length === 0) return null

  const visible = expanded ? sorted : sorted.slice(0, HISTORY_PREVIEW_COUNT)
  const hiddenCount = sorted.length - visible.length

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-wider mb-2"
         style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
        Storico incordature
      </p>
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
        {visible.map((s, i) => (
          <StringHistoryRow key={i} strings={s} onDelete={() => onRequestDelete(s)} />
        ))}
        {hiddenCount > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full text-center px-4 py-2.5 text-xs font-semibold"
            style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
            Mostra altre {hiddenCount} incordature
          </button>
        )}
      </div>
    </div>
  )
}

function StringHistoryRow({ strings, onDelete }) {
  const label = [strings.brand, strings.model].filter(Boolean).join(' ') || '—'
  return (
    <div className="flex justify-between items-center px-4 py-3"
         style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div>
        <p className="text-xs font-medium" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
          {label}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-slate)' }}>
          {formatDate(strings.mountedAt)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        <span className="text-xs font-medium"
              style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          {formatTensionPair(strings)}
        </span>
        <button
          onClick={onDelete}
          aria-label="Elimina incordatura dallo storico"
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0"
          style={{ background: 'rgba(220,80,80,0.12)', color: '#e05555' }}>
          🗑️
        </button>
      </div>
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

// Tensione verticali (mains) / orizzontali (crosses) attuali, con fallback
// sulla vecchia tensione unica (strings.tension / stringTension) per i
// documenti non ancora migrati
function getCurrentTensions(item) {
  const legacy = item.strings?.tension ?? item.stringTension ?? null
  return {
    mains:   item.strings?.tensionMains   ?? item.stringTensionMains   ?? legacy,
    crosses: item.strings?.tensionCrosses ?? item.stringTensionCrosses ?? legacy,
  }
}

function formatTension(value) {
  return (value || value === 0) ? `${value} kg` : '—'
}

// Formato compatto per lo storico: "23/25 kg" (verticali/orizzontali),
// con fallback sulla vecchia tensione unica salvata nelle voci storiche
function formatTensionPair(strings) {
  const legacy  = strings.tension ?? null
  const mains   = strings.tensionMains   ?? legacy
  const crosses = strings.tensionCrosses ?? legacy
  if (mains == null && crosses == null) return '—'
  if (mains === crosses) return `${mains} kg`
  return `${mains ?? '—'}/${crosses ?? '—'} kg`
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return dateStr }
}

const typeIcon  = t => ({ racchetta: '🎾', scarpa: '👟', outfit: '👕', borsone: '🎒' }[t] || '📦')