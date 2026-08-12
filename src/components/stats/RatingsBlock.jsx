import { useState } from 'react'
import { Card, Tile, NotEnough, SampleTag, Note, InfoButton, InfoItem } from './StatsUI'
import { MAX_RATING } from '../../lib/training'
import { MIN_RATINGS_TREND } from '../../lib/technique'

// Blocco 3 — il trend delle auto-valutazioni.
//
// `focusProgress` alimenta già il blocco collassabile del tab Allenamenti, ma
// quello è una fotografia di tutto lo storico messa accanto alle sessioni. Qui
// c'è la versione completa e dentro il periodo scelto: media generale, chi è
// salito, chi è sceso, e la serie voce per voce.
//
// ── La cautela non è un dettaglio, è metà del blocco ──
// Le stelline sono un giudizio che dai a te stesso a fine sessione: misurano
// anche il tuo umore, non solo il colpo. Un rovescio "sceso da 4 a 2" può essere
// un rovescio peggiorato o un'asticella alzata dopo che hai capito come andrebbe
// giocato — e la seconda è, se possibile, una notizia migliore della prima. Il
// blocco mostra il dato e dice come si legge, invece di presentarlo come una
// misura oggettiva che non è.

const PREVIEW = 5

export default function RatingsBlock({ report }) {
  const r = report.ratings
  const [showAll, setShowAll] = useState(false)
  const info = <InfoButton title="Le auto-valutazioni"><RatingsInfo /></InfoButton>

  if (!r.n) {
    return (
      <Card id="valutazioni" title="Auto-valutazioni" titleExtra={info}
            sub="Le stelline che dai ai colpi nel dettaglio della sessione">
        <NotEnough need={1} unit="valutazione"
                   what="Nessun colpo valutato nel periodo" />
        <Note>
          Le valutazioni si danno dal <strong>dettaglio di un allenamento</strong>: un tap sulle
          stelline accanto a ogni colpo del focus. È il dato che sblocca sia questo blocco sia i
          punti ciechi qui sotto.
        </Note>
      </Card>
    )
  }

  const single = r.voci - r.withTrend.length
  const visible = showAll ? r.withTrend : r.withTrend.slice(0, PREVIEW)

  return (
    <Card id="valutazioni" title="Auto-valutazioni" titleExtra={info}
          sub="Come ti sei visto, colpo per colpo"
          right={<SampleTag n={r.n} unit="voti" />}>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-4xl font-bold leading-none"
             style={{ color: avgColor(r.avg), fontFamily: 'var(--font-display)' }}>
            {r.avg.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            <span className="text-lg" style={{ color: 'var(--color-slate)' }}>/{MAX_RATING}</span>
          </p>
          <p className="text-[10px] uppercase tracking-wide mt-1.5" style={{ color: 'var(--color-slate)' }}>
            Media di tutti i voti del periodo
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <Tile label="Voci valutate" value={String(r.voci)} sub={`su ${report.usage.distinct} lavorate`} />
        <Tile label="Con un trend" value={String(r.withTrend.length)}
              sub={`≥${MIN_RATINGS_TREND} voti`} color="var(--color-teal)" />
        <Tile label="Voto singolo" value={String(single)} sub="fotografie" />
      </div>

      {(r.best || r.worst) && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Highlight kind="best" row={r.best} />
          <Highlight kind="worst" row={r.worst} />
        </div>
      )}

      {r.withTrend.length > 0 ? (
        <div className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
          <p className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--color-slate)' }}>
            Serie per colpo · dal più valutato di recente
          </p>
          {visible.map(row => <TrendRow key={row.id} row={row} />)}

          {r.withTrend.length > PREVIEW && (
            <button onClick={() => setShowAll(s => !s)}
                    className="w-full py-2 rounded-xl text-xs font-semibold"
                    style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
              {showAll ? 'Mostra meno' : `Mostra tutti (${r.withTrend.length})`}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <NotEnough need={MIN_RATINGS_TREND} unit="voti sullo stesso colpo"
                     what="Per una serie servono" />
        </div>
      )}

      <Note>
        Questi numeri sono un <strong>giudizio che dai a te stesso</strong>, non una misura: dicono
        anche com'era la giornata, non solo com'era il colpo. Un voto sceso può essere un colpo
        peggiorato o un'asticella alzata — vale la pena guardarli come una serie, mai come un voto
        singolo. Seguono il periodo selezionato in pagina, quindi su «90 giorni» le serie sono più
        corte.
      </Note>
    </Card>
  )
}

// ── Componenti interni ─────────────────────────────────────

function Highlight({ kind, row }) {
  const best = kind === 'best'
  const color = best ? 'var(--color-win)' : 'var(--color-loss)'
  return (
    <div className="rounded-xl px-3 py-2.5 min-w-0" style={{ background: 'var(--color-surface-2)' }}>
      <p className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--color-slate)' }}>
        {best ? 'Più migliorato' : 'Più peggiorato'}
      </p>
      {row ? (
        <>
          <p className="text-xs font-semibold truncate mt-1"
             style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            {row.label}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color, fontFamily: 'var(--font-mono)' }}>
            {row.delta > 0 ? '▲' : '▼'} {row.first} → {row.last} su {MAX_RATING}
          </p>
        </>
      ) : (
        <p className="text-xs mt-1.5" style={{ color: 'var(--color-slate)' }}>
          {best ? 'Nessuna voce in salita' : 'Nessuna voce in calo'}
        </p>
      )}
    </div>
  )
}

