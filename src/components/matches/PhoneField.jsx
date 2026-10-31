import { PHONE_COUNTRIES, PHONE_COUNTRY_BY_ISO, phoneIssue } from '../../lib/phone'

// Due box affiancati: il prefisso (bandiera + +39) e il numero. Il valore è
// { country, number } con `number` come lo scrive l'utente: la normalizzazione
// in sole cifre avviene al salvataggio (phoneFields), così il campo non
// riscrive mai ciò che si sta digitando. Un numero vuoto è valido (facoltativo);
// uno compilato ma sbagliato per il paese scelto mostra l'avviso e chi usa il
// campo blocca il salvataggio con `phoneIssue`.
export default function PhoneField({ value, onChange }) {
  const country = PHONE_COUNTRY_BY_ISO[value.country]
  const issue = phoneIssue(value.country, value.number)

  return (
    <div>
      <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>Telefono</label>
      <div className="flex gap-2">
        {/* Il select nativo sta sopra, trasparente: il sistema apre il suo
            selettore, mentre il box mostra solo bandiera e prefisso (le
            etichette lunghe delle opzioni non entrano in un box stretto). */}
        <div className="relative shrink-0" style={{ width: '6.5rem' }}>
          <div className="w-full p-3 rounded-xl text-sm flex items-center justify-between gap-1"
               style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', fontFamily: 'var(--font-body)' }}>
            <span className="truncate">{country?.flag} +{country?.dial}</span>
            <span style={{ color: 'var(--color-slate)' }}>▾</span>
          </div>
          <select
            aria-label="Prefisso internazionale"
            value={value.country}
            onChange={e => onChange({ ...value, country: e.target.value })}
            className="absolute inset-0 w-full h-full opacity-0"
          >
            {PHONE_COUNTRIES.map(c => (
              <option key={c.iso} value={c.iso}>{c.flag} {c.name} (+{c.dial})</option>
            ))}
          </select>
        </div>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={value.number}
          placeholder="Numero"
          onChange={e => onChange({ ...value, number: e.target.value })}
          className="flex-1 min-w-0 p-3 rounded-xl text-sm outline-none"
          style={{
            background: 'var(--color-surface-2)',
            color: 'var(--color-white)',
            border: `1px solid ${issue ? 'rgba(220,80,80,0.5)' : 'transparent'}`,
            fontFamily: 'var(--font-body)'
          }}
        />
      </div>
      {issue && (
        <p className="text-xs mt-1" style={{ color: '#ff7070' }}>{issue}</p>
      )}
    </div>
  )
}
