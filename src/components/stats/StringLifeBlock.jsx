import { useState } from 'react'
import { Card, Tile, NotEnough, SampleTag, Note, InfoButton, InfoItem } from './StatsUI'
import {
  MIN_MOUNTS, formatDays, formatMountDate, formatGamesShort,
} from '../../lib/setup'
import { STRING_LIFE_GAMES, STRING_LIFE_DAYS } from '../../lib/wear'

// Blocco 2 — la vita reale delle corde.
//
// È il blocco per cui vale la pena avere questa sezione. Da `stringsHistory` +
// `mountedAt` escono gli intervalli veri di ogni incordatura, e dentro ciascuno
// si contano i game davvero giocati: il risultato è una misura della vita reale
// delle tue corde, con cui l'app può dire se il budget di STRING_LIFE_GAMES
// scritto in wear.js è tarato bene PER TE.
//
// ── Perché è una verifica e non una correzione automatica ──
// Il numero che esce qui non riscrive da solo la costante in wear.js. Cambiarla
// in silenzio sposterebbe retroattivamente ogni percentuale di usura già vista in
// Equipment — un capo "al 78%" diventerebbe "al 112%" senza che sia successo
// niente in campo — e il metodo annotato in CLAUDE.md per queste costanti è
// esattamente l'opposto: si misura, si confronta con la sensazione in campo, e
// poi si ritara a mano. Questo blocco è la parte "si misura".

const VISIBLE_MOUNTS = 5

export default function StringLifeBlock({ report }) {
  const [expanded, setExpanded] = useState(false)
  const s = report.strings
  const cal = s.calibration
  const info = <InfoButton title="La vita reale delle tue corde"><StringLifeInfo /></InfoButton>

  if (s.lives.length === 0) {
    return (
      <Card id="vita-corde" title="Vita delle corde" titleExtra={info}
            sub="Quanto durano davvero, in game giocati">
        <NotEnough need={1} unit="incordature con la data di montaggio"
                   what="Per misurare la durata delle corde" />
        <Note>
          La misura nasce dallo storico incordature: ogni volta che registri un cambio corde dal
          dettaglio della racchetta, l'app chiude l'incordatura precedente e conta quanti game hai
          giocato mentre era montata. Serve la data di montaggio — senza, l'incordatura non è
          collocabile sulla linea del tempo.
        </Note>
      </Card>
    )
  }

  const shown = expanded ? s.lives : s.lives.slice(0, VISIBLE_MOUNTS)

  return (
    <Card id="vita-corde" title="Vita delle corde" titleExtra={info}
          sub="Quanto durano davvero, in game giocati"
          right={<SampleTag n={s.lives.length} unit="incordature" />}>

      {cal.enough ? <Calibration cal={cal} /> : (
        <NotEnough need={cal.missing} unit="incordature concluse con almeno una sessione registrata"
                   what="Per tarare il budget sul tuo gioco" />
      )}

      {/* L'incordatura attuale, se c'è: è l'unica riga che sta ancora correndo. */}
      {s.current.map(cur => (
        <CurrentMount key={cur.key} life={cur} median={cal.games?.median ?? null} />
      ))}

      {/* Lo storico, dal più recente. */}
      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
        <p className="text-[9px] uppercase tracking-wide mb-2.5" style={{ color: 'var(--color-slate)' }}>
          Le tue incordature
        </p>
        <div className="space-y-2.5">
          {shown.map(life => <MountRow key={life.key} life={life} max={maxGames(s.lives)} />)}
        </div>
        {s.lives.length > VISIBLE_MOUNTS && (
          <button onClick={() => setExpanded(!expanded)}
                  className="w-full mt-3 py-2 rounded-xl text-[11px] font-medium transition-all active:scale-[0.98]"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
            {expanded ? 'Mostra meno' : `Mostra le altre ${s.lives.length - VISIBLE_MOUNTS}`}
          </button>
        )}
      </div>

      <Note>
        I game di un allenamento non sono game veri ma <strong>game equivalenti</strong>: un'ora di
        cesto produce cinque volte i colpi di un'ora di partita, e le tariffe che fanno la conversione
        sono le stesse che calcolano l'usura in Equipment.
        {s.breaks > 0
          ? ' Le rotture sono rilevate dalla spunta «ho rotto le corde» degli allenamenti: il wizard partita non la chiede, quindi una corda rotta in partita risulta qui come un normale cambio.'
          : ' Le rotture si registrano dalla spunta «ho rotto le corde» nel wizard di un allenamento — il wizard partita non la chiede.'}
        {cal.skipped > 0 && ` ${cal.skipped} ${cal.skipped === 1 ? 'incordatura è esclusa' : 'incordature sono escluse'} dalla taratura: non ${cal.skipped === 1 ? 'ha' : 'hanno'} nessuna sessione registrata sotto, quindi ${cal.skipped === 1 ? 'misurerebbe' : 'misurerebbero'} il diario e non la corda.`}
        {s.undatedMounts > 0 && ` ${s.undatedMounts} ${s.undatedMounts === 1 ? 'incordatura non ha' : 'incordature non hanno'} la data di montaggio e ${s.undatedMounts === 1 ? 'resta' : 'restano'} fuori dalla linea del tempo.`}
      </Note>
    </Card>
  )
}

