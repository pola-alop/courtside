import { useState } from 'react'
import { Card, Tile, Note, InfoButton, InfoItem } from './StatsUI'
import { NEGLECT_WARN, NEGLECT_BAD, TOTAL_FOCUS } from '../../lib/technique'

// Blocco 5 — trascuratezza, e blocco 6 — copertura.
//
// Due domande vicine ma diverse: "cosa ho SMESSO di allenare" (e da quanto) e
// "cosa non ho MAI allenato". La prima è una lista di rientri possibili, la
// seconda è la mappa dei pezzi di tennis che non sono mai passati per un
// allenamento registrato.
//
// ── Perché entrambe ignorano il periodo ──
// "Non lavori il servizio da 47 giorni" è un fatto del presente: dentro una
// finestra di 90 giorni il conteggio sarebbe tagliato dal bordo del periodo
// invece che dalla realtà, e cambierebbe numero a ogni cambio di periodo per lo
// stesso identico fatto. Stessa logica di ACWR e striscia attiva in Attività, e
// degli alert di usura in Panoramica.

const PREVIEW = 6

export default function NeglectBlock({ report }) {
  return (
    <>
      <NeglectCard report={report} />
      <CoverageCard report={report} />
    </>
  )
}

// ── Trascuratezza ──────────────────────────────────────────

function NeglectCard({ report }) {
  const n = report.neglect
  const [showAll, setShowAll] = useState(false)
  const info = <InfoButton title="Cos'è la trascuratezza"><NeglectInfo /></InfoButton>

  if (!n.rows.length) return null

  const late = n.rows.filter(r => r.days >= NEGLECT_WARN)
  const visible = showAll ? n.rows : n.rows.slice(0, PREVIEW)

  return (
    <Card id="trascuratezza" title="Da quanto non lo tocchi" titleExtra={info}
          sub="Le voci che hai lavorato almeno una volta, dalla più ferma">

      <div className="grid grid-cols-3 gap-2 mb-4">
        <Tile label="Ferme da 30+ gg" value={String(late.length)}
              color={late.length ? 'var(--color-amber)' : 'var(--color-white)'} sub={`su ${n.touched}`} />
        <Tile label="La più ferma" value={n.rows[0] ? String(n.rows[0].days) : '—'} sub="giorni" />
        <Tile label="Recenti" value={String(n.rows.filter(r => r.days < NEGLECT_WARN).length)}
              color="var(--color-teal)" sub={`< ${NEGLECT_WARN} giorni`} />
      </div>

      <div className="space-y-1.5">
        {visible.map(row => <NeglectRow key={row.id} row={row} />)}
      </div>

      {n.rows.length > PREVIEW && (
        <button onClick={() => setShowAll(s => !s)}
                className="w-full mt-3 py-2 rounded-xl text-xs font-semibold"
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          {showAll ? 'Mostra meno' : `Mostra tutte (${n.rows.length})`}
        </button>
      )}

      <Note>
        Il conteggio è su <strong>tutto lo storico rispetto a oggi</strong>, non sul periodo
        selezionato: «da quanto non lo tocchi» è un fatto del presente, e ricalcolarlo dentro una
        finestra di 90 giorni lo taglierebbe al bordo del periodo invece che alla realtà. Una voce
        lavorata una volta sola e da molto tempo non è un colpo che hai abbandonato: è un colpo che
        non hai mai davvero allenato, e conta di più il numero di sessioni accanto alla data.
      </Note>
    </Card>
  )
}

