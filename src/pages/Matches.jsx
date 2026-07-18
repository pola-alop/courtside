import { useState } from 'react'
import { useOpponents } from '../hooks/useOpponents'
import OpponentCard from '../components/matches/OpponentCard'
import AddOpponentModal from '../components/matches/AddOpponentModal'
import OpponentDetailModal from '../components/matches/OpponentDetailModal'

const TABS = [
  { id: 'panoramica',  label: 'Panoramica',  icon: '🗂' },
  { id: 'partite',     label: 'Partite',     icon: '🎾' },
  { id: 'avversari',   label: 'Avversari',   icon: '👥' },
  { id: 'allenamenti', label: 'Allenamenti', icon: '🎯' },
]

// Le partite non esistono ancora come dominio. Quando la sezione "Partite" sarà
// pronta questo array arriverà da un hook `useMatches`, e il record H2H di ogni
// avversario si popolerà da solo — è il punto di chiusura del cerchio.
const MATCHES = []

export default function Matches() {
  const { opponents, loading, add, update, remove } = useOpponents()
  const [activeTab, setActiveTab]   = useState('avversari')
  const [showAdd, setShowAdd]       = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch]         = useState('')
  const [deleteToast, setDeleteToast] = useState(false)

  // Item selezionato derivato (non copiato) così il dettaglio resta in sync
  const selectedOpponent = selectedId ? opponents.find(o => o.id === selectedId) || null : null

  const recordFor = (opponentId) => {
    const played = MATCHES.filter(m => m.opponentId === opponentId && m.result)
    return {
      wins:   played.filter(m => m.result === 'win').length,
      losses: played.filter(m => m.result === 'loss').length,
    }
  }
  const matchesVs = (opponentId) => MATCHES.filter(m => m.opponentId === opponentId)

  const q = search.trim().toLowerCase()
  const visibleOpponents = q
    ? opponents.filter(o => o.name.toLowerCase().includes(q))
    : opponents

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>

      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1"
             style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
            Il tuo tennis
          </p>
          <h1 className="text-2xl font-bold"
              style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            Matches
          </h1>
        </div>
        {activeTab === 'avversari' && (
          <button
            onClick={() => setShowAdd(true)}
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl font-bold transition-all active:scale-95"
            style={{ background: 'var(--color-amber)', color: 'var(--color-bg)' }}>
            +
          </button>
        )}
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
        {activeTab === 'avversari' ? (
          loading ? (
            <div className="flex justify-center pt-20">
              <div className="w-6 h-6 rounded-full border-2 animate-spin"
                   style={{ borderColor: 'var(--color-teal-dark)', borderTopColor: 'transparent' }} />
            </div>
          ) : opponents.length === 0 ? (
            <EmptyState onAdd={() => setShowAdd(true)} />
          ) : (
            <div className="space-y-3">
              {/* Ricerca */}
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cerca avversario..."
                className="w-full p-3 rounded-xl text-sm outline-none"
                style={{
                  background: 'var(--color-surface)',
                  color: 'var(--color-white)',
                  border: '1px solid var(--color-surface-2)',
                  fontFamily: 'var(--font-body)'
                }}
              />

              {visibleOpponents.length === 0 ? (
                <p className="text-sm text-center pt-8" style={{ color: 'var(--color-slate)' }}>
                  Nessun avversario trovato.
                </p>
              ) : (
                <div className="space-y-2">
                  {visibleOpponents.map(o => (
                    <OpponentCard
                      key={o.id}
                      opponent={o}
                      record={recordFor(o.id)}
                      onClick={() => setSelectedId(o.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        ) : (
          <ComingSoon tab={activeTab} />
        )}
      </div>

      {/* Modal aggiunta avversario */}
      {showAdd && (
        <AddOpponentModal
          onClose={() => setShowAdd(false)}
          onSave={async (data) => { await add(data) }}
        />
      )}

      {/* Modal dettaglio avversario */}
      {selectedOpponent && (
        <OpponentDetailModal
          opponent={selectedOpponent}
          record={recordFor(selectedOpponent.id)}
          matches={matchesVs(selectedOpponent.id)}
          onClose={() => setSelectedId(null)}
          onUpdate={async (id, data) => { await update(id, data) }}
          onDelete={async (id) => {
            await remove(id)
            setSelectedId(null)
            setDeleteToast(true)
          }}
        />
      )}

      {/* Toast conferma eliminazione */}
      {deleteToast && <DeleteToast onClose={() => setDeleteToast(false)} />}
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center pt-20 text-center">
      <span className="text-5xl mb-4">👥</span>
      <p className="text-base font-semibold mb-1"
         style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
        Nessun avversario.
      </p>
      <p className="text-sm mb-6" style={{ color: 'var(--color-slate)' }}>
        Aggiungi chi affronti in campo per tenere traccia dei testa-a-testa.
      </p>
      <button
        onClick={onAdd}
        className="px-6 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
        style={{ background: 'var(--color-amber)', color: 'var(--color-bg)', fontFamily: 'var(--font-display)' }}>
        + Aggiungi
      </button>
    </div>
  )
}

function ComingSoon({ tab }) {
  const messages = {
    panoramica:  { icon: '🗂', text: 'Panoramica in arrivo.',  sub: 'Prossima partita, forma recente e scorciatoie rapide.' },
    partite:     { icon: '🎾', text: 'Partite in arrivo.',      sub: 'Registra i match con punteggio, superficie ed esito.' },
    allenamenti: { icon: '🎯', text: 'Allenamenti in arrivo.',  sub: 'Traccia le sessioni tecniche e i colpi allenati.' },
  }
  const m = messages[tab] || messages.panoramica
  return (
    <div className="flex flex-col items-center justify-center pt-20 text-center">
      <span className="text-5xl mb-4 opacity-60">{m.icon}</span>
      <p className="text-base font-semibold mb-1"
         style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
        {m.text}
      </p>
      <p className="text-sm" style={{ color: 'var(--color-slate)' }}>{m.sub}</p>
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
          Avversario eliminato
        </p>
        <p className="text-sm mb-5" style={{ color: 'var(--color-slate)' }}>
          È stato rimosso dalla tua anagrafica.
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
