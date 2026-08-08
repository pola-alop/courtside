import { useState } from 'react'
import { useOpponents } from '../hooks/useOpponents'
import { useMatches } from '../hooks/useMatches'
import { useTrainings } from '../hooks/useTrainings'
import { useEquipment } from '../hooks/useEquipment'
import OpponentCard from '../components/matches/OpponentCard'
import AddOpponentModal from '../components/matches/AddOpponentModal'
import OpponentDetailModal from '../components/matches/OpponentDetailModal'
import MatchRow from '../components/matches/MatchRow'
import AddMatchModal from '../components/matches/AddMatchModal'
import MatchDetailModal from '../components/matches/MatchDetailModal'
import ActivityCalendar from '../components/matches/ActivityCalendar'
import TrainingRow from '../components/trainings/TrainingRow'
import AddTrainingModal from '../components/trainings/AddTrainingModal'
import TrainingDetailModal from '../components/trainings/TrainingDetailModal'
import FocusProgress from '../components/trainings/FocusProgress'
import { MATCH_TYPES, SURFACES, RESULT_META, surfaceIcon } from '../lib/tennis'
import {
  TRAINING_KINDS, INTENSITIES, FOCUS_CATEGORIES, FOCUS_BY_ID,
  totalMinutes, formatHours, focusLabel,
} from '../lib/training'

const TABS = [
  { id: 'panoramica',  label: 'Panoramica',  icon: '🗂' },
  { id: 'partite',     label: 'Partite',     icon: '🎾' },
  { id: 'avversari',   label: 'Avversari',   icon: '👥' },
  { id: 'allenamenti', label: 'Allenamenti', icon: '🎯' },
]

const RESULT_FILTERS = [
  { id: 'all',  label: 'Tutte' },
  { id: 'win',  label: 'Vinte' },
  { id: 'loss', label: 'Perse' },
  { id: 'draw', label: 'Pari'  },
]

