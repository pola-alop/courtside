import { useState } from 'react'

// Primitive visive condivise dalle sezioni di Stats. Vivono in un file a parte
// (a differenza degli helper "privati" di un componente, che stanno sotto il
// componente stesso) perché sono usate da tutti i blocchi di Rendimento e lo
// saranno dalle altre quattro sezioni: Card, tile, barre e stato "dati
// insufficienti" devono avere lo stesso aspetto in tutta la pagina.

// Contenitore di un blocco. `id` serve agli insight per portare l'utente
// esattamente al blocco che ha generato la frase. `titleExtra` va accanto al
// titolo (es. il bottone "?" di InfoButton), `right` resta sul lato opposto
// (es. SampleTag) — stesso schema di `labelExtra` in FieldGroup.
export function Card({ id, title, titleExtra, sub, right, children, className = '' }) {
  return (
    <section id={id} className={`rounded-2xl p-4 ${className}`}
             style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)', scrollMarginTop: 16 }}>
      {(title || right) && (
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            {title && (
              <p className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5"
                 style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
                {title}
                {titleExtra}
              </p>
            )}
            {sub && <p className="text-[10px] mt-1" style={{ color: 'var(--color-slate)' }}>{sub}</p>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

// Bottoncino "?" + modale informativa, generico: stesso pattern di
// TrainingEffectInfoButton (self-contained, gestisce il proprio `open`), ma
// parametrizzato su titolo e contenuto così ogni blocco di Stats può spiegare
// i propri numeri senza duplicare bottone/overlay/header.
export function InfoButton({ title, children }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Cos'è: ${title}`}
        className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
        style={{ background: 'rgba(118,195,194,0.18)', color: 'var(--color-teal)', lineHeight: 1 }}>
        ?
      </button>
      {open && <InfoModal title={title} onClose={() => setOpen(false)}>{children}</InfoModal>}
    </>
  )
}

function InfoModal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: 'rgba(2,13,25,0.9)', backdropFilter: 'blur(6px)', textTransform: 'none', fontWeight: 400 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-3xl flex flex-col"
           style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)', maxHeight: '85vh' }}>

        <div className="shrink-0 px-6 pt-6 pb-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-surface-2)' }}>
          <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-white)' }}>
            {title}
          </h2>
          <button onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)' }}>
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4" style={{ textTransform: 'none' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// Sotto-sezione di testo dentro una InfoModal: titolo teal + paragrafo,
// riusato in tutte le spiegazioni per coerenza visiva con TrainingEffectInfo.
export function InfoItem({ title, children }) {
  return (
    <div>
      {title && (
        <p className="text-xs font-semibold uppercase tracking-wider mb-1"
           style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          {title}
        </p>
      )}
      <p className="text-sm leading-relaxed" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-body)' }}>
        {children}
      </p>
    </div>
  )
}

// Tile compatta. Se `onClick` è presente diventa un bottone: ogni numero della
// pagina deve poter mostrare le partite che l'hanno prodotto, altrimenti non è
// verificabile e si smette di fidarsene.
export function Tile({ label, value, sub, color = 'var(--color-white)', onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick}
         className={`rounded-xl px-1.5 py-2.5 text-center min-w-0 w-full ${onClick ? 'transition-all active:scale-95' : ''}`}
         style={{ background: 'var(--color-surface-2)' }}>
      <p className="text-base font-bold truncate" style={{ color, fontFamily: 'var(--font-display)' }}>{value}</p>
      <p className="text-[9px] uppercase tracking-wide leading-tight mt-0.5" style={{ color: 'var(--color-slate)' }}>{label}</p>
      {sub && <p className="text-[9px] mt-0.5 truncate" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>{sub}</p>}
    </Tag>
  )
}

// Riga con barra proporzionale: l'unità visiva di splits, bucket e curve.
// `rate` (0..1) governa la larghezza, `value` il testo a destra.
// `tick` disegna un riferimento verticale (es. il 50%): una barra al 54% e una
// al 46% sono quasi identiche a occhio, la tacca è ciò che rende leggibile da
// che parte della soglia sta il valore.
export function BarRow({ label, sub, value, rate, color = 'var(--color-teal-dark)', onClick, dim, badge, tick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick}
         className={`w-full text-left ${onClick ? 'transition-all active:scale-[0.99]' : ''}`}
         style={{ opacity: dim ? 0.45 : 1 }}>
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] flex-1 min-w-0 truncate"
              style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {label}
        </span>
        {badge}
        <span className="text-[11px] shrink-0 font-semibold"
              style={{ color, fontFamily: 'var(--font-mono)' }}>
          {value}
        </span>
      </div>
      <div className="h-1.5 rounded-full mt-1.5 relative" style={{ background: 'var(--color-surface-2)' }}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, rate || 0)) * 100}%`, background: color }} />
        {tick != null && (
          <div className="absolute top-0 bottom-0 w-px"
               style={{ left: `${tick * 100}%`, background: 'var(--color-white)', opacity: 0.35 }} />
        )}
      </div>
      {sub && <p className="text-[9px] mt-1" style={{ color: 'var(--color-slate)' }}>{sub}</p>}
    </Tag>
  )
}

// Barra a due lati che condividono il 100%: usata dove il confronto è "io
// contro l'avversario" e le due quote sono complementari per costruzione.
export function SplitBar({ rate, leftColor = 'var(--color-win)', rightColor = 'var(--color-loss)' }) {
  const w = Math.max(0, Math.min(1, rate ?? 0)) * 100
  return (
    <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'var(--color-surface-2)' }}>
      <div style={{ width: `${w}%`, background: leftColor }} />
      <div style={{ width: `${100 - w}%`, background: rightColor, opacity: 0.55 }} />
    </div>
  )
}

// Stato "non abbastanza dati". Non è un errore: è la promessa che il numero
// arriverà, con quante sessioni mancano. Mostrare comunque una percentuale su
// tre partite sarebbe l'unico vero modo di rendere questa pagina inutile.
export function NotEnough({ need, unit = 'partite', what }) {
  return (
    <div className="rounded-xl px-3 py-4 text-center" style={{ background: 'var(--color-surface-2)' }}>
      <p className="text-[11px]" style={{ color: 'var(--color-slate)' }}>
        {what ? `${what}: ` : ''}servono ancora <span style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-mono)' }}>{need}</span> {unit}.
      </p>
    </div>
  )
}

// Etichetta di campione. Compare ovunque ci sia una media: senza il "su quante"
// una percentuale non è interpretabile.
export function SampleTag({ n, unit = 'partite' }) {
  return (
    <span className="text-[9px] shrink-0" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
      {n} {unit}
    </span>
  )
}

export function Note({ children }) {
  return (
    <p className="text-[10px] mt-3 leading-relaxed" style={{ color: 'var(--color-slate)' }}>
      {children}
    </p>
  )
}
