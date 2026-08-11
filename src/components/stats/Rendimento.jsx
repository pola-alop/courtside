import { Card, Tile, BarRow, SplitBar, NotEnough, SampleTag, Note, InfoButton, InfoItem } from './StatsUI'
import SplitsBlock from './SplitsBlock'
import OpponentsBlock from './OpponentsBlock'
import BridgeBlock from './BridgeBlock'
import {
  MIN_CLUTCH, MIN_TIEBREAK, MIN_FIRSTSET, MIN_SET_SLOT, ROLLING_WINDOW,
  SET_BUCKETS, formatPct, formatSigned, formatGames,
} from '../../lib/stats'

// Sezione "Rendimento" — risponde a "quanto sono forte, e come vinco/perdo?".
//
// L'ossatura è in cinque blocchi, dal più sintetico al più specifico:
//   1. Livello        — GW%, record, andamento
//   2. Come vinci/perdi — clutch, profilo, primo set, tenuta, equilibrio, tie-break
//   3. Split          — dove sei anomalo
//   4. Avversari      — contro chi
//   5. Ponte          — l'allenamento si vede in campo?
//
// Ogni numero è un bottone: `onDrill` apre l'elenco delle partite che l'hanno
// prodotto. Una statistica che non si può aprire va creduta sulla parola.

// Colore per "quanto è stato equilibrato un set": è la stessa scala per i set
// vinti e per quelli persi, così le due righe dell'equilibrio sono confrontabili.
const BUCKET_COLORS = {
  dominante:  'var(--color-win)',
  solido:     'var(--color-teal-dark)',
  combattuto: 'var(--color-amber)',
  tiebreak:   'var(--color-loss)',
}

export default function Rendimento({ report, comparison, onDrill }) {
  const { core } = report

  if (!report.enough) {
    return (
      <div className="pt-4">
        <NotEnough need={report.missing} what="Per calcolare il rendimento" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <LivelloBlock report={report} comparison={comparison} />
      <ClutchCard report={report} onDrill={onDrill} />
      <ProfileCard report={report} onDrill={onDrill} />
      <FirstSetCard report={report} onDrill={onDrill} />
      <TenutaCard report={report} onDrill={onDrill} />
      <BalanceCard report={report} />
      <TiebreakCard report={report} onDrill={onDrill} />
      <SplitsBlock report={report} onDrill={onDrill} />
      <OpponentsBlock report={report} onDrill={onDrill} />
      <BridgeBlock report={report} onDrill={onDrill} />

      <Note>
        Il match non registra i punti, quindi non esistono ace, prime di servizio o
        vincenti: tutto qui è ricavato dal punteggio. Il <strong>game vinti %</strong> è
        la metrica portante perché una partita produce ~20 game e un solo risultato —
        si stabilizza molto prima del rapporto vittorie/sconfitte, e con {core.n} partite
        è già un segnale mentre il win/loss è ancora rumore.
      </Note>
    </div>
  )
}

// ── Blocco 1 — Livello ─────────────────────────────────────

function LivelloBlock({ report, comparison }) {
  const { core, streaks, tiebreaks } = report
  const streakLabel = streaks.current.count
    ? `${streaks.current.count}${streaks.current.type === 'win' ? 'V' : 'S'}`
    : '—'

  // Il delta è in PUNTI percentuali, non in percentuale del valore: "+3 punti"
  // è una frase verificabile, "+6%" su un 52% è ambigua.
  const deltaPoints = comparison && core.gameWinRate != null
    ? Math.round((core.gameWinRate - comparison.rate) * 100)
    : null

  return (
    <Card id="livello" title="Livello" titleExtra={<InfoButton title="Cos'è il Livello?"><LivelloInfo /></InfoButton>}
          right={<SampleTag n={core.n} />}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-4xl font-bold leading-none"
             style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
            {formatPct(core.gameWinRate)}
          </p>
          <p className="text-[10px] uppercase tracking-wide mt-1.5" style={{ color: 'var(--color-slate)' }}>
            Game vinti
            {deltaPoints != null && (
              <span className="ml-1.5" style={{
                color: deltaPoints === 0 ? 'var(--color-slate)' : deltaPoints > 0 ? 'var(--color-win)' : 'var(--color-loss)',
                fontFamily: 'var(--font-mono)',
              }}>
                {deltaPoints > 0 ? '▲' : deltaPoints < 0 ? '▼' : '='}{deltaPoints !== 0 ? Math.abs(deltaPoints) : ''} vs {comparison.label}
              </span>
            )}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold leading-none"
             style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            {formatPct(core.winRate)}
          </p>
          <p className="text-[10px] uppercase tracking-wide mt-1" style={{ color: 'var(--color-slate)' }}>
            Partite vinte
          </p>
          <p className="text-[10px] mt-1" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
            {core.wins}V · {core.draws}P · {core.losses}S
          </p>
        </div>
      </div>

      <div className="mt-3">
        <SplitBar rate={core.gameWinRate} leftColor="var(--color-teal-dark)" rightColor="var(--color-slate)" />
        <div className="flex justify-between mt-1">
          <span className="text-[9px]" style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-mono)' }}>
            {core.gamesMe} game
          </span>
          <span className="text-[9px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
            {core.gamesOpp} game
          </span>
        </div>
      </div>

      <RollingTrend series={report.rolling} n={core.n} />

      <div className="grid grid-cols-4 gap-2 mt-3">
        <Tile label="Set vinti" value={formatPct(core.setWinRate)} sub={`${core.setsMe}-${core.setsOpp}`} />
        <Tile label="Tie-break" value={tiebreaks.all.n ? formatPct(tiebreaks.all.rate) : '—'}
              sub={tiebreaks.all.n ? `${tiebreaks.all.won}-${tiebreaks.all.lost}` : 'nessuno'} />
        <Tile label="Serie" value={streakLabel}
              color={streaks.current.type === 'win' ? 'var(--color-win)' : streaks.current.type === 'loss' ? 'var(--color-loss)' : 'var(--color-white)'}
              sub={`max ${streaks.bestWin}V`} />
        <Tile label="Margine" value={formatSigned(core.avgMargin)} sub="game/partita"
              color={core.avgMargin > 0 ? 'var(--color-win)' : 'var(--color-loss)'} />
      </div>
    </Card>
  )
}

