import { useState } from 'react'
import { Card, NotEnough, Note, InfoButton, InfoItem } from './StatsUI'
import { MAX_RATING } from '../../lib/training'
import { QUADRANTS, RATING_MID, MIN_BLIND_POINTS, formatDaysAgo } from '../../lib/technique'

// Blocco 4 — i punti ciechi. Il 2×2 tra quanto ti valuti su un colpo e quanto
// quel colpo compare nei tuoi allenamenti.
//
// È l'unica vista della pagina che incrocia un GIUDIZIO con un COMPORTAMENTO
// invece di mostrarli separati, ed è per questo che il quadrante in basso a
// sinistra vale da solo l'intera sezione: è l'elenco delle cose che sai di fare
// male e a cui non dedichi tempo. Nessuno se lo dice da solo, perché le due metà
// della frase vivono in due momenti diversi — il giudizio a fine sessione, la
// scelta del focus all'inizio della successiva.
//
// ── Le due soglie ──
// Verticale: la MEDIANA delle sessioni per voce, con un pavimento a 2. Adattiva
// di proposito — "poco lavorato" ha senso solo rispetto a quanto lavori il
// resto, e una media si farebbe trascinare in alto dalla voce che alleni sempre.
// Orizzontale: il centro della scala (3 su 5), che è oggettivo e non si muove
// con i dati.
//
// ── Perché basta una valutazione per comparire ──
// Il resto della pagina non mostra mai una media sotto soglia di campione. Qui
// la stessa regola si rovescerebbe contro sé stessa: pretendere due voti
// escluderebbe per costruzione le voci a volume basso, cioè esattamente quelle
// che il quadrante deve trovare. Entrano tutte, e quelle con un voto solo sono
// marcate — un'impressione, non una media.

const PAD = 9   // margine percentuale dell'area di disegno, per non tagliare i punti

