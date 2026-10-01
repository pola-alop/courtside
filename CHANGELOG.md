# Changelog

Formato ispirato a [Keep a Changelog](https://keepachangelog.com/it/1.1.0/); il progetto segue [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

### Aggiunto
- **Import dei file Garmin (.fit o .zip)** per partite, allenamenti di tennis, corse e palestra: si sceglie il file scaricato da Garmin Connect ("Esporta originale") e l'app precompila durata, distanza, calorie, frequenza cardiaca, training effect e zone. Il file si legge sul telefono, non viene caricato né conservato.
- Dal file arrivano anche il **carico Garmin**, la velocità massima, il dislivello e, per la corsa, potenza, cadenza e dinamiche di corsa (lunghezza del passo, oscillazione verticale, contatto al suolo).
- **Curva della frequenza cardiaca** con le zone colorate nel dettaglio di ogni sessione importata; per la corsa anche passo, altitudine, potenza e percorso.
- **Corsa dal file**: la scheda eseguita diventa la struttura della corsa (fasi e ripetute), si riconosce in libreria per nome o viene creata, e data, intensità percepita e dati reali sono già compilati. Il dettaglio mostra **fase per fase** il pianificato contro il reale (tempo, passo, FC, potenza, zona).
- Il file viene rifiutato se è di uno sport diverso dalla sessione o se è già stato importato in un'altra, e avvisa se la data non coincide.
- **Corsa** come nuovo tipo di allenamento: schede a fasi e ripetute in stile Garmin (riscaldamento, corsa, camminata, recupero, riposo, defaticamento, altro), con durata a tempo, distanza, calorie o frequenza cardiaca e una zona per ogni fase.
- Libreria delle schede di corsa: una scheda si riusa tra una corsa e l'altra, si rinomina, si modifica o si elimina senza toccare le corse già registrate.
- Grafico delle fasi (durata o distanza, altezza per zona, colore per tipo di fase) con tempo totale e distanza stimati.
- Dati reali della corsa trascritti dall'orologio (durata, distanza, FC, calorie, training effect, zone), con passo medio calcolato e confronto con la stima della scheda.
- Tabella **Zone di corsa** nel Profilo (passo per zona Z1–Z5, passo di camminata, peso facoltativo): è il prerequisito per registrare corse.
- "+ Allenamento" chiede il tipo (Tennis / Corsa / Palestra); la lista Allenamenti mostra tennis, corse e palestra insieme con i filtri Tutti / Tennis / Corsa / Palestra.
- **Palestra** come nuovo tipo di allenamento: database di 110 esercizi già associati ai muscoli che coinvolgono (principali e secondari), esercizi personalizzati, schede riutilizzabili con serie, ripetizioni e kg (o secondi per gli esercizi a tempo), libreria delle schede.
- **Manichino** frontale e dorsale dei muscoli allenati, nel dettaglio di ogni sessione e nell'editor della scheda: muscolo non allenato con il colore dello sfondo, poi dal giallo (poco) al rosso (tanto) su una scala assoluta; al tocco mostra gli esercizi che lo hanno lavorato.
- **Stats › Palestra**: volume e serie a settimana, manichino su periodo e ultimi 7 giorni, muscoli trascurati, bilancio spinta/trazione, progressione del massimale stimato per esercizio e medie dei dati dell'orologio, con i relativi insight.

### Modificato
- **Zone cardiache a 7 fasce come Garmin** (Z0 riposo, Z1–Z5, Z6 oltre il massimo) in tutta l'app: dati atletici, tabella **Zone di corsa** del Profilo, zone delle fasi di corsa e statistiche Fisico. I dati salvati con 5 zone restano validi; per correre serve ora compilare anche il passo di Z0 e Z6.
- Le ore del mese nella lista Allenamenti sommano anche le sessioni di palestra.
- Le card degli allenamenti di tennis mostrano la 🎾 davanti al titolo, come la 🏃 delle corse, per riconoscere il tipo a colpo d'occhio.

### Corretto
- La sezione dei dati atletici non si rompe più quando la sessione non ha una distanza.

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