// Andamento del GW% su finestra mobile di 10 partite. Le barre partono dal 50%
// e non da zero: una serie che oscilla tra 46% e 56% disegnata da zero
// sembrerebbe una linea piatta, mentre è esattamente lì che vive la differenza
// tra un periodo buono e uno storto.
function RollingTrend({ series, n }) {
  if (series.length < 3) {
    return (
      <p className="text-[10px] mt-3" style={{ color: 'var(--color-slate)' }}>
        L'andamento compare da {ROLLING_WINDOW + 2} partite in poi (ne hai {n}).
      </p>
    )
  }

  const deviations = series.map(s => (s.value ?? 0.5) - 0.5)
  const maxAbs = Math.max(0.08, ...deviations.map(Math.abs))

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--color-slate)' }}>
          Andamento · media mobile {ROLLING_WINDOW} partite
        </span>
        <span className="text-[9px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          50%
        </span>
      </div>
      <div className="flex items-stretch gap-px h-11">
        {deviations.map((d, i) => {
          const h = Math.max(2, (Math.abs(d) / maxAbs) * 20)
          const positive = d >= 0
          return (
            <div key={i} className="flex-1 flex flex-col min-w-0">
              <div className="h-[22px] flex items-end">
                {positive && <div className="w-full rounded-t-sm" style={{ height: h, background: 'var(--color-win)' }} />}
              </div>
              <div className="h-[22px] flex items-start" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
                {!positive && <div className="w-full rounded-b-sm" style={{ height: h, background: 'var(--color-loss)' }} />}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          {shortDate(series[0].date)}
        </span>
        <span className="text-[9px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          {shortDate(series[series.length - 1].date)}
        </span>
      </div>
    </div>
  )
}

function LivelloInfo() {
  return (
    <>
      <InfoItem title="Game vinti %">
        Un game è la singola posta in palio dentro un set (i punti 15-30-40): un set si vince
        arrivando a 6 game con 2 di margine, altrimenti al tie-break. Questa percentuale dice
        quanti game hai vinto sul totale giocato, indipendentemente da chi ha vinto la partita.
        È il numero più importante della pagina: una partita produce circa 20 game e un solo
        risultato, quindi il game vinti % si stabilizza molto prima del rapporto vittorie/sconfitte
        — con poche decine di partite è già un segnale affidabile, mentre il record è ancora rumore.
        La freccia sotto (▲/▼/=) mostra di quanti punti percentuali è cambiato rispetto al periodo
        precedente.
      </InfoItem>
      <InfoItem title="Partite vinte %">
        La classica percentuale di partite vinte sul totale, con il record per esteso: V (vittorie),
        P (pareggi), S (sconfitte). Sotto trovi i game totali fatti e subiti, messi a confronto
        nella barra.
      </InfoItem>
      <InfoItem title="Andamento">
        Come è cambiato il tuo game vinti % nel tempo, calcolato su una media mobile delle ultime
        10 partite (ogni barra riassume le 10 partite più recenti fino a quel punto, non una
        singola partita). Le barre partono dal 50%, non da zero: sopra la linea centrale (verde) è
        un periodo positivo, sotto (rosso) un periodo negativo.
      </InfoItem>
      <InfoItem title="Set vinti / Tie-break / Serie / Margine">
        <strong>Set vinti</strong>: percentuale di set vinti sul totale, con il conteggio vinti-persi
        sotto. <strong>Tie-break</strong>: percentuale di tie-break vinti (set decisi 7-6); "—" se non
        ne hai giocati. <strong>Serie</strong>: la sequenza di risultati consecutivi in corso (es. "3V"
        = stai vincendo da 3 partite), con sotto la tua serie di vittorie più lunga di sempre.
        <strong> Margine</strong>: quanti game vinci (o perdi) in media a partita — positivo e verde
        vuol dire che vinci di solito con margine, negativo e rosso il contrario.
      </InfoItem>
    </>
  )
}

// ── Blocco 2 — Come vinci e come perdi ─────────────────────

function ClutchCard({ report, onDrill }) {
  const { clutch, core } = report

  const info = <InfoButton title='Cos&apos;è "Atteso vs reale"?'><ClutchInfo /></InfoButton>

  if (!clutch || clutch.n < MIN_CLUTCH) {
    return (
      <Card id="clutch" title="Atteso vs reale" titleExtra={info} sub="Vinci i game giusti, o solo tanti game?">
        <NotEnough need={MIN_CLUTCH - (clutch?.n || 0)} />
      </Card>
    )
  }

  const positive = clutch.delta >= 0
  const color = Math.abs(clutch.delta) < 0.03
    ? 'var(--color-slate)'
    : positive ? 'var(--color-win)' : 'var(--color-loss)'

  return (
    <Card id="clutch" title="Atteso vs reale" titleExtra={info} sub="Vinci i game giusti, o solo tanti game?"
          right={<SampleTag n={clutch.n} />}>
      <div className="flex items-stretch gap-2">
        <Tile label="Atteso" value={formatPct(clutch.expected)} sub={`da ${formatPct(core.gameWinRate)} game`} />
        <Tile label="Reale" value={formatPct(clutch.actual)} sub={`${clutch.n} partite decise`}
              onClick={() => onDrill('Partite decise', clutch.matches, 'Vittorie e sconfitte, esclusi i pareggi')} />
        <Tile label="Scarto" value={`${positive ? '+' : ''}${Math.round(clutch.delta * 100)}`} sub="punti" color={color} />
      </div>

      <p className="text-[11px] mt-3 leading-relaxed" style={{ color: 'var(--color-white)' }}>
        {Math.abs(clutch.delta) < 0.03
          ? 'Il tuo rendimento nelle partite è in linea con quello nei game: vinci più o meno quanto meriteresti.'
          : positive
            ? `Vinci ${Math.round(clutch.delta * 100)} partite su 100 più di quante ne suggerirebbe il tuo rendimento nei game: nei momenti importanti alzi il livello.`
            : `Vinci ${Math.round(-clutch.delta * 100)} partite su 100 meno di quante ne suggerirebbe il tuo rendimento nei game: giochi bene, ma nei momenti importanti lasci per strada.`}
      </p>

      <Note>
        L'atteso si ottiene simulando ogni partita con la tua percentuale di game
        vinti, come se ogni game fosse indipendente: è il risultato che avrebbe un
        giocatore che vince quella quota di game in modo neutro, senza alti e bassi
        nei momenti decisivi. Il modello ignora l'alternanza al servizio, quindi conta
        lo scarto, non il valore assoluto.
      </Note>
    </Card>
  )
}

function ClutchInfo() {
  return (
    <>
      <InfoItem>
        Confronta le partite che dovresti vincere in base a quanto sei forte nei game con quelle
        che vinci davvero, per capire se nei momenti che contano (fine set, fine partita) rendi
        meglio o peggio del tuo livello medio.
      </InfoItem>
      <InfoItem title="Atteso">
        La percentuale di partite che vincerebbe un giocatore con la tua percentuale di game
        vinti, se ogni game fosse un evento a sé stante, sempre uguale, senza momenti belli o
        brutti. È una simulazione basata solo sul tuo game vinti %, non un dato osservato.
      </InfoItem>
      <InfoItem title="Reale">
        La percentuale di partite realmente vinte, calcolata solo sulle partite decise (escludendo
        i pareggi). Tocca il numero per vedere quali partite lo compongono.
      </InfoItem>
      <InfoItem title="Scarto">
        La differenza in punti percentuali tra Reale e Atteso. Positivo e verde: vinci più partite
        di quante il tuo livello nei game suggerirebbe — nei momenti importanti alzi il livello.
        Negativo e rosso: il contrario, giochi bene ma nei momenti decisivi lasci qualcosa per
        strada.
      </InfoItem>
    </>
  )
}

function ProfileCard({ report, onDrill }) {
  const { win, loss } = report.profile
  if (!win.n && !loss.n) return null

  // Un tetto (vinci di misura, perdi male) e un problema di solidità (vinci
  // largo, perdi di misura) sono due giocatori diversi con lo stesso win rate.
  const reading = (() => {
    if (!win.n || !loss.n || win.avgMargin == null || loss.avgMargin == null) return null
    const w = Math.abs(win.avgMargin), l = Math.abs(loss.avgMargin)
    if (Math.abs(w - l) < 1.5) return 'Vittorie e sconfitte hanno lo stesso peso: giochi quasi sempre partite equilibrate.'
    return w > l
      ? 'Le tue vittorie sono più nette delle tue sconfitte: quando entri in partita chiudi, quando perdi resti comunque attaccato.'
      : 'Le tue sconfitte sono più pesanti delle tue vittorie: vinci di misura contro chi vale quanto te e crolli contro chi è più forte.'
  })()

  return (
    <Card id="profilo" title="Come vinci, come perdi" sub="Punteggio medio di un set"
          titleExtra={<InfoButton title="Come vinci, come perdi"><ProfileInfo /></InfoButton>}>
      <div className="space-y-3">
        <ProfileRow label="Quando vinci" side={win} color="var(--color-win)"
                    onClick={() => onDrill('Vittorie', win.matches)} />
        <ProfileRow label="Quando perdi" side={loss} color="var(--color-loss)"
                    onClick={() => onDrill('Sconfitte', loss.matches)} />
      </div>
      {reading && <Note>{reading}</Note>}
    </Card>
  )
}

function ProfileRow({ label, side, color, onClick }) {
  if (!side.n) return null
  return (
    <button onClick={onClick} className="w-full text-left flex items-center gap-3 transition-all active:scale-[0.99]">
      <span className="flex-1 min-w-0">
        <span className="text-[11px] block" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {label}
        </span>
        <span className="text-[9px] block mt-0.5" style={{ color: 'var(--color-slate)' }}>
          {side.n} {side.n === 1 ? 'partita' : 'partite'} · margine {formatSigned(side.avgMargin)} game
        </span>
      </span>
      <span className="text-lg font-bold shrink-0" style={{ color, fontFamily: 'var(--font-mono)' }}>
        {formatGames(side.avgMe)}–{formatGames(side.avgOpp)}
      </span>
    </button>
  )
}

function ProfileInfo() {
  return (
    <>
      <InfoItem>
        Confronta il punteggio medio di un set nelle partite che vinci con quello nelle partite
        che perdi, per capire se vinci/perdi di misura o con ampio margine.
      </InfoItem>
      <InfoItem title="Quando vinci / Quando perdi">
        Il punteggio grande (es. "6-3") è il risultato medio di un set in quel tipo di partita:
        quanti game fai tu in media contro quanti ne fa l'avversario. Sotto trovi il numero di
        partite di quel tipo e il margine medio in game a partita. Tocca la riga per vedere le
        partite.
      </InfoItem>
      <InfoItem title="La frase sotto ai punteggi">
        Se le tue vittorie sono molto più nette delle tue sconfitte (o viceversa), significa che
        hai un "tetto" — chiudi bene le partite alla tua portata ma soffri contro chi è più forte
        — oppure un problema di solidità — vinci di misura ma crolli quando va male. Se i due
        margini sono simili, giochi quasi sempre partite equilibrate.
      </InfoItem>
    </>
  )
}

function FirstSetCard({ report, onDrill }) {
  const { won, lost, holdRate, comebackRate } = report.firstSet
  if (!won.n && !lost.n) return null

  return (
    <Card id="primo-set" title="Peso del primo set" sub="Quanto tieni il vantaggio, quanto rimonti"
          titleExtra={<InfoButton title="Peso del primo set"><FirstSetInfo /></InfoButton>}>
      <div className="space-y-3">
        <BarRow label="Vinto il 1° set → partita vinta"
                value={won.n ? formatPct(holdRate) : '—'}
                rate={holdRate} tick={0.5} dim={won.n < MIN_FIRSTSET}
                color="var(--color-win)"
                sub={`${won.wins} su ${won.n}`}
                onClick={won.n ? () => onDrill('Primo set vinto', won.matches) : undefined} />
        <BarRow label="Perso il 1° set → partita vinta"
                value={lost.n ? formatPct(comebackRate) : '—'}
                rate={comebackRate} tick={0.5} dim={lost.n < MIN_FIRSTSET}
                color="var(--color-amber)"
                sub={`${lost.wins} su ${lost.n}`}
                onClick={lost.n ? () => onDrill('Primo set perso', lost.matches) : undefined} />
      </div>
      {(won.n < MIN_FIRSTSET || lost.n < MIN_FIRSTSET) && (
        <Note>Le righe con meno di {MIN_FIRSTSET} partite sono in trasparenza: il campione è ancora troppo piccolo per leggerle.</Note>
      )}
    </Card>
  )
}

function FirstSetInfo() {
  return (
    <>
      <InfoItem>
        Misura quanto conta vincere o perdere il primo set per l'esito finale della partita.
      </InfoItem>
      <InfoItem title="Vinto il 1° set → partita vinta">
        Su tutte le partite in cui hai vinto il primo set, in quale percentuale hai poi vinto anche
        la partita. Un valore alto vuol dire che, una volta avanti, tieni bene il vantaggio.
      </InfoItem>
      <InfoItem title="Perso il 1° set → partita vinta">
        Su tutte le partite in cui hai perso il primo set, in quale percentuale sei comunque
        riuscito a rimontare e vincere la partita.
      </InfoItem>
      <InfoItem>
        Il numero "X su Y" sotto ogni barra indica quante partite su quel totale hanno avuto
        quell'esito.
      </InfoItem>
    </>
  )
}

function TenutaCard({ report, onDrill }) {
  const { setIndex, decider } = report
  const usable = setIndex.filter(s => s.n > 0)
  if (usable.length < 2) return null

  return (
    <Card id="tenuta" title="Tenuta alla distanza" sub="Game vinti, set per set"
          titleExtra={<InfoButton title="Tenuta alla distanza"><TenutaInfo /></InfoButton>}>
      <div className="space-y-3">
        {usable.map(s => (
          <BarRow key={s.index}
                  label={`${s.index + 1}° set`}
                  value={formatPct(s.rate)}
                  rate={s.rate} tick={0.5}
                  dim={s.n < MIN_SET_SLOT}
                  color={s.rate >= 0.5 ? 'var(--color-teal-dark)' : 'var(--color-amber-dark)'}
                  sub={`${s.n} set giocati`}
                  onClick={() => onDrill(`${s.index + 1}° set`, s.matches, `Partite arrivate almeno al ${s.index + 1}° set`)} />
        ))}
      </div>

      {decider.n > 0 && (
        <button onClick={() => onDrill('Set decisivi', decider.matches)}
                className="w-full mt-3 flex items-center justify-between rounded-xl px-3 py-2.5 transition-all active:scale-[0.99]"
                style={{ background: 'var(--color-surface-2)' }}>
          <span className="text-[11px]" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            Set decisivi
          </span>
          <span className="text-[11px] font-semibold"
                style={{ color: decider.won >= decider.lost ? 'var(--color-win)' : 'var(--color-loss)', fontFamily: 'var(--font-mono)' }}>
            {decider.won} vinti su {decider.n}
          </span>
        </button>
      )}

      <Note>
        Il super tie-break del formato Amatoriale non compare qui: sono punti, non
        game, e finirebbe per falsare la percentuale. Lo trovi nel blocco tie-break.
      </Note>
    </Card>
  )
}

function TenutaInfo() {
  return (
    <>
      <InfoItem>
        Mostra la tua percentuale di game vinti separata per ogni set della partita (1° set, 2°
        set, ecc.), per capire se il tuo rendimento cala o migliora man mano che la partita si
        allunga.
      </InfoItem>
      <InfoItem title="1°, 2°, 3° set...">
        Percentuale di game vinti nei set giocati in quella posizione, con sotto quanti set hai
        giocato lì. Tocca la riga per vedere le partite che sono arrivate almeno a quel set.
      </InfoItem>
      <InfoItem title="Set decisivi">
        Nelle partite arrivate all'ultimo set possibile — quello che decide il vincitore — quanti
        ne hai vinti su quanti giocati.
      </InfoItem>
      <InfoItem>
        Il super tie-break del formato Amatoriale non è incluso qui: si gioca a punti, non a game,
        e falserebbe la percentuale. Lo trovi nel blocco Tie-break.
      </InfoItem>
    </>
  )
}

function BalanceCard({ report }) {
  const { balance } = report
  if (!balance.total) return null

  const wonTotal  = SET_BUCKETS.reduce((s, b) => s + balance.won[b.id], 0)
  const lostTotal = SET_BUCKETS.reduce((s, b) => s + balance.lost[b.id], 0)

  return (
    <Card id="equilibrio" title="Equilibrio dei set" sub="Quanto sono combattuti i set che vinci e quelli che perdi"
          titleExtra={<InfoButton title="Equilibrio dei set"><BalanceInfo /></InfoButton>}>
      <StackedBar label={`Set vinti (${wonTotal})`} counts={balance.won} total={wonTotal} />
      <div className="mt-3">
        <StackedBar label={`Set persi (${lostTotal})`} counts={balance.lost} total={lostTotal} />
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
        {SET_BUCKETS.map(b => (
          <span key={b.id} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: BUCKET_COLORS[b.id] }} />
            <span className="text-[9px]" style={{ color: 'var(--color-slate)' }}>{b.label} <span style={{ fontFamily: 'var(--font-mono)' }}>{b.sub}</span></span>
          </span>
        ))}
      </div>

      {(balance.bagelsGiven > 0 || balance.bagelsReceived > 0) && (
        <p className="text-[10px] mt-3" style={{ color: 'var(--color-slate)' }}>
          🥯 Bagel: <span style={{ color: 'var(--color-win)', fontFamily: 'var(--font-mono)' }}>{balance.bagelsGiven} inflitti</span>
          {' · '}
          <span style={{ color: 'var(--color-loss)', fontFamily: 'var(--font-mono)' }}>{balance.bagelsReceived} subiti</span>
        </p>
      )}

      <Note>
        Il colore indica quanto è stato equilibrato il set, non chi l'ha vinto: le due
        righe usano la stessa scala e vanno confrontate tra loro. Molti set persi al
        tie-break con pochi vinti allo stesso modo è la firma di un problema nei punti
        importanti, non di livello.
      </Note>
    </Card>
  )
}

