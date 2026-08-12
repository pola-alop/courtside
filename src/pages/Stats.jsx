import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMatches } from '../hooks/useMatches'
import { useTrainings } from '../hooks/useTrainings'
import { useOpponents } from '../hooks/useOpponents'
import { useEquipment } from '../hooks/useEquipment'
import Rendimento from '../components/stats/Rendimento'
import Attivita from '../components/stats/Attivita'
import Tecnica from '../components/stats/Tecnica'
import Fisico from '../components/stats/Fisico'
import Setup from '../components/stats/Setup'
import InsightList from '../components/stats/InsightList'
import MatchListModal from '../components/stats/MatchListModal'
import MatchDetailModal from '../components/matches/MatchDetailModal'
import {
  PERIODS, DEFAULT_PERIOD, MIN_CORE, buildRendimento, coreStats, filterPeriod, periodRange,
} from '../lib/stats'
import { buildActivity } from '../lib/activity'
import { buildTechnique } from '../lib/technique'
import { buildPhysical } from '../lib/physical'
import { buildSetup } from '../lib/setup'

// Pagina Stats — organizzata per DOMANDE, non per dataset.
//
// Cinque sezioni intitolate a ciò a cui rispondono: raggruppare per dominio
// (matches / trainings / athletics) rispecchierebbe il database e non la testa
// di chi guarda. Ognuna ha la propria unità di misura e non si sovrappone alle
// altre: "Rendimento" il game, "Attività" il minuto, "Tecnica" la sessione (il
// focus è della sessione e non del blocco, quindi il minuto qui non è
// disponibile), "Fisico" il battito, "Setup" il game giocato con un materiale.
//
// ── Perché l'orizzonte è lungo ──
// La finestra mobile di 30 giorni è già della Panoramica: è il presente e serve
// ad agire. Stats possiede il tempo lungo (90 giorni / 12 mesi / sempre) e il
// confronto con il periodo precedente. Se mostrasse anche i 30 giorni avremmo
// due pagine che dicono la stessa cosa con due layout diversi.
//
// ── L'eccezione: Setup ignora il periodo ──
// Un setup dura mesi e l'usura è un fatto del presente. Ritagliare su una
// finestra lascerebbe fuori proprio il materiale precedente, cioè il termine di
// paragone, e la vita delle corde è per costruzione una domanda su tutte le
// incordature già cambiate. La sezione lavora su tutto lo storico e lo dichiara
// in testa, così il selettore di periodo non sembra rotto.
//
// ── Perché gli insight stanno sopra i tab ──
// Sono il livello che rende la pagina parlante e valgono per l'intera pagina,
// non per una sezione: ogni frase sa a quale tab e a quale blocco appartiene,
// quindi il tap porta al punto giusto. Le liste delle sezioni implementate si
// concatenano e si riordinano per peso — un picco di carico può stare sopra un
// dato di rendimento — e le prossime sezioni si agganceranno allo stesso modo.

const TABS = [
  { id: 'rendimento', label: 'Rendimento', icon: '🎾', question: 'Quanto sono forte, e come vinco o perdo?' },
  { id: 'attivita',   label: 'Attività',   icon: '📅', question: 'Quanto gioco, e con quanta costanza?' },
  { id: 'tecnica',    label: 'Tecnica',    icon: '🎯', question: 'Su cosa sto lavorando, e sta funzionando?' },
  { id: 'fisico',     label: 'Fisico',     icon: '❤️', question: 'Come sto fisicamente, e sto migliorando?' },
  { id: 'setup',      label: 'Setup',      icon: '🎽', question: 'Il materiale cambia qualcosa in campo?' },
]

