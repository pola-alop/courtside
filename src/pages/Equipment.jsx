import { useState } from 'react'
import { useEquipment } from '../hooks/useEquipment'
import { useMatches } from '../hooks/useMatches'
import EquipmentCard from '../components/equipment/EquipmentCard'
import AddEquipmentModal from '../components/equipment/AddEquipmentModal'
import EquipmentDetailModal from '../components/equipment/EquipmentDetailModal'

const TABS = [
  { id: 'all',       label: 'Tutto',     icon: '⬡'  },
  { id: 'racchetta', label: 'Racchette', icon: '🎾' },
  { id: 'scarpa',    label: 'Scarpe',    icon: '👟' },
  { id: 'outfit',    label: 'Outfit',    icon: '👕' },
  { id: 'borsone',   label: 'Borsoni',   icon: '🎒' },
]

const CLUSTER_ORDER = [
  { type: 'racchetta', label: 'Racchette', icon: '🎾' },
  { type: 'scarpa',    label: 'Scarpe',    icon: '👟' },
  { type: 'outfit',    label: 'Outfit',    icon: '👕' },
  { type: 'borsone',   label: 'Borsoni',   icon: '🎒' },
]

export default function Equipment() {
  const { equipment, loading, add, update, archive, unarchive, remove, addStrings, deleteStringsHistory } = useEquipment()
  // Match dell'utente: chiudono il cerchio con l'attrezzatura (usura corde/suola
  // calcolata dai game giocati con ogni capo). Vedi src/lib/wear.js.
  const { matches } = useMatches()
  const [activeTab, setActiveTab]     = useState('all')
  const [showAdd, setShowAdd]         = useState(false)
  const [selectedId, setSelectedId]   = useState(null)
  const [deleteToast, setDeleteToast] = useState(false)

  // Derivato da equipment (non copiato in uno state a parte) così la modale
  // di dettaglio resta sempre sincronizzata dopo un reload (es. cambio corde)
  const selectedItem = selectedId ? equipment.find(e => e.id === selectedId) || null : null

  const activeEquipment   = equipment.filter(e => e.active !== false)
  const archivedEquipment = equipment.filter(e => e.active === false)

  // Vista "Tutto" mostra solo le attrezzature in uso, mai le archiviate
  const filteredActive = activeEquipment.filter(e =>
    activeTab === 'all' || e.type === activeTab
  )

  // Nei tab specifici le archiviate compaiono in una sezione dedicata
  const filteredArchived = activeTab === 'all'
    ? []
    : archivedEquipment.filter(e => e.type === activeTab)

  const isEmpty = filteredActive.length === 0 && filteredArchived.length === 0

  const modalInitialType = activeTab === 'all' ? null : activeTab

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>

      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1"
             style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
            Il tuo gear
          </p>
          <h1 className="text-2xl font-bold"
              style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            Equipment
          </h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl font-bold transition-all active:scale-95"
          style={{ background: 'var(--color-amber)', color: 'var(--color-bg)' }}>
          +
        </button>
      </div>

      {/* Tab bar */}
      <div className="px-6 pb-4 overflow-x-auto">
        <div className="flex gap-2" style={{ minWidth: 'max-content' }}>
          {TABS.map(tab => (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap"
              style={{
                background: activeTab === tab.id ? 'var(--color-teal-dark)' : 'var(--color-surface)',
                color: activeTab === tab.id ? 'var(--color-white)' : 'var(--color-slate)',
                fontFamily: 'var(--font-display)',
                border: activeTab === tab.id ? 'none' : '1px solid var(--color-surface-2)'
              }}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Contenuto */}
      <div className="px-6 pb-32">
        {loading ? (
          <div className="flex justify-center pt-20">
            <div className="w-6 h-6 rounded-full border-2 animate-spin"
                 style={{ borderColor: 'var(--color-teal-dark)', borderTopColor: 'transparent' }} />
          </div>

        ) : isEmpty ? (
          <EmptyState type={activeTab} onAdd={() => setShowAdd(true)} />

        ) : activeTab === 'all' ? (
          /* Vista "Tutto" — cluster per tipo, solo attrezzature in uso */
          <div className="space-y-6">
            {CLUSTER_ORDER.map(cluster => {
              const items = activeEquipment.filter(e => e.type === cluster.type)
              if (items.length === 0) return null
              return (
                <div key={cluster.type}>
                  {/* Titoletto cluster */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm">{cluster.icon}</span>
                    <p className="text-xs font-semibold uppercase tracking-wider"
                       style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
                      {cluster.label}
                    </p>
                    <div className="flex-1 h-px ml-2"
                         style={{ background: 'var(--color-surface-2)' }} />
                  </div>
                  {/* Griglia */}
                  <div className="grid grid-cols-2 gap-3">
                    {items.map(item => (
                      <EquipmentCard
                        key={item.id}
                        item={item}
                        matches={matches}
                        onClick={() => setSelectedId(item.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

        ) : (
          /* Vista tab specifica — in uso + sezione archiviate */
          <div className="space-y-6">
            {filteredActive.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {filteredActive.map(item => (
                  <EquipmentCard
                    key={item.id}
                    item={item}
                    matches={matches}
                    onClick={() => setSelectedId(item.id)}
                  />
                ))}
              </div>
            )}

            {filteredArchived.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm">📦</span>
                  <p className="text-xs font-semibold uppercase tracking-wider"
                     style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
                    Archiviate
                  </p>
                  <div className="flex-1 h-px ml-2"
                       style={{ background: 'var(--color-surface-2)' }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {filteredArchived.map(item => (
                    <EquipmentCard
                      key={item.id}
                      item={item}
                      matches={matches}
                      onClick={() => setSelectedId(item.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal aggiunta */}
      {showAdd && (
        <AddEquipmentModal
          initialType={modalInitialType}
          onClose={() => setShowAdd(false)}
          onSave={async (data) => { await add(data) }}
        />
      )}

      {/* Modal dettaglio */}
      {selectedItem && (
        <EquipmentDetailModal
          item={selectedItem}
          matches={matches}
          onClose={() => setSelectedId(null)}
          onArchive={async (id) => {
            await archive(id)
            setSelectedId(null)
          }}
          onUnarchive={async (id) => {
            await unarchive(id)
            setSelectedId(null)
          }}
          onDelete={async (id) => {
            await remove(id)
            setSelectedId(null)
            setDeleteToast(true)
          }}
          onUpdate={async (id, data) => {
            await update(id, data)
          }}
          onAddStrings={async (id, stringData) => {
            await addStrings(id, stringData)
          }}
          onDeleteStringsHistory={async (id, entry) => {
            await deleteStringsHistory(id, entry)
          }}
        />
      )}

      {/* Toast conferma eliminazione */}
      {deleteToast && (
        <DeleteToast onClose={() => setDeleteToast(false)} />
      )}
    </div>
  )
}

function DeleteToast({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: 'rgba(2,13,25,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-xs rounded-3xl p-6 text-center"
           style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
        <span className="text-4xl mb-3 block">✅</span>
        <p className="text-base font-semibold mb-1"
           style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          Attrezzatura eliminata
        </p>
        <p className="text-sm mb-5" style={{ color: 'var(--color-slate)' }}>
          È stata rimossa definitivamente dal tuo gear.
        </p>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
          style={{ background: 'var(--color-amber)', color: 'var(--color-bg)', fontFamily: 'var(--font-display)' }}>
          Ok
        </button>
      </div>
    </div>
  )
}

function EmptyState({ type, onAdd }) {
  const messages = {
    all:       { icon: '🎾', text: 'Nessuna attrezzatura ancora.',  sub: 'Aggiungi la tua prima racchetta o scarpa.' },
    racchetta: { icon: '🎾', text: 'Nessuna racchetta.',            sub: 'Aggiungi la racchetta con cui giochi.' },
    scarpa:    { icon: '👟', text: 'Nessuna scarpa.',               sub: 'Aggiungi le tue scarpe da tennis.' },
    outfit:    { icon: '👕', text: 'Nessun outfit salvato.',        sub: 'Crea un outfit per richiamarlo nei match.' },
    borsone:   { icon: '🎒', text: 'Nessun borsone.',              sub: 'Aggiungi il tuo borsone.' },
  }
  const m = messages[type] || messages.all
  return (
    <div className="flex flex-col items-center justify-center pt-20 text-center">
      <span className="text-5xl mb-4">{m.icon}</span>
      <p className="text-base font-semibold mb-1"
         style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
        {m.text}
      </p>
      <p className="text-sm mb-6" style={{ color: 'var(--color-slate)' }}>{m.sub}</p>
      <button
        onClick={onAdd}
        className="px-6 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
        style={{ background: 'var(--color-amber)', color: 'var(--color-bg)', fontFamily: 'var(--font-display)' }}>
        + Aggiungi
      </button>
    </div>
  )
}