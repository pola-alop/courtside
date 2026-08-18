# Changelog

Formato ispirato a [Keep a Changelog](https://keepachangelog.com/it/1.1.0/); il progetto segue [Semantic Versioning](https://semver.org/lang/it/).

## [1.1.0] - 2026-08-18

### Aggiunto
- Modifica delle voci dello storico incordature (marca, modello, tensioni, data), non più solo eliminazione — con guardia che impedisce di impostare una data futura o successiva all'incordatura attuale.
- "Livello/Classifica" e "Stile di gioco" degli avversari sono ora dropdown a vocabolario fisso basato sulle categorie FITP, al posto del testo libero (i valori legacy incompatibili vengono azzerati al primo caricamento e richiedono una nuova selezione).
- Elenco avversari ordinato alfabeticamente, sia nella lista sia nei menu a tendina di partite/allenamenti.
- Pagina di login tradotta in italiano, per coerenza con il resto dell'app.

### Modificato
- Aggiunto respiro visivo tra la data e il badge risultato (Vittoria/Sconfitta/Pareggio) nelle card partite e nel dettaglio.

### Corretto
- Risolto il salvataggio di Setup (outfit) e Gear Bag in Equipment, che non registrava alcuna modifica.
- Risolto il troncamento del nome avversario nel tabellone punteggio (ScoreBoard) su nomi corti/senza cognome.
- Risolto l'overflow della descrizione torneo nelle card partita su mobile.
- Risolto l'overflow dei filtri (Tipo/Superficie/Categoria) su mobile nella sezione Matches > Partite.
- Risolto l'overflow dei contenuti delle card torneo oltre i propri bordi.
- La prima lettera del nome utente nel saluto della Home e nel messaggio di onboarding è ora sempre maiuscola, indipendentemente dalla formattazione del nome Google.

## [1.0.0] - 2026-08-17

Prima versione in produzione.

### Aggiunto
- App completa: Home, Matches (Panoramica, Partite, Tornei, Avversari, Allenamenti), Equipment, Stats (Rendimento, Attività, Tecnica, Fisico, Setup), Profile.
- Autenticazione Google via Firebase Auth, dati privati per utente su Firestore.
- Separazione tra progetto Firebase di sviluppo e di produzione.
- PWA installabile: manifest, service worker, icone per la schermata Home (Android/iOS).
- Deploy su Firebase Hosting con pipeline CI/CD su GitHub Actions — check di lint+build sulle PR verso `main`, deploy automatico in produzione al merge.
