import { readTime } from '../lib/sessionTime'

// Data e ora d'inizio di una sessione di tennis, condivise dai wizard di
// partita e allenamento. L'ora è obbligatoria per le sessioni nuove; in
// modifica di un documento salvato prima che l'ora esistesse resta facoltativa
// (`timeRequired` falso), altrimenti si dovrebbe inventarne una per salvare.
// Nessun valore di ripiego: un'ora vuota resta vuota e, se obbligatoria,
// blocca il salvataggio con l'avviso.
const INPUT_STYLE = {
  background: 'var(--color-surface-2)', color: 'var(--color-white)',
  border: '1px solid transparent', fontFamily: 'var(--font-body)',
}

export default function DateTimeFields({ date, time, onDate, onTime, timeRequired = true }) {
  const missing = timeRequired && !readTime(time)
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Data</label>
          <input type="date" value={date} onChange={e => onDate(e.target.value)}
                 className="w-full p-3 rounded-xl text-sm outline-none" style={INPUT_STYLE} />
        </div>
        <div className="min-w-0">
          <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>
            {timeRequired ? 'Ora d\'inizio *' : 'Ora d\'inizio'}
          </label>
          <input type="time" value={time} onChange={e => onTime(e.target.value)}
                 className="w-full p-3 rounded-xl text-sm outline-none" style={INPUT_STYLE} />
        </div>
      </div>
      {missing && (
        <p className="text-xs mt-1.5" style={{ color: 'var(--color-amber-light)' }}>
          L'ora d'inizio è obbligatoria: serve per mettere in ordine le sessioni dello stesso giorno.
        </p>
      )}
      {!timeRequired && !readTime(time) && (
        <p className="text-xs mt-1.5" style={{ color: 'var(--color-slate)' }}>
          Facoltativa: questa sessione è stata registrata prima che l'ora esistesse.
        </p>
      )}
    </div>
  )
}