function BalanceInfo() {
  return (
    <>
      <InfoItem>
        Non dice chi vince: dice quanto è stato combattuto ogni set che hai vinto o perso,
        raggruppando i punteggi in 4 fasce.
      </InfoItem>
      <InfoItem title="Dominante (6-0 / 6-1)">Set vinto o perso con ampio margine.</InfoItem>
      <InfoItem title="Solido (6-2 / 6-3)">Margine chiaro ma non netto.</InfoItem>
      <InfoItem title="Combattuto (6-4 / 7-5)">Set punto a punto, deciso sul filo.</InfoItem>
      <InfoItem title="Tie-break (7-6)">Set deciso al tie-break: il massimo dell'equilibrio.</InfoItem>
      <InfoItem title="Come leggere le due barre">
        "Set vinti" e "Set persi" usano la stessa scala colori, quindi vanno confrontate tra loro:
        molti set persi al tie-break e pochi vinti allo stesso modo è il segnale di un problema nei
        punti importanti, non di un livello generale più basso.
      </InfoItem>
      <InfoItem title="Bagel 🥯">
        Un "bagel" è un set vinto o perso per 6-0 (la forma dello "0" ricorda una ciambella).
        "Inflitti" sono quelli fatti tu, "subiti" quelli presi.
      </InfoItem>
    </>
  )
}

