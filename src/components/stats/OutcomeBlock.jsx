import { Card, NotEnough, SampleTag, Note, InfoButton, InfoItem } from './StatsUI'
import { MIN_OUTCOME, formatDelta } from '../../lib/physical'

// Blocco 5 — Fisico ↔ risultato.
//
// Le partite che vinci e quelle che perdi sono fisicamente diverse, e la
// differenza è quasi sempre più grande di quanto chiunque si aspetti. La riga
// che conta è la durata: «le partite che perdi durano in media 22 minuti in
// più» è una frase che cambia come ti prepari, non una curiosità da salotto.
//
// ── Perché "minuti per game" sta accanto a "durata" ──
// Una sconfitta dura di più anche solo perché va al terzo set: sono più game,
// non punti più lunghi. Il minuti-per-game separa le due spiegazioni, ed è
// l'unico modo di non leggere come "fatica" quella che è solo aritmetica del
// punteggio.
//
// ── Perché la durata qui non è mai stimata ──
// In Attività la durata di un match si stima dai game quando manca (5 min a
// game). Qui sarebbe circolare: la stima cresce con i game, e le sconfitte hanno
// più game per costruzione — «le partite che perdi durano di più» uscirebbe da
// sola anche da chi perde sempre 6-4 6-4 in cinquanta minuti. Si usano solo le
// durate davvero trascritte.

export default function OutcomeBlock({ report }) {
  const o = report.outcome
  const info = <InfoButton title="Fisico e risultato"><OutcomeInfo /></InfoButton>

  if (!o.enough) {
    return (
      <Card id="esito-fisico" title="Fisico e risultato" titleExtra={info}
            sub="Come sono fatte le partite che vinci e quelle che perdi">
        <NotEnough
          need={Math.max(o.missingWins, o.missingLosses, 1)}
          unit={o.missingLosses >= o.missingWins ? 'sconfitte con dati atletici' : 'vittorie con dati atletici'}
          what="Per confrontare vittorie e sconfitte" />
        <Note>
          Servono almeno {MIN_OUTCOME} partite per lato con lo stesso campo compilato: oggi hai
          dati atletici su {o.wins} {o.wins === 1 ? 'vittoria' : 'vittorie'} e {o.losses}{' '}
          {o.losses === 1 ? 'sconfitta' : 'sconfitte'}. I pareggi restano sempre fuori: sono match
          interrotti, e la loro durata è arbitraria per definizione.
        </Note>
      </Card>
    )
  }

  const rows = o.rows.filter(r => r.enough)

  return (
    <Card id="esito-fisico" title="Fisico e risultato" titleExtra={info}
          sub="Come sono fatte le partite che vinci e quelle che perdi"
          right={<SampleTag n={o.maxN} unit="per lato" />}>

      <div className="space-y-4">
        {rows.map(r => <OutcomeRow key={r.id} row={r} />)}
      </div>

      {o.rows.some(r => !r.enough) && (
        <p className="text-[9px] mt-4" style={{ color: 'var(--color-slate)' }}>
          Non mostrate ({o.rows.filter(r => !r.enough).map(r => r.label.toLowerCase()).join(', ')}):
          {' '}meno di {MIN_OUTCOME} partite per lato hanno quel campo compilato.
        </p>
      )}

      <Note>
        Ogni riga ha il <strong>proprio campione</strong>, perché ogni campo è facoltativo per conto
        suo: la durata può esserci su otto partite e la distanza su quattro. Il numero a destra è
        sempre <em>sconfitte meno vittorie</em>, così un segno «+» significa «di più quando perdi»
        su tutte le righe. È una fotografia, non una causa: partite più lunghe possono averti fatto
        perdere, oppure essere il modo in cui perdi.
      </Note>
    </Card>
  )
}

// Una riga = una metrica. Due barre invece di due numeri soli: la differenza tra
// 78 e 100 minuti si legge molto più in fretta come due lunghezze che come due
// cifre, e la barra rende evidente quando il delta è enorme in proporzione.
function OutcomeRow({ row }) {
  const max = Math.max(row.win.value, row.loss.value, 0.0001)

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-[11px] flex-1 min-w-0 truncate"
              style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {row.label}
        </span>
        <span className="text-[9px] shrink-0" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          {row.win.n}V · {row.loss.n}S
        </span>
        <span className="text-[11px] shrink-0 font-semibold"
              style={{ color: deltaColor(row), fontFamily: 'var(--font-mono)' }}>
          {formatDelta(row.delta, row.digits)}{row.unit ? ` ${row.unit}` : ''}
        </span>
      </div>

      <SideRow tag="V" value={row.win.value} rate={row.win.value / max}
               color="var(--color-win)" unit={row.unit} digits={row.digits} />
      <SideRow tag="S" value={row.loss.value} rate={row.loss.value / max}
               color="var(--color-loss)" unit={row.unit} digits={row.digits} className="mt-1" />
    </div>
  )
}