function TrendRow({ row }) {
  const trend = deltaMeta(row.delta)
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--color-surface-2)' }}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-semibold truncate min-w-0"
              style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {row.categoryIcon} {row.label}
        </span>
        <span className="text-[11px] font-bold shrink-0" style={{ color: trend.color, fontFamily: 'var(--font-mono)' }}>
          {trend.arrow} {trend.text}
        </span>
      </div>

      <Sparkline series={row.series} />

      <p className="text-[9px] mt-1" style={{ color: 'var(--color-slate)' }}>
        Da {row.first} a {row.last} su {MAX_RATING} · {row.n} valutazioni · media{' '}
        <span style={{ fontFamily: 'var(--font-mono)' }}>
          {row.avg.toLocaleString('it-IT', { maximumFractionDigits: 1 })}
        </span>
      </p>
    </div>
  )
}

// Barre e non linee, per lo stesso motivo del blocco Progressi nel tab
// Allenamenti: la serie è corta e discreta su una scala piccola, e una linea
// suggerirebbe un'interpolazione tra due allenamenti che non esiste.
function Sparkline({ series }) {
  return (
    <div className="flex items-end gap-1 h-7">
      {series.map((p, i) => (
        <div key={`${p.date}-${i}`} className="flex-1 rounded-sm"
             title={`${new Date(p.day).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}: ${p.value}/${MAX_RATING}`}
             style={{
               height: `${(p.value / MAX_RATING) * 100}%`,
               minHeight: 3,
               background: i === series.length - 1 ? 'var(--color-amber)' : 'var(--color-teal-dark)',
             }} />
      ))}
    </div>
  )
}

function RatingsInfo() {
  return (
    <>
      <InfoItem>
        Le stelline che dai a ogni colpo del focus, dal dettaglio di un allenamento (un tap, 1-5).
        Questo blocco le mette in fila nel tempo e risponde a «sto migliorando?» invece che solo a
        «quanto mi sono allenato?».
      </InfoItem>
      <InfoItem title="La media grande">
        La media di tutti i voti che hai dato nel periodo, su tutte le voci. Non è un voto al tuo
        tennis: è il livello a cui ti stai giudicando. Se sale mentre alleni le stesse cose, di
        solito è un buon segno; se è alta e piatta, forse stai valutando col pilota automatico.
      </InfoItem>
      <InfoItem title="Voci valutate / Con un trend / Voto singolo">
        <strong>Voci valutate</strong>: quante voci distinte hanno almeno un voto, sulle voci che
        hai lavorato. <strong>Con un trend</strong>: quelle con almeno {MIN_RATINGS_TREND} voti, le
        uniche per cui ha senso parlare di direzione. <strong>Voto singolo</strong>: quelle con un
        voto solo — sono fotografie, non progressioni, e vanno lette come tali.
      </InfoItem>
      <InfoItem title="Più migliorato / Più peggiorato">
        La voce con la differenza più grande tra il primo e l'ultimo voto del periodo, nelle due
        direzioni. Si guarda il primo e l'ultimo, non la media: è la <em>direzione</em> che
        interessa. Con pochi voti basta una giornata storta per capovolgere il segno, ed è il motivo
        per cui sotto trovi tutta la serie e non solo la freccia.
      </InfoItem>
      <InfoItem title="Le serie a barre">
        Una barra per valutazione, in ordine di tempo; l'ultima è ambra. Sono barre e non una linea
        di proposito: tra un allenamento e il successivo non c'è nessuna progressione continua da
        disegnare, ci sono due giudizi in due giorni diversi.
      </InfoItem>
      <InfoItem title="Il limite, detto chiaramente">
        È un'<strong>auto-valutazione</strong>. Misura il colpo e insieme come ti sei sentito quel
        giorno, e nessuno filma i propri allenamenti per verificarla. Un calo può voler dire che il
        colpo è peggiorato oppure che hai capito meglio come andrebbe giocato e ti giudichi più
        severamente — la seconda è una notizia migliore della prima, ma i numeri da soli non
        possono distinguerle.
      </InfoItem>
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────

function avgColor(avg) {
  if (avg == null) return 'var(--color-white)'
  if (avg >= 3.8) return 'var(--color-win)'
  if (avg >= 2.8) return 'var(--color-teal)'
  return 'var(--color-amber)'
}

function deltaMeta(delta) {
  if (delta > 0) return { arrow: '▲', text: `+${delta}`, color: 'var(--color-win)' }
  if (delta < 0) return { arrow: '▼', text: String(delta), color: 'var(--color-loss)' }
  return { arrow: '=', text: 'stabile', color: 'var(--color-slate)' }
}