export default function Matches() {
  const { opponents, loading: oppLoading, add: addOpponent, update: updateOpponent, remove: removeOpponent } = useOpponents()
  const { matches,   loading: matchLoading, add: addMatch, update: updateMatch, remove: removeMatch } = useMatches()
  const { trainings, loading: trainLoading, add: addTraining, update: updateTraining, remove: removeTraining } = useTrainings()
  const { equipment } = useEquipment()

  const [activeTab, setActiveTab] = useState('partite')

  // Avversari
  const [showAddOpponent, setShowAddOpponent] = useState(false)
  const [selectedOpponentId, setSelectedOpponentId] = useState(null)
  const [oppSearch, setOppSearch] = useState('')
  const [oppDeleteToast, setOppDeleteToast] = useState(false)

  // Partite
  const [showAddMatch, setShowAddMatch] = useState(false)
  const [editingMatch, setEditingMatch] = useState(null)
  const [selectedMatchId, setSelectedMatchId] = useState(null)
  const [matchDeleteToast, setMatchDeleteToast] = useState(false)
  const [fType, setFType]         = useState('all')
  const [fEvent, setFEvent]       = useState('')
  const [fOpponent, setFOpponent] = useState('all')
  const [fSurface, setFSurface]   = useState('all')
  const [fDateFrom, setFDateFrom] = useState('')
  const [fDateTo, setFDateTo]     = useState('')
  const [fResult, setFResult]     = useState('all')

  // Allenamenti
  const [showAddTraining, setShowAddTraining] = useState(false)
  const [editingTraining, setEditingTraining] = useState(null)
  const [selectedTrainingId, setSelectedTrainingId] = useState(null)
  const [trainingDeleteToast, setTrainingDeleteToast] = useState(false)
  const [fKind, setFKind]           = useState('all')
  const [fFocus, setFFocus]         = useState('all')
  const [fIntensity, setFIntensity] = useState('all')
  const [fTrDateFrom, setFTrDateFrom] = useState('')
  const [fTrDateTo, setFTrDateTo]     = useState('')

  // Item selezionati derivati (pattern "selected item derivato")
  const selectedOpponent = selectedOpponentId ? opponents.find(o => o.id === selectedOpponentId) || null : null
  const selectedMatch    = selectedMatchId ? matches.find(m => m.id === selectedMatchId) || null : null
  const selectedTraining = selectedTrainingId ? trainings.find(t => t.id === selectedTrainingId) || null : null

  // Record H2H reale (chiusura del cerchio con la sezione Partite)
  const recordFor = (opponentId) => {
    const played = matches.filter(m => m.opponentId === opponentId)
    return {
      wins:   played.filter(m => m.result === 'win').length,
      losses: played.filter(m => m.result === 'loss').length,
      draws:  played.filter(m => m.result === 'draw').length,
    }
  }
  const matchesVs = (opponentId) => matches.filter(m => m.opponentId === opponentId)

  // ── Filtri partite ──
  const eventOptions = (fType === 'campionato' || fType === 'torneo')
    ? [...new Set(matches.filter(m => m.type === fType && m.eventName).map(m => m.eventName))]
    : []
  const opponentOptions = [...new Map(matches.map(m => [m.opponentId, m.opponentName])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))

  const filteredMatches = matches.filter(m => {
    if (fType !== 'all' && m.type !== fType) return false
    if (fEvent && m.eventName !== fEvent) return false
    if (fOpponent !== 'all' && m.opponentId !== fOpponent) return false
    if (fSurface !== 'all' && m.surface !== fSurface) return false
    if (fDateFrom && m.date.slice(0, 10) < fDateFrom) return false
    if (fDateTo && m.date.slice(0, 10) > fDateTo) return false
    if (fResult !== 'all' && m.result !== fResult) return false
    return true
  })
  const monthGroups = groupByMonth(filteredMatches)

  const hasActiveFilters = fType !== 'all' || fEvent !== '' || fOpponent !== 'all'
    || fSurface !== 'all' || fDateFrom !== '' || fDateTo !== '' || fResult !== 'all'
  const resetFilters = () => {
    setFType('all')
    setFEvent('')
    setFOpponent('all')
    setFSurface('all')
    setFDateFrom('')
    setFDateTo('')
    setFResult('all')
  }

  // ── Filtri allenamenti ──
  // Il filtro per colpo elenca solo i focus davvero usati: la tassonomia
  // completa (~45 voci) in una select sarebbe illeggibile.
  const usedFocusIds = [...new Set(trainings.flatMap(t => t.focus || []))].filter(id => FOCUS_BY_ID[id])

  const filteredTrainings = trainings.filter(t => {
    if (fKind !== 'all' && !(t.blocks || []).some(b => b.kind === fKind)) return false
    if (fFocus !== 'all' && !(t.focus || []).includes(fFocus)) return false
    if (fIntensity !== 'all' && t.intensity !== fIntensity) return false
    if (fTrDateFrom && t.date.slice(0, 10) < fTrDateFrom) return false
    if (fTrDateTo && t.date.slice(0, 10) > fTrDateTo) return false
    return true
  })
  const trainingMonthGroups = groupByMonth(filteredTrainings)

  const hasActiveTrainingFilters = fKind !== 'all' || fFocus !== 'all' || fIntensity !== 'all'
    || fTrDateFrom !== '' || fTrDateTo !== ''
  const resetTrainingFilters = () => {
    setFKind('all')
    setFFocus('all')
    setFIntensity('all')
    setFTrDateFrom('')
    setFTrDateTo('')
  }

  const oppQuery = oppSearch.trim().toLowerCase()
  const visibleOpponents = oppQuery ? opponents.filter(o => o.name.toLowerCase().includes(oppQuery)) : opponents

  const showAddButton = activeTab === 'avversari' || activeTab === 'partite' || activeTab === 'allenamenti'
  const onAdd = () => {
    if (activeTab === 'avversari') setShowAddOpponent(true)
    else if (activeTab === 'allenamenti') setShowAddTraining(true)
    else setShowAddMatch(true)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>

      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1"
             style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
            Il tuo tennis
          </p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            Matches
          </h1>
        </div>
        {showAddButton && (
          <button onClick={onAdd}
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

        {/* ── PARTITE ── */}
        {activeTab === 'partite' && (
          matchLoading ? (
            <Spinner />
          ) : matches.length === 0 ? (
            <EmptyState icon="🎾" title="Nessuna partita." sub="Registra il tuo primo match per iniziare lo storico." onAdd={() => setShowAddMatch(true)} />
          ) : (
            <div className="space-y-4">
              <MatchFilters
                type={fType} setType={t => { setFType(t); setFEvent('') }}
                event={fEvent} setEvent={setFEvent} eventOptions={eventOptions}
                opponent={fOpponent} setOpponent={setFOpponent} opponentOptions={opponentOptions}
                surface={fSurface} setSurface={setFSurface}
                dateFrom={fDateFrom} setDateFrom={setFDateFrom}
                dateTo={fDateTo} setDateTo={setFDateTo}
                result={fResult} setResult={setFResult}
                hasActiveFilters={hasActiveFilters}
                onReset={resetFilters}
              />

              {filteredMatches.length === 0 ? (
                <p className="text-sm text-center pt-8" style={{ color: 'var(--color-slate)' }}>
                  Nessuna partita con questi filtri.
                </p>
              ) : (
                <div className="space-y-6">
                  {monthGroups.map(group => (
                    <div key={group.key}>
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-xs font-semibold uppercase tracking-wider"
                           style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
                          {group.label}
                        </p>
                        <div className="flex-1 h-px" style={{ background: 'var(--color-surface-2)' }} />
                        <span className="text-xs" style={{ color: 'var(--color-slate)' }}>{group.items.length}</span>
                      </div>
                      <div className="space-y-2">
                        {group.items.map(m => (
                          <MatchRow key={m.id} match={m} onClick={() => setSelectedMatchId(m.id)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {/* ── AVVERSARI ── */}
        {activeTab === 'avversari' && (
          oppLoading ? (
            <Spinner />
          ) : opponents.length === 0 ? (
            <EmptyState icon="👥" title="Nessun avversario." sub="Aggiungi chi affronti in campo per tenere traccia dei testa-a-testa." onAdd={() => setShowAddOpponent(true)} />
          ) : (
            <div className="space-y-3">
              <input
                value={oppSearch}
                onChange={e => setOppSearch(e.target.value)}
                placeholder="Cerca avversario..."
                className="w-full p-3 rounded-xl text-sm outline-none"
                style={{ background: 'var(--color-surface)', color: 'var(--color-white)', border: '1px solid var(--color-surface-2)', fontFamily: 'var(--font-body)' }}
              />
              {visibleOpponents.length === 0 ? (
                <p className="text-sm text-center pt-8" style={{ color: 'var(--color-slate)' }}>Nessun avversario trovato.</p>
              ) : (
                <div className="space-y-2">
                  {visibleOpponents.map(o => (
                    <OpponentCard key={o.id} opponent={o} record={recordFor(o.id)} onClick={() => setSelectedOpponentId(o.id)} />
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {/* ── ALLENAMENTI ── */}
        {activeTab === 'allenamenti' && (
          trainLoading ? (
            <Spinner />
          ) : trainings.length === 0 ? (
            <EmptyState icon="🎯" title="Nessun allenamento." sub="Registra le sessioni tecniche per vedere su cosa stai lavorando davvero." onAdd={() => setShowAddTraining(true)} />
          ) : (
            <div className="space-y-4">
              <FocusProgress trainings={trainings} />

              <TrainingFilters
                kind={fKind} setKind={setFKind}
                focus={fFocus} setFocus={setFFocus} focusOptions={usedFocusIds}
                intensity={fIntensity} setIntensity={setFIntensity}
                dateFrom={fTrDateFrom} setDateFrom={setFTrDateFrom}
                dateTo={fTrDateTo} setDateTo={setFTrDateTo}
                hasActiveFilters={hasActiveTrainingFilters}
                onReset={resetTrainingFilters}
              />

              {filteredTrainings.length === 0 ? (
                <p className="text-sm text-center pt-8" style={{ color: 'var(--color-slate)' }}>
                  Nessun allenamento con questi filtri.
                </p>
              ) : (
                <div className="space-y-6">
                  {trainingMonthGroups.map(group => (
                    <div key={group.key}>
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-xs font-semibold uppercase tracking-wider"
                           style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
                          {group.label}
                        </p>
                        <div className="flex-1 h-px" style={{ background: 'var(--color-surface-2)' }} />
                        <span className="text-xs" style={{ color: 'var(--color-slate)' }}>
                          {formatHours(group.items.reduce((sum, t) => sum + totalMinutes(t.blocks), 0))} h
                        </span>
                      </div>
                      <div className="space-y-2">
                        {group.items.map(t => (
                          <TrainingRow key={t.id} training={t} onClick={() => setSelectedTrainingId(t.id)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {/* ── PANORAMICA ── */}
        {activeTab === 'panoramica' && (
          (matchLoading || trainLoading) ? <Spinner /> : <Overview matches={matches} trainings={trainings} />
        )}
      </div>

      {/* ── Modali Avversari ── */}
      {showAddOpponent && (
        <AddOpponentModal onClose={() => setShowAddOpponent(false)} onSave={async (data) => { await addOpponent(data) }} />
      )}
      {selectedOpponent && (
        <OpponentDetailModal
          opponent={selectedOpponent}
          record={recordFor(selectedOpponent.id)}
          matches={matchesVs(selectedOpponent.id)}
          onClose={() => setSelectedOpponentId(null)}
          onSelectMatch={(matchId) => setSelectedMatchId(matchId)}
          onUpdate={async (id, data) => { await updateOpponent(id, data) }}
          onDelete={async (id) => {
            // Guard difensiva: il bottone di eliminazione è già nascosto nel
            // modale quando ci sono match collegati, ma non fidarsi solo della UI.
            if (matchesVs(id).length > 0) return
            await removeOpponent(id)
            setSelectedOpponentId(null)
            setOppDeleteToast(true)
          }}
        />
      )}

      {/* ── Modali Partite ── */}
      {(showAddMatch || editingMatch) && (
        <AddMatchModal
          initial={editingMatch}
          opponents={opponents}
          equipment={equipment}
          onClose={() => { setShowAddMatch(false); setEditingMatch(null) }}
          onSave={async (data) => {
            if (editingMatch) await updateMatch(editingMatch.id, data)
            else await addMatch(data)
          }}
        />
      )}
      {selectedMatch && (
        <MatchDetailModal
          match={selectedMatch}
          equipment={equipment}
          onClose={() => setSelectedMatchId(null)}
          onEdit={() => { setEditingMatch(selectedMatch); setSelectedMatchId(null) }}
          onUpdate={async (id, data) => { await updateMatch(id, data) }}
          onDelete={async (id) => { await removeMatch(id); setSelectedMatchId(null); setMatchDeleteToast(true) }}
        />
      )}

      {/* ── Modali Allenamenti ── */}
      {(showAddTraining || editingTraining) && (
        <AddTrainingModal
          initial={editingTraining}
          opponents={opponents}
          equipment={equipment}
          trainings={trainings}
          onClose={() => { setShowAddTraining(false); setEditingTraining(null) }}
          onSave={async (data) => {
            if (editingTraining) await updateTraining(editingTraining.id, data)
            else await addTraining(data)
          }}
        />
      )}
      {selectedTraining && (
        <TrainingDetailModal
          training={selectedTraining}
          equipment={equipment}
          onClose={() => setSelectedTrainingId(null)}
          onEdit={() => { setEditingTraining(selectedTraining); setSelectedTrainingId(null) }}
          onUpdate={async (id, data) => { await updateTraining(id, data) }}
          onDelete={async (id) => { await removeTraining(id); setSelectedTrainingId(null); setTrainingDeleteToast(true) }}
        />
      )}

      {/* Toast eliminazione */}
      {oppDeleteToast && <Toast title="Avversario eliminato" sub="È stato rimosso dalla tua anagrafica." onClose={() => setOppDeleteToast(false)} />}
      {matchDeleteToast && <Toast title="Partita eliminata" sub="È stata rimossa dallo storico." onClose={() => setMatchDeleteToast(false)} />}
      {trainingDeleteToast && <Toast title="Allenamento eliminato" sub="È stato rimosso dallo storico." onClose={() => setTrainingDeleteToast(false)} />}
    </div>
  )
}

// ── Filtri partite ─────────────────────────────────────────

function MatchFilters({
  type, setType, event, setEvent, eventOptions,
  opponent, setOpponent, opponentOptions,
  surface, setSurface,
  dateFrom, setDateFrom, dateTo, setDateTo,
  result, setResult,
  hasActiveFilters, onReset
}) {
  return (
    <div className="space-y-2">
      {/* Reset filtri */}
      {hasActiveFilters && (
        <div className="flex justify-end">
          <button onClick={onReset}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-95"
            style={{ background: 'var(--color-surface)', color: 'var(--color-amber)', border: '1px solid var(--color-surface-2)', fontFamily: 'var(--font-display)' }}>
            <span>✕</span>
            <span>Cancella filtri</span>
          </button>
        </div>
      )}

      {/* Tipo */}
      <div className="flex gap-2 overflow-x-auto" style={{ minWidth: 'max-content' }}>
        {[{ id: 'all', label: 'Tutti' }, ...MATCH_TYPES.map(t => ({ id: t.id, label: t.label }))].map(t => (
          <Chip key={t.id} active={type === t.id} onClick={() => setType(t.id)}>{t.label}</Chip>
        ))}
      </div>

      {/* Range di date */}
      <div className="flex gap-2">
        <DateInput value={dateFrom} onChange={setDateFrom} placeholder="Da" />
        <DateInput value={dateTo} onChange={setDateTo} placeholder="A" />
      </div>

      {/* Evento (solo campionato/torneo) + Avversario */}
      <div className="flex gap-2">
        {eventOptions.length > 0 && (
          <Select value={event} onChange={setEvent}>
            <option value="">Tutti gli eventi</option>
            {eventOptions.map(ev => <option key={ev} value={ev}>{ev}</option>)}
          </Select>
        )}
        <Select value={opponent} onChange={setOpponent}>
          <option value="all">Tutti gli avversari</option>
          {opponentOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </Select>
      </div>

      {/* Superficie */}
      <div className="flex gap-2 overflow-x-auto" style={{ minWidth: 'max-content' }}>
        <Chip active={surface === 'all'} onClick={() => setSurface('all')}>Tutte</Chip>
        {SURFACES.map(s => (
          <Chip key={s} active={surface === s} onClick={() => setSurface(s)} icon={surfaceIcon(s)}>
            <span className="capitalize">{s}</span>
          </Chip>
        ))}
      </div>

      {/* Esito */}
      <div className="flex gap-2">
        {RESULT_FILTERS.map(r => (
          <Chip key={r.id} active={result === r.id} onClick={() => setResult(r.id)}
            dot={r.id !== 'all' ? RESULT_META[r.id]?.color : null}>
            {r.label}
          </Chip>
        ))}
      </div>
    </div>
  )
}

// ── Filtri allenamenti ─────────────────────────────────────

function TrainingFilters({
  kind, setKind,
  focus, setFocus, focusOptions,
  intensity, setIntensity,
  dateFrom, setDateFrom, dateTo, setDateTo,
  hasActiveFilters, onReset
}) {
  // Le opzioni del filtro colpo sono raggruppate per categoria, così la select
  // resta navigabile anche con molte voci in uso.
  const groupedFocus = FOCUS_CATEGORIES
    .map(cat => ({ ...cat, items: cat.items.filter(i => focusOptions.includes(i.id)) }))
    .filter(cat => cat.items.length > 0)

  return (
    <div className="space-y-2">
      {hasActiveFilters && (
        <div className="flex justify-end">
          <button onClick={onReset}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-95"
            style={{ background: 'var(--color-surface)', color: 'var(--color-amber)', border: '1px solid var(--color-surface-2)', fontFamily: 'var(--font-display)' }}>
            <span>✕</span>
            <span>Cancella filtri</span>
          </button>
        </div>
      )}

      {/* Tipo di blocco */}
      <div className="flex gap-2 overflow-x-auto" style={{ minWidth: 'max-content' }}>
        <Chip active={kind === 'all'} onClick={() => setKind('all')}>Tutti</Chip>
        {TRAINING_KINDS.map(k => (
          <Chip key={k.id} active={kind === k.id} onClick={() => setKind(k.id)} icon={k.icon}>{k.label}</Chip>
        ))}
      </div>

      {/* Range di date */}
      <div className="flex gap-2">
        <DateInput value={dateFrom} onChange={setDateFrom} placeholder="Da" />
        <DateInput value={dateTo} onChange={setDateTo} placeholder="A" />
      </div>

      {/* Colpo lavorato */}
      {groupedFocus.length > 0 && (
        <Select value={focus} onChange={setFocus}>
          <option value="all">Tutti i colpi e schemi</option>
          {groupedFocus.map(cat => (
            <optgroup key={cat.id} label={cat.label}>
              {cat.items.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
            </optgroup>
          ))}
        </Select>
      )}

      {/* Intensità */}
      <div className="flex gap-2">
        <Chip active={intensity === 'all'} onClick={() => setIntensity('all')}>Tutte</Chip>
        {INTENSITIES.map(i => (
          <Chip key={i.id} active={intensity === i.id} onClick={() => setIntensity(i.id)} dot={i.color}>
            {i.label}
          </Chip>
        ))}
      </div>
    </div>
  )
}

// ── Panoramica ─────────────────────────────────────────────

// Landing di sintesi dell'area: risponde a "come sto andando" prima ancora di
// entrare nel dettaglio di partite o allenamenti. Le tile guardano al mese
// corrente (l'unità con cui si ragiona quando ci si allena), il calendario agli
// ultimi 6 mesi per dare il senso della continuità.
function Overview({ matches, trainings }) {
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const inMonth = (d) => monthKey(d) === thisMonth

  const monthMatches   = matches.filter(m => inMonth(m.date))
  const monthTrainings = trainings.filter(t => inMonth(t.date))
  const monthMinutes   = monthTrainings.reduce((sum, t) => sum + totalMinutes(t.blocks), 0)

  // Un giorno conta una volta sola anche se ci sono più sessioni
  const activeDays = new Set([
    ...monthMatches.map(m => m.date.slice(0, 10)),
    ...monthTrainings.map(t => t.date.slice(0, 10)),
  ]).size

  // I colpi più lavorati negli ultimi 30 giorni: l'analisi completa vivrà in
  // Stats (heatmap del focus), qui basta il vertice della classifica.
  const since = new Date(now)
  since.setDate(now.getDate() - 30)
  const focusCounts = {}
  trainings
    .filter(t => new Date(t.date) >= since)
    .forEach(t => (t.focus || []).forEach(id => { focusCounts[id] = (focusCounts[id] || 0) + 1 }))
  const topFocus = Object.entries(focusCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

  if (matches.length === 0 && trainings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center pt-20 text-center">
        <span className="text-5xl mb-4 opacity-60">🗂</span>
        <p className="text-base font-semibold mb-1" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          Ancora niente da riassumere.
        </p>
        <p className="text-sm" style={{ color: 'var(--color-slate)' }}>
          Registra una partita o un allenamento per popolare la panoramica.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Partite del mese"     value={String(monthMatches.length)}   color="var(--color-amber)" />
        <StatTile label="Allenamenti del mese" value={String(monthTrainings.length)} color="var(--color-teal)" />
        <StatTile label="Ore allenate"         value={formatHours(monthMinutes)}     color="var(--color-white)" />
        <StatTile label="Giorni in campo"      value={String(activeDays)}            color="var(--color-win)" />
      </div>

      <ActivityCalendar matches={matches} trainings={trainings} />

      {topFocus.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3"
             style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
            Più lavorati (30 giorni)
          </p>
          <div className="space-y-2">
            {topFocus.map(([id, count]) => (
              <div key={id} className="flex items-center gap-3">
                <span className="text-xs flex-1 truncate" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                  {focusLabel(id)}
                </span>
                <div className="h-1.5 rounded-full shrink-0"
                     style={{ width: `${(count / topFocus[0][1]) * 40}%`, minWidth: 8, background: 'var(--color-teal-dark)' }} />
                <span className="text-xs w-6 text-right shrink-0" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value, color }) {
  return (
    <div className="rounded-2xl px-2 py-3 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
      <p className="text-xl font-bold" style={{ color, fontFamily: 'var(--font-display)' }}>{value}</p>
      <p className="text-[11px] mt-0.5 uppercase tracking-wider" style={{ color: 'var(--color-slate)' }}>{label}</p>
    </div>
  )
}

function Chip({ active, onClick, children, dot, icon }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
      style={{
        background: active ? 'var(--color-teal-dark)' : 'var(--color-surface)',
        color: active ? 'var(--color-white)' : 'var(--color-slate)',
        border: active ? 'none' : '1px solid var(--color-surface-2)',
        fontFamily: 'var(--font-display)'
      }}>
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />}
      {icon && <span>{icon}</span>}
      {children}
    </button>
  )
}

function DateInput({ value, onChange, placeholder }) {
  return (
    <div className="flex-1 min-w-0 flex items-center gap-1.5 p-2.5 rounded-xl"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
      <span className="text-xs shrink-0" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>{placeholder}</span>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 min-w-0 text-xs outline-none"
        style={{ background: 'transparent', color: 'var(--color-white)', fontFamily: 'var(--font-display)', colorScheme: 'dark' }}
      />
    </div>
  )
}

function Select({ value, onChange, children }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="flex-1 min-w-0 p-2.5 rounded-xl text-xs outline-none"
      style={{ background: 'var(--color-surface)', color: 'var(--color-white)', border: '1px solid var(--color-surface-2)', fontFamily: 'var(--font-display)' }}>
      {children}
    </select>
  )
}

// ── Comuni ─────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center pt-20">
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--color-teal-dark)', borderTopColor: 'transparent' }} />
    </div>
  )
}

function EmptyState({ icon, title, sub, onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center pt-20 text-center">
      <span className="text-5xl mb-4">{icon}</span>
      <p className="text-base font-semibold mb-1" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{title}</p>
      <p className="text-sm mb-6" style={{ color: 'var(--color-slate)' }}>{sub}</p>
      <button onClick={onAdd}
        className="px-6 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
        style={{ background: 'var(--color-amber)', color: 'var(--color-bg)', fontFamily: 'var(--font-display)' }}>
        + Aggiungi
      </button>
    </div>
  )
}

function Toast({ title, sub, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6"
         style={{ background: 'rgba(2,13,25,0.7)', backdropFilter: 'blur(4px)' }}
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xs rounded-3xl p-6 text-center"
           style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
        <span className="text-4xl mb-3 block">✅</span>
        <p className="text-base font-semibold mb-1" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{title}</p>
        <p className="text-sm mb-5" style={{ color: 'var(--color-slate)' }}>{sub}</p>
        <button onClick={onClose}
          className="w-full py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
          style={{ background: 'var(--color-amber)', color: 'var(--color-bg)', fontFamily: 'var(--font-display)' }}>
          Ok
        </button>
      </div>
    </div>
  )
}

// ── Helpers data ───────────────────────────────────────────

const MONTH_NAMES = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

function monthKey(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d)) return 'unknown'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabelFromKey(key) {
  const [y, m] = key.split('-')
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`
}

// Raggruppa le partite (già ordinate per data desc) per mese, preservando l'ordine
function groupByMonth(matches) {
  const groups = []
  const index = {}
  matches.forEach(m => {
    const key = monthKey(m.date)
    if (index[key] == null) {
      index[key] = groups.length
      groups.push({ key, label: monthLabelFromKey(key), items: [] })
    }
    groups[index[key]].items.push(m)
  })
  return groups
}
