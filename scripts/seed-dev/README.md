# Seed dati sintetici (solo dev)

Popola il progetto Firebase **dev** (`courtside-dev-a2ca6`) con un set di dati
sintetici — attrezzatura, avversari, partite (inclusi tornei con turni,
campionati, ritiri, pareggi), allenamenti, schede e sessioni di corsa (con la
tabella zone → passo nel profilo), schede e sessioni di palestra (con un esercizio
personalizzato), e i programmi del calendario della Home — sotto l'utente
Google già loggato in dev.
**Cancella prima tutti i dati esistenti** di quell'utente (equipment,
opponents, matches, trainings, runs, runWorkouts, gymWorkouts, gymSessions,
gymExercises, plans, profilo) e li ricrea da zero. I dettagli dei file .FIT
(`fitDetails`) non vengono toccati: dopo il seed restano senza sessione.

## Date fisse e date relative

Quasi tutto il dataset ha date fisse (settembre 2025 – settembre 2026). Il
blocco del **calendario** parte invece dal giorno in cui si lancia lo script,
altrimenti il mese corrente sarebbe vuoto:

- una sessione o due a settimana nelle tre settimane prima di questa, così la
  fiammella è accesa;
- nei giorni già passati della settimana corrente, uno stato per giorno a
  partire dal lunedì: allenamento fatto, corsa non svolta, riposo rispettato,
  palestra fatta, due allenamenti programmati con uno solo svolto, una corsa
  senza programma (di lunedì non se ne vede nessuno, di domenica tutti);
- oggi una corsa programmata e fatta e il tennis della sera da fare (con
  "Registra");
- nei giorni dopo palestra, allenamento, un giorno con corsa e partita di
  torneo, un riposo e una partita con l'avversario da definire;
- un programma il 1° del mese dopo se l'ultima riga della griglia ci arriva, e
  uno passato fuori dalla settimana corrente (a DB ma non visibile).

Per rivedere il calendario "di oggi" basta rilanciare il seed.

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
