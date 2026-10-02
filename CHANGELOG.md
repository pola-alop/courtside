# Changelog

Formato ispirato a [Keep a Changelog](https://keepachangelog.com/it/1.1.0/); il progetto segue [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

### Aggiunto
- **Tenuta nelle ripetute e deriva cardiaca** dai dati del file Garmin. In Stats › Corsa: per ogni gruppo di ripetute il passo della prima contro quello dell'ultima (con la FC e la linea di tutte le ripetizioni), la stessa scheda nel tempo, e la deriva cardiaca delle corse continue (quanto sale il battito a parità di velocità nella seconda metà). In Stats › Fisico: il battito medio per terzo di partita. I blocchi sono chiusi e scaricano i dettagli solo quando li apri, dicendoti quante letture costano; usano le ultime 40 sessioni del periodo.
- **Stats › Incroci**: nuovo tab che mette in relazione corsa e palestra con il tennis. Per ogni partita e allenamento guarda cosa hai fatto nei 7 giorni prima (ieri o l'altro ieri, da 3 a 7 giorni, niente) e lo legge nei game vinti, nel voto ai colpi e nella frequenza cardiaca a parità di velocità; si può scegliere se confrontare palestra, palestra con le gambe, corsa o corsa dura. Aggiunge il rendimento per fascia di ACWR con cui si arriva alla partita, la relazione tra km corsi (o palestre) delle ultime 4 settimane e il cuore in campo, e il confronto tra l'intensità dichiarata e il carico Garmin. Ogni gruppo dichiara il campione e sotto soglia non parla.
- **Intensità suggerita dall'orologio** per partite e allenamenti di tennis: dal training effect e dal tempo nelle zone alte compare «Dall'orologio sembra intensa» con un tap per confermare; non viene salvata se non la confermi. Le soglie si adattano da sole alle tue partite (confine a metà tra le medie dei tuoi livelli, con almeno 3 partite per livello e senza contare quelle confermate con «Usa»), e in Stats › Incroci un nuovo blocco «Le tue intensità» mostra training effect e tempo in zone alte per ogni intensità, i confini in uso e quanto il suggerimento avrebbe indovinato. Se l'orologio ha registrato lo sforzo dichiarato, l'import lo usa per la partita come già per corsa e palestra.
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
- **Stats › Corsa**: nuovo tab con volume, costanza, passo delle corse continue e confronto della stessa scheda nel tempo, efficienza cardiaca (la FC a parità di velocità), intensità (quanto del tempo è facile e quanto duro), training effect e carico Garmin, potenza e dinamiche di corsa, record. Tutto dai dati dell'orologio, niente è stimato.
- **Stats › Palestra** ampliata: costanza, esercizi più fatti e fasce di ripetizioni (forza, ipertrofia, resistenza), record battuti nel periodo, e un blocco «Dall'orologio» che distingue le sessioni dal file da quelle a mano e aggiunge zone cardiache, carico Garmin, serie all'ora e riposo medio stimato tra le serie.
- **Stats › Fisico**: la copertura dice quante sessioni vengono dal file .FIT e quante sono trascritte; le note su velocità ed economia cardiaca dicono per quanti allenamenti la durata è quella misurata dall'orologio.
- **Stats › Palestra**: volume e serie a settimana, manichino su periodo e ultimi 7 giorni, muscoli trascurati, bilancio spinta/trazione, progressione del massimale stimato per esercizio e medie dei dati dell'orologio, con i relativi insight.

### Modificato
- **Il carico è di tutto il corpo**: ACWR, monotonia e strain di Stats › Attività e l'avviso di carico in Home contano ora anche corsa e palestra (durata × intensità, durata stimata dalla scheda quando manca l'orologio). Le barre del carico settimanale sono impilate per dominio. Ore in campo, costanza e mix restano solo di tennis.
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
