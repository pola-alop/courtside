# Courtside

## Mantieni il file CLAUDE.md aggiornato - da aggiornare ogni volta che una inforazioni rilevante viene sviluppata
Ogni volta che una informazione rilevante per il file CLAUDE.md viene sviluppata, il file .md deve esssere aggiornato. Non lasciare che i fatti passino inosservati.

## Scopo del progetto

Courtside è una web app (PWA) mobile-first per tennisti amatoriali, pensata come "companion" personale per la propria attrezzatura, le partite e le statistiche. L'utente si autentica con Google, e i suoi dati (racchette, scarpe, corde, partite, profilo) vengono salvati privatamente nel proprio account Firebase.

Le sezioni principali (navigabili dalla bottom nav) sono:
- **Home** — dashboard generale (in early stage)
- **Matches** — storico/gestione partite (in early stage)
- **Equipment** — gestione attrezzatura (racchette, scarpe, outfit, borsoni): l'unica feature completa oggi. Permette di aggiungere item dal catalogo o custom, tracciare lo stato di usura (es. giorni dall'ultimo cambio corde), e archiviarli/eliminarli.
- **Stats** — statistiche di gioco (in early stage)
- **Profile** — dati profilo utente e logout

## Stack e decisioni di architettura

- **Vite + React 19**, no TypeScript — componenti funzionali con hooks, niente classi.
- **React Router v7** per il routing client-side (`src/App.jsx`), con redirect a `Login` se l'utente non è autenticato.
- **Firebase** come backend completo: **Auth** (solo Google Sign-In) + **Firestore** (nessun backend custom, nessuna REST API propria).
  - Struttura dati Firestore: `users/{uid}` come root doc, con subcollection per dominio (es. `users/{uid}/equipment`). Ogni nuovo dominio (matches, stats...) dovrebbe seguire lo stesso pattern: subcollection sotto lo user doc, non collection top-level.
  - `initUserData` (`src/firebase/initUser.js`) crea il doc utente al primo login, se non esiste già.