function NeglectRow({ row }) {
  const color = row.days >= NEGLECT_BAD ? 'var(--color-loss)'
    : row.days >= NEGLECT_WARN ? 'var(--color-amber)'
    : 'var(--color-slate)'

  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2 min-w-0"
         style={{ background: 'var(--color-surface-2)' }}>
      <span className="text-[11px] shrink-0">{row.categoryIcon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold truncate"
           style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {row.label}
        </p>
        <p className="text-[9px]" style={{ color: 'var(--color-slate)' }}>
          {row.n} {row.n === 1 ? 'sessione' : 'sessioni'} in tutto
          {row.rating != null && ` · ${row.rating.toLocaleString('it-IT', { maximumFractionDigits: 1 })}★`}
        </p>
      </div>
      <span className="text-[11px] shrink-0 font-semibold" style={{ color, fontFamily: 'var(--font-mono)' }}>
        {row.days === 0 ? 'oggi' : `${row.days} gg`}
      </span>
    </div>
  )
}

function NeglectInfo() {
  return (
    <>
      <InfoItem>
        L'elenco delle voci che hai lavorato almeno una volta, ordinate da quella che non tocchi da
        più tempo. È la risposta alla frase che nessuno si dice da solo: «non lavoro il servizio da
        47 giorni».
      </InfoItem>
      <InfoItem title="Come si legge il numero a destra">
        Sono i giorni passati dall'ultimo allenamento in cui quella voce era nel focus. Sotto i 30
        giorni resta grigio (è lavoro normale), da 30 diventa ambra, da {NEGLECT_BAD} rosso. Non
        sono soglie fisiologiche: sono la scala su cui ci si accorge di aver perso di vista un
        colpo, più o meno tre o quattro sessioni saltate.
      </InfoItem>
      <InfoItem title="Le sessioni accanto alla data">
        Contano quanto la data. Una voce con <em>una</em> sessione sei mesi fa non è un colpo che
        hai abbandonato, è un colpo che non hai mai davvero allenato — e infatti gli insight in
        cima alla pagina segnalano solo le voci che facevano parte del lavoro abituale, cioè con
        almeno due sessioni alle spalle.
      </InfoItem>
      <InfoItem title="Perché non segue il periodo">
        Perché è un fatto di adesso. Se il conteggio fosse ritagliato sui 90 giorni, un colpo fermo
        da otto mesi risulterebbe fermo da 90 giorni, e lo stesso colpo cambierebbe numero solo
        cambiando il periodo in cima alla pagina. Stessa scelta della striscia attiva e dell'ACWR
        nella sezione Attività.
      </InfoItem>
      <InfoItem>
        Non è una lista di compiti: ci sono voci che è giusto non allenare per mesi. Serve a
        distinguere il «non lo faccio perché ho deciso così» dal «non lo faccio e non me n'ero
        accorto».
      </InfoItem>
    </>
  )
}

// ── Copertura ──────────────────────────────────────────────