function StackedBar({ label, counts, total }) {
  return (
    <div>
      <p className="text-[10px] mb-1.5" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
        {label}
      </p>
      {total === 0 ? (
        <div className="h-3 rounded-full" style={{ background: 'var(--color-surface-2)' }} />
      ) : (
        <div className="h-3 rounded-full overflow-hidden flex" style={{ background: 'var(--color-surface-2)' }}>
          {SET_BUCKETS.map(b => {
            const c = counts[b.id]
            if (!c) return null
            return (
              <div key={b.id} title={`${b.label}: ${c}`}
                   className="flex items-center justify-center"
                   style={{ width: `${(c / total) * 100}%`, background: BUCKET_COLORS[b.id] }}>
                {c / total > 0.12 && (
                  <span className="text-[8px] font-semibold" style={{ color: 'var(--color-bg)', fontFamily: 'var(--font-mono)' }}>{c}</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TiebreakCard({ report, onDrill }) {
  const { normal, superTb, all } = report.tiebreaks
  if (!all.n) return null

  return (
    <Card id="tiebreak" title="Tie-break" sub="La misura più pura dei momenti di pressione"
          titleExtra={<InfoButton title="Tie-break"><TiebreakInfo /></InfoButton>}
          right={<SampleTag n={all.n} unit="giocati" />}>
      {all.n < MIN_TIEBREAK ? (
        <NotEnough need={MIN_TIEBREAK - all.n} unit="tie-break" />
      ) : (
        <div className="space-y-3">
          {normal.n > 0 && (
            <BarRow label="Tie-break di set (7-6)" value={formatPct(normal.rate)} rate={normal.rate} tick={0.5}
                    color={normal.rate >= 0.5 ? 'var(--color-win)' : 'var(--color-loss)'}
                    sub={`${normal.won} vinti · ${normal.lost} persi`}
                    onClick={() => onDrill('Partite con tie-break', dedupe(normal.matches))} />
          )}
          {superTb.n > 0 && (
            <BarRow label="Super tie-break (set decisivo)" value={formatPct(superTb.rate)} rate={superTb.rate} tick={0.5}
                    color={superTb.rate >= 0.5 ? 'var(--color-win)' : 'var(--color-loss)'}
                    sub={`${superTb.won} vinti · ${superTb.lost} persi`}
                    onClick={() => onDrill('Partite decise al super tie-break', dedupe(superTb.matches))} />
          )}
        </div>
      )}
      <Note>
        Tie-break e super tie-break restano separati: sono due prove diverse — 7 punti
        dentro un set, 10 punti al posto di un set intero — e mescolarle nasconderebbe
        proprio il dato interessante.
      </Note>
    </Card>
  )
}

function TiebreakInfo() {
  return (
    <>
      <InfoItem>
        Il tie-break è il game speciale (di solito fino a 7 punti) che decide un set quando si
        arriva 6-6. È considerato la misura più pura dei momenti di pressione perché è un
        punteggio ripartito da zero, indipendente da come è andato il resto del set.
      </InfoItem>
      <InfoItem title="Tie-break di set (7-6)">
        Percentuale di tie-break vinti tra quelli che hanno deciso un set (risultato finale 7-6),
        con il conteggio vinti/persi sotto.
      </InfoItem>
      <InfoItem title="Super tie-break (set decisivo)">
        Nel formato Amatoriale, l'eventuale set decisivo viene sostituito da un mini-set a punti
        fino a 10 invece che da un set intero: qui trovi la percentuale vinta di questi super
        tie-break.
      </InfoItem>
      <InfoItem>
        Le due percentuali restano separate perché sono prove diverse — 7 punti dentro un set
        contro 10 punti al posto di un intero set — e mescolarle nasconderebbe la differenza.
      </InfoItem>
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────

// Una partita può contenere più tie-break: nell'elenco deve comparire una volta sola.
function dedupe(matches) {
  return [...new Map(matches.map(m => [m.id, m])).values()]
}

function shortDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
  } catch { return '—' }
}
