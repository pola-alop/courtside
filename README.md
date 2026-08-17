# 🎾 Courtside

![Deploy](https://github.com/pola-alop/courtside/actions/workflows/firebase-hosting-merge.yml/badge.svg)

**Il compagno personale di chi gioca a tennis.** Tieni traccia di partite, allenamenti e attrezzatura, e lascia che sia l'app a dirti come stai andando davvero — non solo "ho vinto o perso", ma *come* ci sei arrivato.

<!--
🔗 **Prova l'app**: [courtside-7e67b.web.app](https://courtside-7e67b.web.app) — accedi con il tuo account Google, i tuoi dati restano privati e legati solo a te.
-->

<!--
📱 SCREENSHOT — sostituire con le immagini reali una volta raccolte dall'uso su mobile.
Percorso consigliato: docs/screenshots/<nome>.png (150–200px di larghezza consigliata per la tabella).
-->

<p align="center">
  <img src="docs/screenshots/home.png" alt="Schermata Home" width="180" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/matches.png" alt="Schermata Partite" width="180" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/stats.png" alt="Schermata Statistiche" width="180" />
</p>

<p align="center"><em>📸 Screenshot in arrivo — presto qui vedrai l'app dal vivo.</em></p>

---

## Perché Courtside

Ogni tennista amatoriale ha un taccuino mentale fatto di sensazioni sparse: "sento che sto reggendo meglio i punti lunghi", "le corde di questa racchetta mi sembrano morte", "non lavoro il rovescio da un'eternità". Courtside prende quelle sensazioni e le trasforma in numeri veri, calcolati sui dati che registri tu — niente sensori, niente wearable obbligatori, solo quello che scrivi dopo una partita o un allenamento.

Tre principi guidano tutto:

- **Zero attrito.** Registrare una partita o un allenamento richiede pochi tap. Ogni campo in più che chiediamo è un motivo in più per smettere di usare l'app dopo due settimane — e lo abbiamo tenuto sempre a mente.
- **Onestà sui numeri.** Se il campione è troppo piccolo per dire qualcosa, l'app te lo dice invece di mostrarti una percentuale a caso. Meglio "mancano 4 partite per essere sicuro" che un numero bello ma falso.
- **I tuoi dati sono tuoi.** Login con Google, storage privato per account, nessun dato condiviso con altri utenti, nessun backend di terze parti.

## Cosa puoi fare

### 🏠 Home — il colpo d'occhio di adesso
La prima cosa che vedi aprendo l'app: il tuo ritmo attuale, cosa registrare al volo, gli avvisi che contano davvero (corde da cambiare, carico sospetto, un colpo trascurato da settimane) e la tua ultima sessione. Niente grafici, niente scelta di periodo — solo "adesso".

<!-- <img src="docs/screenshots/home.png" alt="Home" width="220" /> -->

### 🎾 Matches — partite, tornei e avversari
Registra ogni partita con punteggio set per set, tipo (amichevole, campionato, torneo) e superficie. L'app costruisce da sola:
- una **Panoramica** degli ultimi 30 giorni, sempre aggiornata;
- il **cammino nei tornei**, turno per turno, fino alla finale — senza dover disegnare il tabellone a mano;
- una **scheda per ogni avversario**, con il record testa a testa calcolato automaticamente;
- lo storico dei tuoi **allenamenti**, con blocchi, focus tecnico e sensazioni.

<!-- <img src="docs/screenshots/matches.png" alt="Matches" width="220" /> -->

### 🎒 Equipment — la tua attrezzatura, viva
Racchette, scarpe, corde, outfit: aggiungili dal catalogo o a mano, e guarda l'usura calcolata sul gioco *reale* — partite e allenamenti — invece di una stima a occhio. Sai sempre quando è il momento di ricordare, prima che te lo dica la racchetta stessa.

<!-- <img src="docs/screenshots/equipment.png" alt="Equipment" width="220" /> -->

### 📊 Stats — le domande a cui rispondi davvero
Cinque sezioni, ognuna dedicata a una domanda concreta invece che a un dataset:

| Sezione | Risponde a... |
|---|---|
| **Rendimento** | Quanto sono forte, e come vinco o perdo? |
| **Attività** | Quanto gioco, e con quanta costanza? |
| **Tecnica** | Su cosa sto lavorando, e sta funzionando? |
| **Fisico** | Come sto fisicamente, e sto migliorando? |
| **Setup** | La mia attrezzatura cambia davvero qualcosa? |

Ogni numero è cliccabile e apre le partite o sessioni che l'hanno generato — niente statistiche calate dall'alto senza sapere da dove vengono.

<!-- <img src="docs/screenshots/stats.png" alt="Stats" width="220" /> -->

### 👤 Profile
I tuoi dati anagrafici tennistici — mano, livello, anzianità di gioco — per personalizzare l'analisi.

## Installala come app

Courtside è una **PWA**: apri il link da mobile (Android o iOS), scegli "Aggiungi a schermata Home" e la userai come una app nativa, icona compresa — nessuno store, nessun aggiornamento manuale.

## Sviluppo

Per i dettagli tecnici (stack, architettura, come contribuire in locale) vedi [CLAUDE.md](./CLAUDE.md). In breve:

```bash
git clone https://github.com/pola-alop/courtside.git
cd courtside
npm install
cp .env.example .env.development.local   # compila con le credenziali del tuo progetto Firebase di dev
npm run dev
```

Deploy automatico su `main` via GitHub Actions verso Firebase Hosting.