export default function Stats() {
  const { matches, loading: matchLoading, update: updateMatch } = useMatches()
  const { trainings, loading: trainLoading } = useTrainings()
  const { opponents } = useOpponents()
  const { equipment, loading: equipLoading } = useEquipment()

  const [activeTab, setActiveTab] = useState('rendimento')
  const [period, setPeriod] = useState(DEFAULT_PERIOD)
  const [drill, setDrill] = useState(null)              // { title, sub, matches }
  const [selectedMatchId, setSelectedMatchId] = useState(null)

  const range = useMemo(() => periodRange(period), [period])

  const scoped = useMemo(() => ({
    matches:   filterPeriod(matches, range),
    trainings: filterPeriod(trainings, range),
  }), [matches, trainings, range])

  // Finestra precedente della stessa ampiezza: la usano sia il delta del GW% in
  // Rendimento sia il delta delle ore in Attività, quindi si ritaglia una volta
  // sola qui invece che dentro ognuno dei due report.
  const previous = useMemo(() => {
    const prevRange = periodRange(period, 1)
    if (!prevRange) return null
    return {
      matches:   filterPeriod(matches, prevRange),
      trainings: filterPeriod(trainings, prevRange),
    }
  }, [matches, trainings, period])

  const report = useMemo(
    () => buildRendimento({ matches: scoped.matches, trainings: scoped.trainings, opponents }),
    [scoped, opponents]
  )

  // Attività riceve anche i dati NON filtrati: ACWR, striscia attiva e giorni
  // dall'ultima sessione sono fatti del presente e vanno calcolati su tutto lo
  // storico rispetto a oggi, non sulla finestra scelta — lo stesso motivo per
  // cui gli alert di usura in Panoramica compaiono solo a offset 0.
  const activity = useMemo(
    () => buildActivity({
      matches: scoped.matches, trainings: scoped.trainings,
      allMatches: matches, allTrainings: trainings,
      previousMatches: previous?.matches || [], previousTrainings: previous?.trainings || [],
      range,
    }),
    [scoped, matches, trainings, previous, range]
  )

  // Tecnica riceve gli allenamenti del periodo e, come Attività, anche quelli non
  // filtrati: trascuratezza ("da 47 giorni") e copertura ("mai toccato") sono
  // fatti del presente e dell'intero storico, non della finestra scelta.
  const technique = useMemo(
    () => buildTechnique({ trainings: scoped.trainings, allTrainings: trainings, range }),
    [scoped, trainings, range]
  )

  // Fisico riceve i SOLI dati del periodo: qui non c'è niente che sia un fatto
  // del presente. Tutto è una proprietà della finestra scelta (com'era il tuo
  // cuore in quei mesi), e l'unica cosa che assomiglia a un trend — l'economia
  // cardiaca — è per costruzione un confronto interno al periodo, che su una
  // finestra diversa DEVE dare una risposta diversa.
  const physical = useMemo(
    () => buildPhysical({ matches: scoped.matches, trainings: scoped.trainings }),
    [scoped]
  )

  // Setup riceve lo storico INTERO e ignora il periodo, unica delle cinque
  // sezioni. Un setup dura mesi: ritagliare su 90 giorni lascerebbe fuori
  // proprio il materiale con cui confrontarlo, e la vita delle corde è per
  // definizione una domanda su tutte le incordature che hai già cambiato.
  // L'usura, poi, è un fatto del presente — stessa logica per cui gli alert di
  // usura in Panoramica compaiono solo a offset 0. La sezione lo dichiara in testa.
  const setup = useMemo(
    () => buildSetup({ matches, trainings, equipment }),
    [matches, trainings, equipment]
  )

  // Su "Sempre" non esiste un prima, e se il periodo precedente ha pochi dati il
  // confronto sarebbe rumore: in entrambi i casi il delta non compare.
  const comparison = useMemo(() => {
    if (!previous || previous.matches.length < MIN_CORE) return null
    const rate = coreStats(previous.matches).gameWinRate
    return rate == null ? null : { rate, label: 'periodo precedente' }
  }, [previous])

  // Gli insight sono di PAGINA, non di sezione: si concatenano le liste delle
  // sezioni implementate e si riordina per peso, così una frase sul carico può
  // stare sopra una sul rendimento se è più forte. Ogni frase sa già a quale tab
  // e a quale blocco appartiene, quindi il tap continua a portare al punto giusto.
  const insights = useMemo(
    () => [...report.insights, ...activity.insights, ...technique.insights, ...physical.insights, ...setup.insights]
      .sort((a, b) => b.weight - a.weight),
    [report, activity, technique, physical, setup]
  )

  // Pattern "selected item derivato": la modale legge sempre il match aggiornato.
  const selectedMatch = selectedMatchId ? matches.find(m => m.id === selectedMatchId) || null : null

  const openDrill = (title, list, sub) => setDrill({ title, sub, matches: list || [] })

  const goToInsight = (insight) => {
    setActiveTab(insight.tab || 'rendimento')
    // Due frame: il primo monta il tab, il secondo trova il blocco nel DOM.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById(insight.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }))
  }

  // L'attrezzatura entra nel gate di caricamento perché la sezione Setup è
  // costruita su di essa: senza, il tab mostrerebbe per un istante "nessun dato"
  // prima di popolarsi, che è il modo più veloce di far credere che sia rotto.
  const loading = matchLoading || trainLoading || equipLoading

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>

      {/* Header */}
      <div className="px-6 pt-12 pb-4">
        <p className="text-xs font-semibold uppercase tracking-widest mb-1"
           style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          I tuoi numeri
        </p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          Stats
        </h1>
      </div>

      {loading ? (
        <Spinner />
      ) : matches.length === 0 && trainings.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Periodo — governa tutte le sezioni */}
          <div className="px-6 pb-3">
            <div className="flex gap-2">
              {PERIODS.map(p => (
                <button key={p.id} onClick={() => setPeriod(p.id)}
                  className="flex-1 py-1.5 rounded-full text-[11px] font-medium transition-all"
                  style={{
                    background: period === p.id ? 'var(--color-teal-dark)' : 'var(--color-surface)',
                    color: period === p.id ? 'var(--color-white)' : 'var(--color-slate)',
                    border: period === p.id ? 'none' : '1px solid var(--color-surface-2)',
                    fontFamily: 'var(--font-display)',
                  }}>
                  {p.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-center mt-1.5" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
              {range ? `${shortDate(range.start)} – ${shortDate(range.end)}` : 'Tutto lo storico'}
              {' · '}{scoped.matches.length} {scoped.matches.length === 1 ? 'partita' : 'partite'}
              {' · '}{scoped.trainings.length} {scoped.trainings.length === 1 ? 'allenamento' : 'allenamenti'}
            </p>
          </div>

          {/* Insight */}
          {insights.length > 0 && (
            <div className="px-6 pb-4">
              <InsightList insights={insights} onNavigate={goToInsight} />
            </div>
          )}

          {/* Tab bar */}
          <div className="px-6 pb-4 overflow-x-auto">
            <div className="flex gap-2" style={{ minWidth: 'max-content' }}>
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap"
                  style={{
                    background: activeTab === tab.id ? 'var(--color-teal-dark)' : 'var(--color-surface)',
                    color: activeTab === tab.id ? 'var(--color-white)' : 'var(--color-slate)',
                    fontFamily: 'var(--font-display)',
                    border: activeTab === tab.id ? 'none' : '1px solid var(--color-surface-2)',
                  }}>
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Contenuto */}
          <div className="px-6 pb-32">
            {activeTab === 'rendimento' ? (
              <Rendimento report={report} comparison={comparison} onDrill={openDrill} />
            ) : activeTab === 'attivita' ? (
              <Attivita report={activity} periodLabel={PERIODS.find(p => p.id === period)?.label} />
            ) : activeTab === 'tecnica' ? (
              <Tecnica report={technique} periodLabel={PERIODS.find(p => p.id === period)?.label} />
            ) : activeTab === 'fisico' ? (
              <Fisico report={physical} periodLabel={PERIODS.find(p => p.id === period)?.label} />
            ) : (
              <Setup report={setup} onDrill={openDrill} />
            )}
          </div>
        </>
      )}

      {/* Drill-down: le partite dietro un numero */}
      {drill && (
        <MatchListModal
          title={drill.title}
          sub={drill.sub}
          matches={drill.matches}
          onClose={() => setDrill(null)}
          onSelectMatch={setSelectedMatchId}
        />
      )}

      {/* Dettaglio in sola lettura: modificare o eliminare una partita resta
          un'azione dell'area Matches, dove vive il wizard. */}
      {selectedMatch && (
        <MatchDetailModal
          match={selectedMatch}
          equipment={equipment}
          onClose={() => setSelectedMatchId(null)}
          onUpdate={async (id, data) => { await updateMatch(id, data) }}
        />
      )}
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center pt-20 px-6 text-center">
      <span className="text-5xl mb-4 opacity-60">📊</span>
      <p className="text-base font-semibold mb-1"
         style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
        Ancora niente da analizzare.
      </p>
      <p className="text-sm mb-6" style={{ color: 'var(--color-slate)' }}>
        Le statistiche si costruiscono dalle partite registrate: servono almeno {MIN_CORE} match
        perché un numero significhi qualcosa.
      </p>
      <Link to="/matches"
        className="px-6 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
        style={{ background: 'var(--color-amber)', color: 'var(--color-bg)', fontFamily: 'var(--font-display)' }}>
        Vai alle partite
      </Link>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex justify-center pt-20">
      <div className="w-6 h-6 rounded-full border-2 animate-spin"
           style={{ borderColor: 'var(--color-teal-dark)', borderTopColor: 'transparent' }} />
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

function shortDate(date) {
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: '2-digit' })
}
