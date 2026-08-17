import ScoreBoard from './ScoreBoard'
import { runLadder } from '../../lib/tournaments'

// Il tabellone come SCALA VERTICALE, dalla finale (in cima) al turno di
// ingresso (in fondo). È la forma giusta su smartphone per un motivo
// geometrico prima che estetico: un tabellone ad albero cresce in larghezza —
// le immagini FITP reali sono larghe ~2700px — e su 360px si può solo
// rimpicciolire finché non si legge più niente. La scala invece cresce in
// altezza, che è la dimensione in cui un telefono è infinito, e ogni gradino ha
// tutta la larghezza per il punteggio.
//
// Si disegnano anche i gradini NON raggiunti: sono ciò che restituisce il
// contesto del tabellone senza chiedere all'utente di trascrivere le partite
// altrui. "Uscito ai quarti" da solo non dice quanto mancava; due gradini
// spenti sopra la propria uscita lo dicono a colpo d'occhio.
export default function TournamentLadder({ run, onSelectMatch }) {
  const steps = runLadder(run)
  if (steps.length === 0) return null

  return (
    <div>
      {steps.map((step, i) => (
        <LadderStep
          key={step.round.id}
          step={step}
          run={run}
          isLast={i === steps.length - 1}
          onSelectMatch={onSelectMatch}
        />
      ))}
    </div>
  )
}

function LadderStep({ step, run, isLast, onSelectMatch }) {
  const { round, matches, state } = step
  const isTitle   = round.id === 'finale' && run.status === 'champion'
  // Il primo gradino sopra l'uscita di un cammino ancora aperto non è "non
  // raggiunto": è la partita che si deve ancora giocare.
  const isNextUp  = state === 'unreached' && !run.stale && run.nextRoundId === round.id
  const node      = nodeStyle(state, matches, isTitle, isNextUp)
  const dim       = state === 'unreached' && !isNextUp

  return (
    <div className="flex gap-3">
      {/* Binario */}
      <div className="flex flex-col items-center shrink-0" style={{ width: '1.5rem' }}>
        <div className="flex items-center justify-center rounded-full shrink-0"
             style={{
               width: '1.5rem', height: '1.5rem',
               background: node.bg,
               border: `1.5px ${node.dashed ? 'dashed' : 'solid'} ${node.border}`,
               color: node.fg,
               fontSize: '0.65rem',
             }}>
          {node.glyph}
        </div>
        {!isLast && (
          <div className="flex-1 w-px my-1"
               style={{ background: 'var(--color-surface-2)', minHeight: '1rem' }} />
        )}
      </div>

      {/* Contenuto del turno */}
      <div className="flex-1 min-w-0 pb-3">
        <div className="flex items-center gap-2 mb-1.5" style={{ minHeight: '1.5rem' }}>
          <p className="text-xs font-semibold uppercase tracking-wider"
             style={{ color: dim ? 'var(--color-slate)' : node.fg, fontFamily: 'var(--font-display)', opacity: dim ? 0.6 : 1 }}>
            {round.label}
          </p>
          {isTitle && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(244,163,0,0.16)', color: 'var(--color-amber)', fontFamily: 'var(--font-display)' }}>
              VINTO
            </span>
          )}
        </div>

        {state === 'played' && matches.map(m => (
          <MatchStepCard key={m.id} match={m} onClick={onSelectMatch ? () => onSelectMatch(m.id) : null} />
        ))}

        {state === 'bye' && <GhostBox text="Bye o ingresso diretto — nessuna partita" />}

        {state === 'unreached' && (
          isNextUp
            ? <GhostBox text="Ancora da giocare" accent />
            : <GhostBox text="Non raggiunto" />
        )}
      </div>
    </div>
  )
}

// Una partita del cammino. Riusa `ScoreBoard` come la lista Partite e la
// timeline: il punteggio ha già una sua grammatica nell'app, e un tabellone che
// lo scrivesse in un altro modo costringerebbe a impararne una seconda.
function MatchStepCard({ match, onClick }) {
  const won = match.result === 'win'
  const accent = won ? 'var(--color-win)' : 'var(--color-loss)'
  const Wrapper = onClick ? 'button' : 'div'

  return (
    <Wrapper
      onClick={onClick || undefined}
      className={`w-full text-left rounded-2xl p-3 mb-2 block transition-all ${onClick ? 'active:scale-[0.98]' : ''}`}
      style={{ background: 'var(--color-surface-2)', borderLeft: `2px solid ${accent}` }}
    >
      <ScoreBoard
        sets={match.sets}
        format={match.format}
        retired={match.retired}
        opponentName={match.opponentName}
        size="sm"
      />
    </Wrapper>
  )
}

function GhostBox({ text, accent = false }) {
  return (
    <div className="rounded-2xl px-3 py-2.5"
         style={{
           border: `1px dashed ${accent ? 'var(--color-teal-dark)' : 'var(--color-surface-2)'}`,
           background: accent ? 'rgba(72,179,176,0.06)' : 'transparent',
         }}>
      <p className="text-xs" style={{ color: accent ? 'var(--color-teal)' : 'var(--color-slate)', opacity: accent ? 1 : 0.7 }}>
        {text}
      </p>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

// Il pallino del binario dice l'esito del turno prima ancora di leggere il
// punteggio: pieno = giocato (verde vinto / rosso perso), tratteggiato = saltato,
// spento = mai arrivato, ambra con coppa = titolo.
function nodeStyle(state, matches, isTitle, isNextUp) {
  if (isTitle) {
    return { bg: 'rgba(244,163,0,0.18)', border: 'var(--color-amber)', fg: 'var(--color-amber)', glyph: '🏆', dashed: false }
  }
  if (state === 'played') {
    const won = matches.every(m => m.result === 'win')
    return won
      ? { bg: 'var(--color-win-bg)',  border: 'var(--color-win)',  fg: 'var(--color-win)',  glyph: '✓', dashed: false }
      : { bg: 'var(--color-loss-bg)', border: 'var(--color-loss)', fg: 'var(--color-loss)', glyph: '✕', dashed: false }
  }
  if (state === 'bye') {
    return { bg: 'transparent', border: 'var(--color-surface-2)', fg: 'var(--color-slate)', glyph: '–', dashed: true }
  }
  if (isNextUp) {
    return { bg: 'transparent', border: 'var(--color-teal-dark)', fg: 'var(--color-teal)', glyph: '', dashed: true }
  }
  return { bg: 'transparent', border: 'var(--color-surface-2)', fg: 'var(--color-slate)', glyph: '', dashed: true }
}