function SideRow({ tag, value, rate, color, unit, digits, className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-[9px] w-3 shrink-0 font-semibold"
            style={{ color, fontFamily: 'var(--font-display)' }}>
        {tag}
      </span>
      <span className="flex-1 h-1.5 rounded-full min-w-0" style={{ background: 'var(--color-surface-2)' }}>
        <span className="block h-full rounded-full"
              style={{ width: `${Math.max(0, Math.min(1, rate)) * 100}%`, background: color }} />
      </span>
      <span className="text-[10px] shrink-0 w-16 text-right"
            style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
        {value == null ? '—' : value.toLocaleString('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits })}
        {unit ? ` ${unit}` : ''}
      </span>
    </div>
  )
}

function OutcomeInfo() {
  return (
    <>
      <InfoItem>
        Le stesse misure atletiche, separate tra le partite che hai <strong>vinto</strong> e quelle
        che hai <strong>perso</strong>. È il blocco che collega il fisico al risultato: dice come
        sono fatte, fisicamente, le sconfitte.
      </InfoItem>
      <InfoItem title="Come si legge">
        Per ogni riga ci sono due barre — V verde per le vittorie, S rossa per le sconfitte — in
        scala sul valore più alto dei due. Il numero a destra del titolo è sempre
        <strong> sconfitte meno vittorie</strong>: un «+22 min» significa che le partite che perdi
        durano in media 22 minuti in più. Il verso è lo stesso su tutte le righe, così non devi
        ricordarti da che parte si legge.
      </InfoItem>
      <InfoItem title="Durata e minuti per game">
        Sono due domande diverse. Una sconfitta dura di più anche solo perché va al terzo set: sono
        più game, non punti più lunghi. Se cresce solo la <strong>durata</strong> ma non i
        <strong> minuti per game</strong>, le tue sconfitte sono semplicemente partite più lunghe.
        Se crescono entrambi, gli scambi stessi sono più lunghi: stai giocando punti più duri, o
        rallentando il ritmo per reggere.
      </InfoItem>
      <InfoItem title="FC media, distanza, velocità">
        Quanto ti è costato fisicamente. Una FC più alta nelle sconfitte è comune e non significa
        automaticamente «più fatica»: può essere tensione. Una distanza molto maggiore nelle
        sconfitte è il segno classico del giocatore che nelle partite in cui perde subisce il gioco
        ed è costretto a correre dietro all'avversario invece di comandare lo scambio.
      </InfoItem>
      <InfoItem title="Perché ogni riga ha il suo «V · S»">
        Perché ogni campo atletico è facoltativo per conto suo: puoi avere la durata su otto partite
        e la distanza su quattro. Ogni riga compare solo se ha almeno {MIN_OUTCOME} partite per
        lato con quel campo compilato, e mostra su quante è calcolata.
      </InfoItem>
      <InfoItem title="Perché la durata non è mai stimata">
        Altrove nell'app, quando la durata di una partita manca, viene stimata dai game giocati (5
        minuti a game). Qui no, e la ragione è importante: quella stima cresce con i game, e le
        sconfitte hanno più game per costruzione. Usandola, «le partite che perdi durano di più»
        salterebbe fuori anche da un giocatore che perde sempre 6-4 6-4 in cinquanta minuti. Qui
        contano solo le durate che hai davvero trascritto.
      </InfoItem>
      <InfoItem>
        Ultimo avvertimento, il più importante: questa è una <strong>correlazione</strong>. Che le
        partite perse durino di più non dice se hai perso perché erano lunghe o se erano lunghe
        perché stavi perdendo. Dice solo come sono fatte, ed è comunque un'informazione che nessuna
        altra parte dell'app può darti. I pareggi restano fuori: sono match interrotti, e la loro
        durata è arbitraria.
      </InfoItem>
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────

// Il delta qui non ha un verso "buono" universale: una FC più alta nelle
// sconfitte può essere fatica o tensione, e una distanza maggiore può essere
// difesa o aggressività. Si evidenzia quindi solo la MAGNITUDINE, e in
// proporzione al valore delle vittorie — 10 minuti su 90 sono un dettaglio, 10
// minuti su 40 sono un'altra partita — invece di suggerire un giudizio che i
// dati non contengono.
function deltaColor(row) {
  if (row.delta == null || row.share == null) return 'var(--color-white)'
  return Math.abs(row.share) >= 0.1 ? 'var(--color-amber)' : 'var(--color-slate)'
}