export default function BlindSpotBlock({ report }) {
  const b = report.blind
  const [showOthers, setShowOthers] = useState(false)
  const info = <InfoButton title="Cosa sono i punti ciechi"><BlindInfo /></InfoButton>

  if (!b.enough) {
    return (
      <Card id="punti-ciechi" title="Punti ciechi" titleExtra={info}
            sub="Valutazione bassa × lavoro scarso">
        <NotEnough need={b.missing} unit="voci valutate"
                   what={`Per incrociare giudizio e volume servono ${MIN_BLIND_POINTS} voci`} />
        <Note>
          Le valutazioni si danno dal dettaglio di un allenamento, con un tap sulle stelline accanto
          a ogni colpo del focus. Senza quelle, questo grafico non ha l'asse verticale.
        </Note>
      </Card>
    )
  }

  const others = [...b.work, ...b.idle, ...b.strong]

  return (
    <Card id="punti-ciechi" title="Punti ciechi" titleExtra={info}
          sub="Valutazione bassa × lavoro scarso">

      <Scatter b={b} />

      <div className="grid grid-cols-2 gap-2 mt-3">
        {['blind', 'work', 'idle', 'strong'].map(id => {
          const q = QUADRANTS[id]
          return (
            <div key={id} className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: q.color }} />
              <span className="text-[9px] truncate" style={{ color: 'var(--color-slate)' }}>
                {q.label}{' '}
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-white)' }}>
                  {b[id].length}
                </span>
              </span>
            </div>
          )
        })}
      </div>

      {/* Il quadrante che dà il nome al blocco: elenco per esteso, non un
          conteggio. È l'unica lista della pagina che vale come lista di cose da
          fare la prossima volta che apri il wizard. */}
      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
        <p className="text-[9px] uppercase tracking-wide mb-2" style={{ color: 'var(--color-slate)' }}>
          {QUADRANTS.blind.icon} {QUADRANTS.blind.label} · {QUADRANTS.blind.hint}
        </p>

        {b.blind.length === 0 ? (
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-white)' }}>
            Nessuno: tutte le voci che ti valuti sotto {RATING_MID} su {MAX_RATING} le stai anche
            allenando. È il risultato migliore che questo grafico possa dare.
          </p>
        ) : (
          <div className="space-y-2">
            {b.blind.map((p, i) => <PointRow key={p.id} point={p} report={report} index={i + 1} />)}
          </div>
        )}
      </div>

      {others.length > 0 && (
        <>
          <button onClick={() => setShowOthers(s => !s)}
                  className="w-full mt-3 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
            {showOthers ? 'Nascondi le altre voci' : `Mostra le altre ${others.length} voci`}
          </button>

          {showOthers && (
            <div className="mt-3 space-y-3">
              {['work', 'idle', 'strong'].map(id => (
                b[id].length > 0 && (
                  <div key={id}>
                    <p className="text-[9px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--color-slate)' }}>
                      {QUADRANTS[id].icon} {QUADRANTS[id].label} · {QUADRANTS[id].hint}
                    </p>
                    <div className="space-y-1.5">
                      {b[id].map(p => <PointRow key={p.id} point={p} report={report} compact />)}
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </>
      )}

      <Note>
        La linea verticale è la <strong>mediana</strong> delle sessioni per voce
        ({fmt(b.volumeMid)}): metà delle voci che valuti stanno a sinistra. La linea orizzontale è
        il centro della scala ({RATING_MID} su {MAX_RATING}). Il volume è in sessioni, non in
        minuti, per il motivo di sempre: il focus è della sessione e non del blocco.
      </Note>
    </Card>
  )
}

// ── Componenti interni ─────────────────────────────────────

// Diagramma a dispersione: una voce = un punto. I punti ciechi portano un
// NUMERO, non il nome: due voci vicine con l'etichetta per esteso si
// sovrappongono in un blocco illeggibile in un quadrato di 280px, mentre una
// cifra regge la vicinanza e rimanda alla lista numerata qui sotto.
function Scatter({ b }) {
  const x = v => PAD + (v / b.maxVolume) * (100 - 2 * PAD)
  const y = r => PAD + (1 - (r - 1) / (MAX_RATING - 1)) * (100 - 2 * PAD)

  const midX = x(b.volumeMid)
  const midY = y(b.ratingMid)

  // I punti ciechi portano il numero DENTRO il cerchio invece che accanto: due
  // voci con la stessa valutazione e volume simile sono a pochi pixel l'una
  // dall'altra, e un'etichetta appesa di fianco finirebbe sopra il vicino.
  const numbers = new Map(b.blind.map((p, i) => [p.id, i + 1]))

  // Volume e valutazione sono quasi sempre interi, quindi due voci finiscono
  // spesso nello stesso identico pixel e una sparisce sotto l'altra. Le voci che
  // condividono le coordinate vengono distanziate in orizzontale di qualche
  // pixel: la posizione resta leggibile a occhio e nessun punto scompare.
  const spread = new Map()
  const groups = new Map()
  b.points.forEach(p => {
    const key = `${p.volume}|${p.rating}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(p)
  })
  groups.forEach(list => list.forEach((p, i) => {
    spread.set(p.id, (i - (list.length - 1) / 2) * 12)
  }))

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 280 }}>
      <div className="relative w-full rounded-xl overflow-hidden"
           style={{ aspectRatio: '1 / 1', background: 'var(--color-surface-2)' }}>

        {/* Il quadrante dei punti ciechi è l'unico con uno sfondo: colorarli
            tutti e quattro trasformerebbe il grafico in una bandiera e i punti
            sparirebbero dentro le tinte. */}
        <div className="absolute" style={{
          left: 0, width: `${midX}%`, top: `${midY}%`, bottom: 0,
          background: 'var(--color-loss)', opacity: 0.1,
        }} />

        <div className="absolute top-0 bottom-0 w-px" style={{ left: `${midX}%`, background: 'var(--color-slate)', opacity: 0.45 }} />
        <div className="absolute left-0 right-0 h-px" style={{ top: `${midY}%`, background: 'var(--color-slate)', opacity: 0.45 }} />

        {/* Le quattro etichette d'angolo: senza, il grafico va decifrato ogni
            volta guardando la legenda. */}
        <Corner style={{ left: 4, top: 4 }}   text={QUADRANTS.idle.label} />
        <Corner style={{ right: 4, top: 4 }}  text={QUADRANTS.strong.label} align="right" />
        <Corner style={{ left: 4, bottom: 4 }} text={QUADRANTS.blind.label} color={QUADRANTS.blind.color} />
        <Corner style={{ right: 4, bottom: 4 }} text={QUADRANTS.work.label} align="right" />

        {b.points.map(p => {
          const q = QUADRANTS[p.quadrant]
          const number = numbers.get(p.id)
          const size = number ? 14 : 9
          return (
            <span key={p.id}
                  title={`${p.label}: ${p.rating.toLocaleString('it-IT', { maximumFractionDigits: 1 })}/${MAX_RATING} su ${p.ratingCount} ${p.ratingCount === 1 ? 'voto' : 'voti'}, ${p.volume} ${p.volume === 1 ? 'sessione' : 'sessioni'}`}
                  className="absolute rounded-full flex items-center justify-center"
                  style={{
                    left: `${x(p.volume)}%`, top: `${y(p.rating)}%`,
                    width: size, height: size,
                    transform: `translate(calc(-50% + ${spread.get(p.id) || 0}px), -50%)`,
                    background: p.single ? 'transparent' : q.color,
                    border: `1.5px solid ${q.color}`,
                    boxShadow: '0 0 0 1.5px var(--color-surface-2)',
                    fontSize: 8, lineHeight: 1, fontFamily: 'var(--font-mono)',
                    color: p.single ? q.color : 'var(--color-bg)',
                  }}>
              {number || ''}
            </span>
          )
        })}
      </div>

      <div className="flex justify-between mt-1">
        <span className="text-[8px]" style={{ color: 'var(--color-slate)' }}>← lo alleni poco</span>
        <span className="text-[8px]" style={{ color: 'var(--color-slate)' }}>lo alleni molto →</span>
      </div>
      <p className="text-[8px] text-center mt-0.5" style={{ color: 'var(--color-slate)' }}>
        in verticale: quanto te lo valuti (1 in basso, {MAX_RATING} in alto)
      </p>
    </div>
  )
}

function Corner({ style, text, align = 'left', color = 'var(--color-slate)' }) {
  return (
    <span className="absolute text-[7px] uppercase tracking-wide"
          style={{ ...style, color, textAlign: align, opacity: 0.9 }}>
      {text}
    </span>
  )
}

function PointRow({ point, report, compact, index }) {
  const q = QUADRANTS[point.quadrant]
  const days = report.usage.rows.find(r => r.id === point.id)?.days ?? null

  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2 min-w-0"
         style={{ background: 'var(--color-surface-2)' }}>
      {index ? (
        <span className="text-[9px] font-bold shrink-0 w-2 text-center"
              style={{ color: q.color, fontFamily: 'var(--font-mono)' }}>
          {index}
        </span>
      ) : (
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: q.color }} />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold truncate"
           style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {point.label}
        </p>
        {!compact && (
          <p className="text-[9px] mt-0.5" style={{ color: 'var(--color-slate)' }}>
            {point.categoryLabel} · ultima volta {formatDaysAgo(days)}
            {point.single && ' · un solo voto'}
          </p>
        )}
      </div>
      <span className="text-[11px] shrink-0 font-semibold whitespace-nowrap"
            style={{ color: q.color, fontFamily: 'var(--font-mono)' }}>
        {point.rating.toLocaleString('it-IT', { maximumFractionDigits: 1 })}★
      </span>
      <span className="text-[10px] shrink-0 w-12 text-right whitespace-nowrap"
            style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
        {point.volume} sess.
      </span>
    </div>
  )
}

function BlindInfo() {
  return (
    <>
      <InfoItem>
        Un grafico a due assi che incrocia le due cose che l'app sa di ogni colpo:
        <strong> quanto te lo valuti</strong> (in verticale, dalle stelline) e
        <strong> quanto lo alleni</strong> (in orizzontale, in quante sessioni compare nel focus).
        Ogni punto è una voce del diario.
      </InfoItem>
      <InfoItem title="I quattro quadranti">
        <strong>In basso a sinistra — punti ciechi</strong>: li valuti male e non li alleni. È il
        quadrante per cui esiste tutto il blocco.
        <strong> In basso a destra — in lavorazione</strong>: li valuti male ma ci stai lavorando,
        che è esattamente quello che si deve fare.
        <strong> In alto a sinistra — in sospeso</strong>: vanno bene e non li tocchi; di solito va
        benissimo così, ma se ci restano per mesi vale la pena guardare da quanto.
        <strong> In alto a destra — punti forti</strong>: vanno bene e li coltivi.
      </InfoItem>
      <InfoItem title="Dove passano le due linee">
        L'orizzontale è il centro della scala delle stelline ({RATING_MID} su {MAX_RATING}): sotto
        c'è quello che giudichi insufficiente. La verticale è la <em>mediana</em> delle sessioni per
        voce, cioè il punto che lascia metà delle tue voci a sinistra: «poco lavorato» ha senso solo
        rispetto a quanto lavori il resto, non in assoluto. Sotto le due sessioni la soglia non
        scende, altrimenti con tutte le voci a una sessione il quadrante risulterebbe vuoto proprio
        quando è tutto da riempire.
      </InfoItem>
      <InfoItem title="I punti vuoti">
        Un cerchio non pieno è una voce con <strong>una sola valutazione</strong>: è un'impressione
        di una giornata, non una media. Compaiono lo stesso di proposito — chiedere due voti per
        entrare escluderebbe proprio le voci che alleni poco, cioè quelle che questo grafico deve
        trovare — ma vanno prese con più cautela delle altre.
      </InfoItem>
      <InfoItem title="Come si usa">
        I punti del quadrante in basso a sinistra sono numerati, e i numeri sono quelli della lista
        sotto il grafico: quella lista è la risposta alla domanda «cosa metto nel focus del prossimo
        allenamento?». Non è un obbligo: un colpo può stare lì perché hai deciso consapevolmente che
        non è la priorità di questa stagione. Ma se ci sta senza che tu te ne fossi accorto, è
        esattamente il punto cieco che dà il nome al blocco.
      </InfoItem>
      <InfoItem>
        Vale la stessa cautela delle auto-valutazioni: l'asse verticale è un tuo giudizio, non una
        misura. E il volume è in sessioni, non in minuti, perché il focus è della sessione e non del
        singolo blocco.
      </InfoItem>
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────

function fmt(v) {
  return v == null ? '—' : v.toLocaleString('it-IT', { maximumFractionDigits: 1 })
}