// ── La taratura ────────────────────────────────────────────
// Il confronto tra la vita reale misurata e la costante del modello di usura.

function Calibration({ cal }) {
  const s = cal.suggestion
  const timeDriven = s.verdict === 'time-driven'

  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xl font-bold leading-none"
             style={{ color: verdictColor(s.verdict), fontFamily: 'var(--font-display)' }}>
            {timeDriven ? cal.days.median : cal.games.median}
            <span className="text-sm ml-1" style={{ color: 'var(--color-slate)' }}>
              {timeDriven ? 'giorni' : 'game'}
            </span>
          </p>
          <p className="text-[10px] uppercase tracking-wide mt-1.5" style={{ color: 'var(--color-slate)' }}>
            La tua vita mediana · {cal.n} {cal.n === 1 ? 'incordatura' : 'incordature'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold leading-none" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
            {timeDriven ? STRING_LIFE_DAYS : STRING_LIFE_GAMES}
          </p>
          <p className="text-[9px] mt-1" style={{ color: 'var(--color-slate)' }}>nel modello</p>
        </div>
      </div>

      {/* Le due lunghezze una sopra l'altra: il confronto è la sostanza del
          blocco, e due numeri affiancati non lo rendono. */}
      <div className="mt-3 space-y-1.5">
        <CalBar label="Tu" value={timeDriven ? cal.days.median : cal.games.median}
                max={calMax(cal, timeDriven)} color={verdictColor(s.verdict)} />
        <CalBar label="Modello" value={timeDriven ? STRING_LIFE_DAYS : STRING_LIFE_GAMES}
                max={calMax(cal, timeDriven)} color="var(--color-slate)" />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <Tile label="Più corta" value={timeDriven ? formatDays(cal.days.min) : formatGamesShort(cal.games.min)} />
        <Tile label="Più lunga" value={timeDriven ? formatDays(cal.days.max) : formatGamesShort(cal.games.max)} />
        <Tile label="Rotture" value={String(cal.broken.n)}
              color={cal.broken.n > 0 ? 'var(--color-loss)' : 'var(--color-white)'}
              sub={cal.broken.medianGames != null ? `~${Math.round(cal.broken.medianGames)} game` : undefined} />
      </div>

      <div className="mt-4 rounded-xl px-3 py-3" style={{ background: verdictBg(s.verdict) }}>
        <p className="text-[11px] font-semibold mb-1"
           style={{ color: verdictColor(s.verdict), fontFamily: 'var(--font-display)' }}>
          {verdictTitle(s.verdict)}
        </p>
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-white)' }}>
          {s.verdict === 'ok' && (
            <>I {STRING_LIFE_GAMES} game assunti dal modello di usura sono vicini alla tua vita reale
              ({cal.games.median} game): la percentuale che vedi in Equipment descrive bene quando le
              tue corde sono davvero finite. Nessuna ritaratura necessaria.</>
          )}
          {s.verdict === 'high' && (
            <>Cambi le corde dopo {cal.games.median} game, ma il modello ne assume {STRING_LIFE_GAMES}:
              il budget in app è <strong>troppo alto per te</strong>, e ti dice «corde ok» quando tu
              le hai già cambiate. Portare <code style={{ fontFamily: 'var(--font-mono)' }}>STRING_LIFE_GAMES</code> a
              circa <strong>{s.value}</strong> allineerebbe l'avviso alla tua sensazione in campo.</>
          )}
          {s.verdict === 'low' && (
            <>Le tue corde arrivano a {cal.games.median} game prima di essere cambiate, contro
              i {STRING_LIFE_GAMES} assunti dal modello: il budget in app è
              <strong> troppo basso per te</strong> e ti allarma prima del necessario. Portare
              <code style={{ fontFamily: 'var(--font-mono)' }}> STRING_LIFE_GAMES</code> a
              circa <strong>{s.value}</strong> lo allineerebbe.</>
          )}
          {s.verdict === 'time-driven' && (
            <>Le tue incordature finiscono per <strong>tempo</strong>, non per gioco: in media
              {' '}{cal.days.median} giorni, con pochi game dentro. Il budget in game non è la tua
              restrizione — a decidere quando reincordi è il calendario, ed è l'asse temporale
              ({STRING_LIFE_DAYS} giorni nel modello) quello da guardare. Solo {cal.playDriven} delle
              tue {cal.n} incordature è finita perché ci hai giocato abbastanza.</>
          )}
        </p>
      </div>
    </>
  )
}

