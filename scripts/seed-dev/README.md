# Seed dati sintetici (solo dev)

Popola il progetto Firebase **dev** (`courtside-dev-a2ca6`) con un set di dati
sintetici — attrezzatura, avversari, partite (inclusi tornei con turni,
campionati, ritiri, pareggi), allenamenti — sotto l'utente Google già loggato
in dev. **Cancella prima tutti i dati esistenti** di quell'utente (equipment,
opponents, matches, trainings, profilo) e li ricrea da zero.

Bypassa le regole di sicurezza di Firestore usando `firebase-admin`, quindi
serve una service account key del progetto dev (mai quella di produzione —
lo script rifiuta di girare se rileva il project id di produzione).

## Uso

```bash
cd scripts/seed-dev
npm install   # solo la prima volta
node seed.mjs /path/alla/service-account-key.json [email-utente]
```

- La chiave si genera da Firebase Console → Project Settings → Service
  Accounts → Generate new private key, per il progetto `courtside-dev-a2ca6`.
- `email-utente` è opzionale: se omesso, usa il primo utente trovato
  nell'Auth del progetto dev (va bene se hai fatto login una sola volta
  con `npm run dev`).
- La chiave e la cartella `node_modules` di questo script **non vanno mai
  committate** (già in `.gitignore`).

## Perché è isolato dal progetto principale

`firebase-admin` è un pacchetto pesante e non serve all'app (che usa solo
`firebase`, l'SDK client). Tenerlo in un `package.json` separato qui dentro
evita di sporcare le dipendenze/il lockfile dell'app per un tool di sola
utilità di sviluppo.
