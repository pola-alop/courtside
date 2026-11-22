import { GENDERS } from '../lib/gender'

// Selettore del genere, condiviso da AddOpponentModal, OpponentDetailModal e
// Profile. A differenza di «Mano» una scelta già fatta non si deseleziona: si
// può solo cambiare. `required` aggiunge l'asterisco e, finché `value` è vuoto,
// l'avviso (nessun valore di ripiego: il campo resta vuoto e blocca il salvataggio).
export default function GenderField({ value, onChange, required = false }) {
  return (
    <div>
      <label className="text-xs mb-1 block" style={{ color: 'var(--color-slate)' }}>
        {required ? 'Genere *' : 'Genere'}
      </label>
      <div className="flex gap-2">
        {GENDERS.map(g => {
          const active = value === g.id
          return (
            <button key={g.id}
              type="button"
              onClick={() => { if (!active) onChange(g.id) }}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: active ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                color:      active ? 'var(--color-white)' : 'var(--color-slate)',
                fontFamily: 'var(--font-display)'
              }}>
              {g.label}
            </button>
          )
        })}
      </div>
      {required && !value && (
        <p className="text-xs mt-1.5" style={{ color: 'var(--color-amber-light)' }}>
          Il genere è obbligatorio: serve per la categoria dei doppi.
        </p>
      )}
    </div>
  )
}
