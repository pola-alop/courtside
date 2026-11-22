import TeamStandings from './TeamStandings'
import { buildStandings, competitionStatus } from '../../lib/teamCompetitions'
import { formulaText } from '../../lib/teamTies'

// Card di una competizione nella sezione «A squadre»: nome e stagione, lo stato
// (dove si trova la mia squadra) e la classifica in piccolo. Tutto ricavato:
// `ties` sono tutti gli scontri (la card prende quelli della competizione).
// Testo a capo, mai troncato. Tap → dettaglio.
export default function TeamCompetitionCard({ competition, ties = [], matches = [], onClick }) {
  const standings = buildStandings(competition, ties, matches)
  const status = competitionStatus(competition, ties, matches, new Date(), standings)
  const details = [
    competition.season,
    `${competition.teams.length} squadre`,
    competition.legs === 2 ? 'andata e ritorno' : 'solo andata',
    formulaText(competition.formula),
  ].filter(Boolean).join(' · ')

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-3 flex flex-col items-stretch gap-3 overflow-hidden transition-all active:scale-[0.98]"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1.5">
        <div className="min-w-0 flex-1 basis-40">
          <p className="text-sm font-bold wrap-anywhere"
             style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            {competition.name}
          </p>
          <p className="text-xs mt-0.5 wrap-anywhere" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
            {details}
          </p>
        </div>
        <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ background: status.bg, color: status.color, fontFamily: 'var(--font-display)' }}>
          {status.icon ? `${status.icon} ` : ''}{status.label}
        </span>
      </div>

      <TeamStandings standings={standings} qualifiers={competition.qualifiers} compact />
    </button>
  )
}