function CalBar({ label, value, max, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] w-14 shrink-0" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
        {label}
      </span>
      <span className="flex-1 h-2 rounded-full min-w-0" style={{ background: 'var(--color-surface-2)' }}>
        <span className="block h-full rounded-full"
              style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
      </span>
      <span className="text-[10px] w-10 text-right shrink-0" style={{ color, fontFamily: 'var(--font-mono)' }}>
        {Math.round(value)}
      </span>
    </div>
  )
}

// ── L'incordatura in corso ─────────────────────────────────
// L'unica riga che sta ancora correndo, e l'unica su cui si può agire.

function CurrentMount({ life, median }) {
  const reference = median || STRING_LIFE_GAMES
  const share = reference > 0 ? life.games / reference : 0
  const color = share >= 1 ? 'var(--color-loss)' : share >= 0.66 ? 'var(--color-amber)' : 'var(--color-teal)'

  return (
    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
      <p className="text-[9px] uppercase tracking-wide mb-2" style={{ color: 'var(--color-slate)' }}>
        Sulla racchetta adesso
      </p>
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] flex-1 min-w-0 truncate"
              style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {life.label}{life.tension ? ` · ${life.tension}` : ''}
        </span>
        <span className="text-[11px] shrink-0 font-semibold" style={{ color, fontFamily: 'var(--font-mono)' }}>
          {life.games} game
        </span>
      </div>
      <div className="h-1.5 rounded-full mt-1.5 relative" style={{ background: 'var(--color-surface-2)' }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, share * 100)}%`, background: color }} />
      </div>
      <p className="text-[9px] mt-1" style={{ color: 'var(--color-slate)' }}>
        {life.racketLabel} · montate {formatDays(life.days)} fa ({formatMountDate(life.mountedAt)})
        {median ? ` · la tua vita mediana è ${median} game` : ''}
      </p>
    </div>
  )
}

// ── Una riga dello storico ─────────────────────────────────

function MountRow({ life, max }) {
  const color = life.broke ? 'var(--color-loss)' : life.ended ? 'var(--color-teal-dark)' : 'var(--color-amber)'
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] flex-1 min-w-0 truncate"
              style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {life.label}{life.tension ? ` · ${life.tension}` : ''}
        </span>
        {life.broke && (
          <span className="text-[9px] shrink-0 px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--color-loss-bg)', color: 'var(--color-loss)', fontFamily: 'var(--font-mono)' }}>
            💥 rotta
          </span>
        )}
        {!life.ended && (
          <span className="text-[9px] shrink-0 px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(244,163,0,0.18)', color: 'var(--color-amber)', fontFamily: 'var(--font-mono)' }}>
            in corso
          </span>
        )}
        <span className="text-[11px] shrink-0 font-semibold" style={{ color, fontFamily: 'var(--font-mono)' }}>
          {life.games}
        </span>
      </div>
      <div className="h-1.5 rounded-full mt-1.5" style={{ background: 'var(--color-surface-2)' }}>
        <div className="h-full rounded-full"
             style={{ width: `${max > 0 ? Math.min(100, (life.games / max) * 100) : 0}%`, background: color }} />
      </div>
      <p className="text-[9px] mt-1" style={{ color: 'var(--color-slate)' }}>
        {formatMountDate(life.mountedAt)} · {formatDays(life.days)} · {life.matchCount}P/{life.trainingCount}A
        {life.sessions === 0 ? ' · nessuna sessione registrata' : ''}
        {life.orphaned > 0 ? ` · ${life.orphaned} ${life.orphaned === 1 ? 'sessione' : 'sessioni'} dopo la rottura non ${life.orphaned === 1 ? 'contata' : 'contate'}` : ''}
      </p>
    </div>
  )
}

function StringLifeInfo() {
  return (
    <>
      <InfoItem>
        Ogni volta che registri un cambio corde, l'app chiude l'incordatura precedente e conta quanti
        <strong> game</strong> hai giocato mentre era montata — partite e allenamenti insieme. Il
        risultato è la vita reale delle tue corde, misurata sul tuo gioco invece che stimata.
      </InfoItem>
      <InfoItem title="La vita mediana">
        Il valore centrale delle tue incordature concluse: metà sono durate meno, metà di più. Si usa
        la mediana e non la media perché una singola incordatura anomala — quella dimenticata sul
        telaio per sei mesi, o quella rotta al secondo allenamento — sposterebbe la media e non la
        mediana.
      </InfoItem>
      <InfoItem title="Il confronto con «il modello»">
        Il calcolo dell'usura che vedi in Equipment parte da un budget di riferimento
        di {STRING_LIFE_GAMES} game, un numero scelto a tavolino dalla letteratura sul poliestere
        (~15-25 ore di gioco). Questo blocco lo confronta con la <strong>tua</strong> vita reale: se
        i due numeri sono lontani, la percentuale di usura che l'app mostra non descrive le tue
        corde, e la costante va ritarata.
      </InfoItem>
      <InfoItem title="Perché l'app non si ricalibra da sola">
        Perché cambiare quel numero in silenzio sposterebbe all'indietro tutte le percentuali di
        usura già viste: una racchetta «al 78%» diventerebbe «al 112%» senza che sia successo niente
        in campo. Il blocco misura e propone; la modifica resta una scelta, da fare quando il numero
        misurato coincide con quello che senti giocando.
      </InfoItem>
      <InfoItem title="Game veri e game equivalenti">
        In partita un game è un game. In allenamento no: un'ora di cesto produce cinque volte i colpi
        di un'ora di partita, e un secchiello di servizi consuma le corde stando praticamente fermi.
        Ogni tipo di blocco ha una tariffa in game/ora — le stesse usate dal calcolo dell'usura — e i
        game degli allenamenti sono <strong>equivalenti</strong>, non contati.
      </InfoItem>
      <InfoItem title="«Per gioco» o «per tempo»">
        Un'incordatura può finire perché ci hai giocato abbastanza o perché sono passati mesi (il
        poliestere perde tensione anche fermo nel telaio: {STRING_LIFE_DAYS} giorni, nel modello). Se
        quasi tutte le tue finiscono per tempo, il budget in game non è ciò che ti riguarda — e in
        quel caso l'app te lo dice invece di suggerirti un numero che non useresti.
      </InfoItem>
      <InfoItem title="Le rotture">
        Una corda rotta è l'unica fine di vita <strong>oggettiva</strong>: non dipende da come la
        senti, è un fatto. Sono però rilevate solo dalla spunta «ho rotto le corde» del wizard
        allenamento — il wizard partita non la chiede — quindi una rottura in partita risulta qui
        come un normale cambio corde.
      </InfoItem>
      <InfoItem title="Quali incordature contano">
        Solo quelle concluse e con almeno una sessione registrata sotto. Un'incordatura senza
        sessioni non misura una vita corta: misura un diario incompleto, e trascinerebbe la mediana
        verso lo zero proprio nei primi mesi d'uso dell'app. Ne servono
        almeno {MIN_MOUNTS} perché la taratura compaia.
      </InfoItem>
      <InfoItem>
        La misura vale quanto il tuo diario: le sessioni che non hai registrato, o che non dichiarano
        la racchetta, non entrano nel conteggio dei game, e fanno sembrare le corde più durature di
        quanto siano.
      </InfoItem>
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────

function maxGames(lives) {
  return lives.reduce((m, l) => Math.max(m, l.games), 0)
}

function calMax(cal, timeDriven) {
  return timeDriven
    ? Math.max(cal.days.median, STRING_LIFE_DAYS) * 1.15
    : Math.max(cal.games.median, STRING_LIFE_GAMES) * 1.15
}

function verdictColor(verdict) {
  return {
    ok:            'var(--color-win)',
    high:          'var(--color-amber)',
    low:           'var(--color-amber)',
    'time-driven': 'var(--color-draw)',
  }[verdict] || 'var(--color-white)'
}

function verdictBg(verdict) {
  return {
    ok:            'var(--color-win-bg)',
    high:          'rgba(244,163,0,0.12)',
    low:           'rgba(244,163,0,0.12)',
    'time-driven': 'var(--color-draw-bg)',
  }[verdict] || 'var(--color-surface-2)'
}

function verdictTitle(verdict) {
  return {
    ok:            '✓ Il modello è tarato bene per te',
    high:          '⚠ Il budget in app è troppo alto',
    low:           '⚠ Il budget in app è troppo basso',
    'time-driven': '📆 Reincordi per tempo, non per gioco',
  }[verdict] || ''
}
