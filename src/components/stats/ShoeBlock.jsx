import { Card, NotEnough, Note, InfoButton, InfoItem } from './StatsUI'
import { MIN_SHOE_GAMES, formatKm, formatGamesShort } from '../../lib/setup'
import { SHOE_LIFE_GAMES, SURFACE_WEAR, wearLevelMeta } from '../../lib/wear'
import { surfaceIcon } from '../../lib/tennis'

// Blocco 3 — chilometraggio scarpe e usura per superficie.
//
// ── Due numeri diversi, e tenerli distinti è il punto ──
// I GAME PESATI sono l'unità con cui l'app decide se una suola è finita: il
// cemento consuma 1,4 volte la terra, quindi mille game sul cemento non sono
// mille game sulla terra. I CHILOMETRI sono invece una misura vera, presa
// dall'orologio, e ci sono solo sulle sessioni in cui hai trascritto i dati
// atletici — quasi mai tutte. Mostrarli insieme senza dichiarare la differenza di
// copertura farebbe leggere come "chilometraggio" una cifra che descrive un
// quinto delle uscite.
//
// ── Perché la superficie è la parte azionabile ──
// È l'unica cosa che si può cambiare domani: una suola da terra usata sul cemento
// dura la metà, e nessuna app te lo dice perché nessuna sa su cosa hai giocato.
// Qui il dato c'è.

export default function ShoeBlock({ report }) {
  const shoes = report.shoeStats.filter(s => s.sessions > 0)
  const info = <InfoButton title="Chilometraggio e usura delle scarpe"><ShoeInfo /></InfoButton>

  if (shoes.length === 0) {
    return (
      <Card id="scarpe" title="Chilometraggio scarpe" titleExtra={info}
            sub="Game pesati per superficie e chilometri reali">
        <NotEnough need={1} unit="sessioni con le scarpe dichiarate"
                   what="Per il chilometraggio" />
      </Card>
    )
  }

  const totalKm = shoes.reduce((s, x) => s + (x.km || 0), 0)
  const kmSessions = shoes.reduce((s, x) => s + x.kmSessions, 0)

  return (
    <Card id="scarpe" title="Chilometraggio scarpe" titleExtra={info}
          sub="Game pesati per superficie e chilometri reali">

      <div className="space-y-4">
        {shoes.map(shoe => <ShoeRow key={shoe.id} shoe={shoe} />)}
      </div>

      <Note>
        La percentuale è sul budget di {SHOE_LIFE_GAMES} game pesati per superficie: il cemento conta
        ×{SURFACE_WEAR.cemento}, la terra ×{SURFACE_WEAR.terra}, l'erba ×{SURFACE_WEAR.erba}, l'indoor
        ×{SURFACE_WEAR.indoor}. È lo stesso numero del badge di usura in Equipment, non un secondo
        calcolo.
        {kmSessions > 0
          ? ` I chilometri (${formatKm(totalKm)} km in totale) sono invece una misura vera, presa dall'orologio: ci sono solo sulle ${kmSessions} ${kmSessions === 1 ? 'sessione in cui hai trascritto' : 'sessioni in cui hai trascritto'} i dati atletici, quindi il totale è per costruzione più basso di quanto hai camminato davvero.`
          : ' I chilometri compaiono quando trascrivi la distanza dall\'orologio nel dettaglio di una sessione: senza, resta il conteggio in game.'}
      </Note>
    </Card>
  )
}

