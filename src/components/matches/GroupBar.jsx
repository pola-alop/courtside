import { useState } from 'react'

// Riga di chip "Tutti · gruppi · + Gruppo" in cima al tab Avversari. Con un
// gruppo selezionato sotto compare la sua intestazione con le azioni: membri,
// rinomina, elimina (con conferma; gli avversari non vengono toccati).
export default function GroupBar({
  groups, selectedGroup, memberCount = 0,
  onSelect, onNew, onMembers, onRename, onDelete
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <div className="flex gap-2" style={{ minWidth: 'max-content' }}>
          <GroupChip active={!selectedGroup} onClick={() => { setConfirming(false); onSelect(null) }}>Tutti</GroupChip>
          {groups.map(g => (
            <GroupChip key={g.id} active={selectedGroup?.id === g.id}
                       onClick={() => { setConfirming(false); onSelect(g.id) }}>
              {g.name}
            </GroupChip>
          ))}
          <GroupChip onClick={onNew} accent>+ Gruppo</GroupChip>
        </div>
      </div>

      {selectedGroup && (
        <div className="rounded-2xl p-3 space-y-3"
             style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate"
               style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
              {selectedGroup.name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-slate)' }}>
              {memberCount === 0 ? 'Nessun membro' : memberCount === 1 ? '1 membro' : `${memberCount} membri`}
            </p>
          </div>

          {confirming ? (
            <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-surface-2)' }}>
              <p className="text-xs mb-3 text-center" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                Eliminare il gruppo? Gli avversari non vengono toccati.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirming(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-medium"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
                  Annulla
                </button>
                <button onClick={() => { setConfirming(false); onDelete() }}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: '#e05555', color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                  Elimina
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <ActionButton onClick={onMembers}>👥 Membri</ActionButton>
              <ActionButton onClick={onRename}>✏️ Rinomina</ActionButton>
              <ActionButton onClick={() => setConfirming(true)} danger>🗑️ Elimina</ActionButton>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

function GroupChip({ active = false, accent = false, onClick, children }) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
      style={{
        background: active ? 'var(--color-teal-dark)' : 'var(--color-surface)',
        color: active ? 'var(--color-white)' : accent ? 'var(--color-amber)' : 'var(--color-slate)',
        border: active ? 'none' : '1px solid var(--color-surface-2)',
        fontFamily: 'var(--font-display)'
      }}>
      {children}
    </button>
  )
}

function ActionButton({ onClick, danger = false, children }) {
  return (
    <button onClick={onClick}
      className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
      style={{
        background: 'var(--color-surface-2)',
        color: danger ? '#e05555' : 'var(--color-teal)',
        fontFamily: 'var(--font-display)'
      }}>
      {children}
    </button>
  )
}