function CoverageCard({ report }) {
  const c = report.coverage
  const [showMissing, setShowMissing] = useState(false)
  const info = <InfoButton title="Cos'è la copertura"><CoverageInfo /></InfoButton>

  const missingTotal = c.total - c.touched

  return (
    <Card id="copertura" title="Copertura del diario" titleExtra={info}
          sub={`Quante delle ${TOTAL_FOCUS} voci hai mai toccato`}>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-4xl font-bold leading-none"
             style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
            {c.touched}<span className="text-lg" style={{ color: 'var(--color-slate)' }}>/{c.total}</span>
          </p>
          <p className="text-[10px] uppercase tracking-wide mt-1.5" style={{ color: 'var(--color-slate)' }}>
            Voci entrate almeno una volta in un allenamento
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold leading-none"
             style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            {c.inPeriod}
          </p>
          <p className="text-[10px] uppercase tracking-wide mt-1" style={{ color: 'var(--color-slate)' }}>
            Nel periodo
          </p>
        </div>
      </div>

      <div className="space-y-2 mt-4">
        {c.byCategory.map(cat => (
          <div key={cat.id}>
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] shrink-0">{cat.icon}</span>
              <span className="text-[11px] flex-1 min-w-0 truncate"
                    style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                {cat.label}
              </span>
              <span className="text-[11px] shrink-0 font-semibold"
                    style={{ color: cat.touched ? 'var(--color-teal)' : 'var(--color-amber)', fontFamily: 'var(--font-mono)' }}>
                {cat.touched}/{cat.total}
              </span>
            </div>
            <div className="h-1.5 rounded-full mt-1" style={{ background: 'var(--color-surface-2)' }}>
              <div className="h-full rounded-full"
                   style={{ width: `${cat.share * 100}%`, background: 'var(--color-teal-dark)' }} />
            </div>
          </div>
        ))}
      </div>

      {c.emptyCategories.length > 0 && (
        <p className="text-[11px] mt-4 leading-relaxed" style={{ color: 'var(--color-white)' }}>
          {c.emptyCategories.length === 1
            ? `Un'intera area del diario è a zero: «${c.emptyCategories[0].label}» non è mai entrata in un allenamento registrato.`
            : `${c.emptyCategories.length} aree del diario sono a zero: ${c.emptyCategories.map(x => x.label.toLowerCase()).join(', ')}.`}
        </p>
      )}

      {missingTotal > 0 && (
        <>
          <button onClick={() => setShowMissing(s => !s)}
                  className="w-full mt-3 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
            {showMissing ? 'Nascondi le voci mai lavorate' : `Mostra le ${missingTotal} voci mai lavorate`}
          </button>

          {showMissing && (
            <div className="mt-3 space-y-3">
              {c.byCategory.filter(cat => cat.missing.length > 0).map(cat => (
                <div key={cat.id}>
                  <p className="text-[9px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--color-slate)' }}>
                    {cat.icon} {cat.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.missing.map(item => (
                      <span key={item.id} className="px-2.5 py-1 rounded-full text-[10px]"
                            style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Note>
        Anche questo blocco guarda <strong>tutto lo storico</strong>, non il periodo: «mai» vuol dire
        mai. Il numero a destra in cima è invece quante voci distinte hai toccato nel periodo
        selezionato. Non c'è nessun obiettivo di riempire tutte e {TOTAL_FOCUS} le voci — la
        tassonomia è volutamente esaustiva perché nessuno debba «arrotondare» quello che ha fatto —
        ma una categoria intera a zero di solito è una svista, non una scelta.
      </Note>
    </Card>
  )
}

function CoverageInfo() {
  return (
    <>
      <InfoItem>
        Il diario contiene {TOTAL_FOCUS} voci divise in 7 aree (dal glossario ITF e dalla letteratura
        sugli schemi di gioco). Questo blocco dice quante di quelle voci sono mai comparse nel focus
        di un allenamento, da quando usi l'app.
      </InfoItem>
      <InfoItem title="Il numero grande e quello a destra">
        A sinistra le voci toccate <strong>almeno una volta nella vita</strong> dell'app; a destra
        quante ne hai toccate nel <strong>periodo selezionato</strong> in cima alla pagina. Il primo
        misura l'ampiezza del tuo tennis, il secondo quanto ne hai coperto ultimamente.
      </InfoItem>
      <InfoItem title="Le barre per area">
        Quante voci di ciascuna area hai toccato, sul totale che l'area contiene. Un'area a zero è
        il dato che conta: «non ho mai messo una volée in un allenamento» è una frase che nessuno si
        dice da solo, ma è esattamente il genere di buco che poi si paga in partita.
      </InfoItem>
      <InfoItem title="Non è un obiettivo">
        Nessuno lavora tutte e {TOTAL_FOCUS} le voci, e una copertura bassa non è un difetto: la
        lista è lunga apposta, così non devi mai «arrotondare» quello che hai fatto scegliendo la
        voce più vicina. Serve a scoprire i buchi, non a riempire una collezione.
      </InfoItem>
      <InfoItem>
        Conta solo quello che hai <em>registrato</em>: se in un allenamento hai lavorato la risposta
        ma non l'hai segnata nel focus, per l'app non è successo.
      </InfoItem>
    </>
  )
}