- **Tailwind v4** (via `@tailwindcss/vite`, non il PostCSS plugin classico) per utility layout/spacing, ma **i colori e i font sono sempre inline via CSS custom properties** (`var(--color-*)`, `var(--font-*)` definite in `src/index.css`), mai classi Tailwind per colori. Questo per centralizzare il design system in un unico posto.
- **Nessuno state manager globale** (no Redux/Zustand/Context oltre l'auth implicito): lo stato è gestito con hook locali per dominio che wrappano le chiamate Firestore, es. `useEquipment` (`src/hooks/useEquipment.js`) espone `{ equipment, loading, error, add, update, archive, remove, changeStrings, reload }` e ogni mutazione fa `await <call firestore> → await load()` (nessun update ottimistico).
- **Pattern "selected item derivato"**: quando un componente pagina tiene un item selezionato da mostrare in una modale di dettaglio (es. `Equipment.jsx`), tienilo come `selectedId` e derivalo ad ogni render con `equipment.find(e => e.id === selectedId)`, non come copia dell'oggetto in uno state separato — altrimenti la modale mostra dati stantii dopo un reload (es. dopo `changeStrings`). Non usare un `useEffect` con `setState` per "sincronizzare" due state paralleli: la regola ESLint `react-hooks/set-state-in-effect` lo blocca, ed è comunque un anti-pattern (derivare > sincronizzare).
- **Storico incordature (`item.stringsHistory`)**: le racchette hanno sia `strings` (incordatura attuale: `{brand, model, tension, mountedAt}`) sia `stringsHistory` (array delle incordature precedenti, stesso shape). `updateStrings` in `src/firebase/equipment.js` prima di scrivere la nuova `strings` legge il documento e sposta quella corrente in `stringsHistory` via `arrayUnion` (gestisce anche la migrazione dai vecchi campi flat `stringBrand`/`stringModel`/`stringTension`/`stringDate` se `strings` non esiste ancora). Nella UI, `EquipmentDetailModal.jsx` separa il salvataggio del nickname (`onUpdate`, generico) dal cambio corde (`onChangeStrings`, dedicato): il cambio corde passa sempre da `onChangeStrings`/`updateStrings` per non perdere lo storico, mai da un `update` generico che sovrascriverebbe `strings` senza `arrayUnion`.
- **Separazione netta hook/firebase-layer/component**: i file in `src/firebase/*.js` contengono *solo* funzioni di accesso dati (query/mutation Firestore), zero JSX o logica UI. Gli hook in `src/hooks/*.js` orchestrano stato React + chiamate al layer firebase. I componenti in `src/pages` e `src/components` non chiamano mai Firestore direttamente, solo tramite hook.
- **Catalogo statico** (`src/data/catalog.json`): lista di racchette/scarpe predefinite usata per aggiungere equipment "da catalogo" senza inserimento manuale.
- **PWA** via `vite-plugin-pwa` (dipendenza presente, verificare `vite.config.js` prima di assumerne la configurazione attiva).
- Variabili d'ambiente Firebase in `.env.local`, prefisso `VITE_FIREBASE_*` (mai committare `.env.local`).

## Coding convention

- Componenti: **function declarations** con `export default function NomeComponente()`, non arrow function assegnate a const.
- Niente punto e virgola a fine riga nei file `.jsx`/`.js` di componenti/hook (stile già presente nel repo), ma i file firebase layer li usano — segui lo stile del file che stai modificando, non introdurre un mix nello stesso file.
- Stile inline via `style={{ ... }}` con `var(--color-*)` per qualunque colore, background, bordo; Tailwind solo per spacing/flex/grid/border-radius/transizioni/dimensioni.
- Helper "privati" di un componente (funzioni pure di formatting/logica) vanno sotto il componente stesso, separati da un commento `// ── Helpers ──...` (vedi `EquipmentCard.jsx`), non estratti in file separati a meno che siano condivisi da più componenti.
- I nomi di variabili, commenti e stringhe UI sono **in italiano** in alcuni punti (es. `initUser.js`) e in inglese in altri (es. testi Login) — il repo non ha uno standard di lingua rigido, ma le stringhe rivolte all'utente finale sembrano prevalentemente in inglese ("Continue with Google", "Sign out"): mantieni l'inglese per nuovo UI copy a meno che l'utente chieda diversamente.
- ESLint: config flat (`eslint.config.js`) con `eslint-plugin-react-hooks` e `eslint-plugin-react-refresh`. Esegui `npm run lint` dopo modifiche non banali.
- Nessun framework di test presente nel repo: non assumere l'esistenza di Jest/Vitest, non introdurne uno senza che sia richiesto esplicitamente.

## Come approcciarti a debugging e nuove feature

- **Prima di tutto, leggi il codice esistente per il dominio più simile.** Il pattern `equipment` (firebase layer → hook → componenti/pagina) è il riferimento canonico: se aggiungi "matches" o "stats", replica la stessa struttura a tre livelli (`src/firebase/matches.js`, `src/hooks/useMatches.js`, componenti in `src/components/matches/`) invece di inventare un pattern nuovo.
- **Non introdurre backend custom**: qualunque nuova persistenza va su Firestore, seguendo la struttura `users/{uid}/<dominio>`.
- **Non toccare i colori/font hardcoded**: se serve un nuovo colore o variante, aggiungilo come custom property in `src/index.css`, non come valore hardcoded nel componente.
- **Per bug legati ai dati**: controlla prima la shape dei documenti Firestore effettivi (i modelli non sono tipizzati, quindi i campi realmente presenti sui documenti possono divergere da quanto usato nei componenti — es. `EquipmentCard.jsx` gestisce sia `item.strings?.brand` che il legacy `item.stringBrand`/`stringDate`, segno di una migrazione di schema avvenuta in corso d'opera). Non assumere che tutti i documenti abbiano lo schema più recente.
- **Per nuove feature UI**: parti da una pagina in `src/pages/` (attualmente placeholder per Home/Matches/Stats), segui il pattern hook + componenti già visto in Equipment, e integra la bottom nav solo se serve una nuova route top-level (aggiungendo la entry in `src/components/BottomNav.jsx` e la route in `src/App.jsx`).
- Il progetto è mobile-first: verifica sempre il layout a viewport stretto (max-width ~ mobile), non ottimizzare per desktop.
- Prima di considerare una feature completa, testala manualmente nel browser (`npm run dev`), specialmente per flussi che toccano Firestore (login Google, add/edit/delete equipment) — non ci sono test automatici a rete di sicurezza.
