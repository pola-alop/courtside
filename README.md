# Courtside

![Deploy](https://github.com/pola-alop/courtside/actions/workflows/firebase-hosting-merge.yml/badge.svg)

**Courtside** è una web app **PWA mobile-first** pensata come compagno personale per chi gioca a tennis: tiene traccia di attrezzatura, partite, allenamenti e statistiche, tutto legato al proprio account Google.

🔗 **App live**: [courtside-7e67b.web.app](https://courtside-7e67b.web.app)

## Screenshot

> 📱 Le screenshot da mobile arriveranno nella v1.0.1, una volta raccolte dall'uso reale.

<!--
Una volta pronte, decommentare:

| Home | Matches | Stats |
|---|---|---|
| ![Home](docs/screenshots/home.png) | ![Matches](docs/screenshots/matches.png) | ![Stats](docs/screenshots/stats.png) |
-->

## Cos'è

L'utente si autentica con Google e i suoi dati (racchette, scarpe, corde, partite, allenamenti, profilo) vengono salvati privatamente nel proprio account Firebase — nessun dato condiviso tra utenti, nessun backend custom.

Le sezioni principali, navigabili dalla bottom nav:

- **Home** — la schermata di "adesso": ritmo attuale, azioni rapide di registrazione, avvisi azionabili, ultima sessione, continuità.
- **Matches** — Panoramica (sintesi mobile a 30 giorni), Partite, Tornei (palmarès + cammino nel tabellone), Avversari, Allenamenti.
- **Equipment** — gestione racchette/scarpe/outfit/borsoni, con usura calcolata dal gioco reale (partite **e** allenamenti).
- **Stats** — analisi su 5 dimensioni: Rendimento, Attività, Tecnica, Fisico, Setup.
- **Profile** — dati anagrafici tennistici (mano, livello, età, anzianità di gioco).

## Stack tecnico

| Livello | Scelta |
|---|---|
| Frontend | React 19 + Vite 8, niente TypeScript |
| Styling | Tailwind v4 (solo layout/spacing — colori e font via CSS custom properties) |
| Routing | React Router v7, client-side |
| Backend | Firebase Auth (solo Google Sign-In) + Firestore — nessuna REST API propria |
| PWA | `vite-plugin-pwa` — manifest + service worker, installabile su home screen (Android/iOS) |
| Hosting | Firebase Hosting |
| CI/CD | GitHub Actions — lint + build sulle PR verso `main`, deploy automatico in produzione al merge |

## Architettura

Nessuno state manager globale: ogni dominio (equipment, matches, trainings, ...) segue lo stesso pattern a tre livelli — `src/firebase/*.js` (query/mutation Firestore pure) → `src/hooks/use*.js` (stato React + orchestrazione) → componenti in `src/pages`/`src/components` (mai Firestore diretto). Le decisioni di design, le convenzioni e il perché di ogni scelta non ovvia sono documentate in dettaglio in [`CLAUDE.md`](./CLAUDE.md).

## Sviluppo locale

```bash
git clone https://github.com/pola-alop/courtside.git
cd courtside
npm install

# Serve un progetto Firebase dedicato al dev (separato da quello di produzione,
# per non mescolare dati di test con quelli reali). Vedi .env.example.
cp .env.example .env.development.local
# compila .env.development.local con le credenziali del tuo progetto Firebase

npm run dev      # http://localhost:5173, modalità development
npm run lint      # eslint
npm run build     # build di produzione (legge .env.production.local)
npm run preview   # serve la build di produzione in locale
```

## Branch e deploy

- `dev` — sviluppo. Ogni push non tocca la produzione.
- `main` — produzione. Ogni PR `dev → main` fa partire un check automatico (lint + build + preview su un URL temporaneo); al merge, un secondo workflow builda e pubblica su Firebase Hosting.

Nessun passaggio manuale oltre aprire e mergiare la PR: le credenziali Firebase per la build sono in GitHub Secrets, il deploy usa un service account dedicato.