function ShoeRow({ shoe }) {
  const meta = wearLevelMeta(shoe.level)
  const surfaces = shoe.surfaces.filter(s => s.weighted > 0)
  const totalWeighted = surfaces.reduce((s, x) => s + x.weighted, 0)

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] flex-1 min-w-0 truncate"
              style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {shoe.label}
        </span>
        {!shoe.active && (
          <span className="text-[9px] shrink-0 px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
            archiviate
          </span>
        )}
        <span className="text-[11px] shrink-0 font-semibold" style={{ color: meta.color, fontFamily: 'var(--font-mono)' }}>
          {shoe.percent}%
        </span>
      </div>

      {/* Consumo sul budget */}
      <div className="h-2 rounded-full mt-1.5" style={{ background: 'var(--color-surface-2)' }}>
        <div className="h-full rounded-full"
             style={{ width: `${Math.min(100, shoe.percent)}%`, background: meta.bar }} />
      </div>

      <p className="text-[9px] mt-1" style={{ color: 'var(--color-slate)' }}>
        {formatGamesShort(shoe.weighted)} game pesati · {shoe.matchCount}P/{shoe.trainingCount}A
        {shoe.km != null
          ? ` · ${formatKm(shoe.km)} km su ${shoe.kmSessions}/${shoe.sessions} sessioni`
          : ' · nessuna distanza trascritta'}
      </p>

      {/* Mix di superfici: una barra impilata, con la legenda che porta il valore
          accanto al colore — quattro superfici a colpo d'occhio non sono
          distinguibili dal solo colore. */}
      {surfaces.length > 0 && totalWeighted > 0 && (
        <div className="mt-2">
          <div className="flex w-full rounded-full overflow-hidden" style={{ height: 6, background: 'var(--color-surface-2)' }}>
            {surfaces.map(s => (
              <div key={s.surface}
                   style={{ width: `${(s.weighted / totalWeighted) * 100}%`, background: surfaceColor(s.surface) }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
            {surfaces.map(s => (
              <span key={s.surface} className="text-[9px] flex items-center gap-1"
                    style={{ color: 'var(--color-slate)' }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: surfaceColor(s.surface) }} />
                {s.surface} {Math.round((s.weighted / totalWeighted) * 100)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* L'unica riga azionabile: la scarpa dichiara una superficie e ne calchi
          un'altra. */}
      {shoe.enough && shoe.offSurface && shoe.offSurface.share >= 0.2 && (
        <p className="text-[10px] mt-2 leading-relaxed px-2.5 py-2 rounded-lg"
           style={{
             background: shoe.offSurface.share >= 0.5 ? 'var(--color-loss-bg)' : 'var(--color-surface-2)',
             color: 'var(--color-white)',
           }}>
          {shoe.offSurface.share >= 0.5 ? '⚠️ ' : 'ℹ️ '}
          Il {Math.round(shoe.offSurface.share * 100)}% del gioco con queste è su una superficie diversa
          da quella per cui sono dichiarate ({shoe.offSurface.declared.map(s => `${surfaceIcon(s)} ${s}`).join(', ')}).
        </p>
      )}

      {!shoe.enough && (
        <p className="text-[9px] mt-1.5" style={{ color: 'var(--color-slate)' }}>
          Sotto {MIN_SHOE_GAMES} game pesati: il mix di superfici non è ancora una distribuzione.
        </p>
      )}
    </div>
  )
}

function ShoeInfo() {
  return (
    <>
      <InfoItem>
        Quanto hanno lavorato le tue scarpe, in due unità diverse: i <strong>game pesati</strong>,
        che sono quelli con cui l'app calcola quando la suola è finita, e i <strong>chilometri</strong>,
        che sono una misura vera presa dall'orologio.
      </InfoItem>
      <InfoItem title="Cosa sono i «game pesati»">
        Il conteggio dei game giocati con quelle scarpe, moltiplicato per quanto la superficie di
        quella sessione consuma la suola: il cemento è abrasivo (×{SURFACE_WEAR.cemento}), la terra è
        dolce (×{SURFACE_WEAR.terra}), l'erba di più (×{SURFACE_WEAR.erba}), l'indoor è il riferimento
        neutro (×{SURFACE_WEAR.indoor}). Mille game sul cemento consumano quanto millecinquecento
        sulla terra, e la percentuale ne tiene conto.
      </InfoItem>
      <InfoItem title="La percentuale">
        Il consumo sul budget di {SHOE_LIFE_GAMES} game pesati, che è la vita di riferimento di una
        suola da tennis. È esattamente lo stesso numero del badge di usura che vedi in Equipment: non
        è un secondo calcolo, è lo stesso letto da un'altra angolazione.
      </InfoItem>
      <InfoItem title="Anche gli allenamenti contano">
        E non come le partite: un'ora di atletica consuma la suola più di un'ora di partita (è
        movimento continuo, senza le pause tra i punti), un'ora di secchiello di servizi quasi per
        niente. Ogni tipo di blocco ha la sua tariffa.
      </InfoItem>
      <InfoItem title="I chilometri">
        La somma delle distanze trascritte dall'orologio nelle sessioni giocate con quelle scarpe. È
        un dato facoltativo e quasi mai completo: accanto trovi su quante sessioni è disponibile. Il
        totale è quindi sempre <strong>più basso</strong> di quanto hai camminato davvero, e non va
        confrontato con il chilometraggio dichiarato da un produttore di scarpe da running.
      </InfoItem>
      <InfoItem title="Il mix di superfici">
        Su cosa hai giocato con quelle scarpe, pesato. Serve alla riga di avviso: se una scarpa da
        terra passa metà della vita sul cemento, si consuma molto prima di quanto pensi, e il
        battistrada da terra non ha nemmeno il grip giusto. È l'unica cosa di questo blocco su cui
        puoi agire domani.
      </InfoItem>
      <InfoItem title="La superficie dichiarata">
        Viene dal catalogo (o dal campo «superficie» se hai inserito la scarpa a mano). Se non l'hai
        compilata, l'avviso non compare: senza un riferimento non si può dire che una superficie sia
        «sbagliata».
      </InfoItem>
      <InfoItem>
        Le scarpe archiviate restano in elenco e sono marcate: la loro percentuale finale è una vita
        conclusa, cioè il termine di paragone più onesto che hai per capire quanto ti durano davvero.
      </InfoItem>
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────

// Le superfici hanno già un'identità cromatica implicita nell'app (le icone
// colorate di `surfaceIcon`): la barra le riusa invece di inventare una palette
// nuova, e la legenda porta comunque il nome accanto al colore.
function surfaceColor(surface) {
  return {
    terra:   'var(--color-amber)',
    cemento: 'var(--color-draw)',
    erba:    'var(--color-win)',
    indoor:  'var(--color-teal-dark)',
  }[surface] || 'var(--color-slate)'
}
