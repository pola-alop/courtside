import { Link } from 'react-router-dom'

// La Home è la prima schermata dopo il login: finché non esiste nemmeno una
// sessione, l'unica cosa onesta da mostrare non è un cruscotto vuoto con quattro
// zeri, ma cosa fare perché quel cruscotto significhi qualcosa.
//
// È una CHECKLIST, non una schermata di benvenuto statica: i primi due passi si
// spuntano da soli quando i dati arrivano, così la pagina cambia mentre la usi
// invece di ripetere lo stesso invito. Sparisce del tutto alla prima sessione
// registrata — profilo e attrezzatura restano facoltativi, e non vale la pena
// tenere in vita un tutorial per due caselle non spuntate.

export default function Onboarding({ name, profileDone, equipmentDone, addMatchTo, addTrainingTo }) {
  return (
    <div className="px-6 pt-12 pb-32">

      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl mb-4"
             style={{ background: 'var(--color-teal-dark)' }}>
          <span className="text-3xl">🎾</span>
        </div>
        <h1 className="text-2xl font-bold mb-2"
            style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {name ? `Ciao ${name}` : 'Benvenuto'}
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-slate)' }}>
          Courtside tiene il conto del tuo tennis: partite, allenamenti, attrezzatura.
          Più registri, più le pagine hanno qualcosa da dirti.
        </p>
      </div>

      <p className="text-xs font-semibold uppercase tracking-widest mb-3"
         style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
        Per cominciare
      </p>

      <div className="space-y-2 mb-8">
        <Step n={1} done={profileDone} to="/profile"
              title="Completa il tuo profilo"
              sub="Mano, livello, da quanto giochi" />
        <Step n={2} done={equipmentDone} to="/equipment"
              title="Aggiungi la tua attrezzatura"
              sub="Racchette e scarpe: da qui nasce il calcolo dell'usura" />
        <Step n={3} done={false}
              title="Registra la prima sessione"
              sub="Una partita o un allenamento — bastano pochi tap" />
      </div>

      <div className="flex gap-2">
        <Link to={addMatchTo}
          className="flex-1 py-3.5 rounded-2xl text-sm font-semibold text-center transition-all active:scale-95"
          style={{ background: 'var(--color-amber)', color: 'var(--color-bg)', fontFamily: 'var(--font-display)' }}>
          + Partita
        </Link>
        <Link to={addTrainingTo}
          className="flex-1 py-3.5 rounded-2xl text-sm font-semibold text-center transition-all active:scale-95"
          style={{ background: 'var(--color-surface)', color: 'var(--color-teal)', border: '1px solid var(--color-surface-2)', fontFamily: 'var(--font-display)' }}>
          + Allenamento
        </Link>
      </div>

      <p className="text-xs text-center mt-6 leading-relaxed" style={{ color: 'var(--color-surface-2)' }}>
        I tuoi dati restano privati nel tuo account.
      </p>
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

// Il passo completato resta visibile e barrato invece di sparire: vedere le
// caselle spuntarsi è metà del motivo per cui una checklist funziona.
function Step({ n, done, title, sub, to }) {
  const body = (
    <>
      <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{
              background: done ? 'var(--color-win-bg)' : 'var(--color-surface-2)',
              color: done ? 'var(--color-win)' : 'var(--color-slate)',
              fontFamily: 'var(--font-display)',
            }}>
        {done ? '✓' : n}
      </span>
      <span className="flex-1 min-w-0">
        <span className="text-sm font-semibold block truncate"
              style={{
                color: done ? 'var(--color-slate)' : 'var(--color-white)',
                fontFamily: 'var(--font-display)',
                textDecoration: done ? 'line-through' : 'none',
              }}>
          {title}
        </span>
        <span className="text-xs block truncate" style={{ color: 'var(--color-slate)' }}>{sub}</span>
      </span>
      {to && !done && <span className="text-sm shrink-0" style={{ color: 'var(--color-slate)' }}>›</span>}
    </>
  )

  const className = 'w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-left'
  const style = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-surface-2)',
    opacity: done ? 0.6 : 1,
  }

  if (!to || done) return <div className={className} style={style}>{body}</div>

  return (
    <Link to={to} className={`${className} transition-all active:scale-[0.99]`} style={style}>
      {body}
    </Link>
  )
}
