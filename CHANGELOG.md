# Changelog

Formato ispirato a [Keep a Changelog](https://keepachangelog.com/it/1.1.0/); il progetto segue [Semantic Versioning](https://semver.org/lang/it/).

## [1.0.0] - 2026-08-17

Prima versione in produzione.

### Aggiunto
- App completa: Home, Matches (Panoramica, Partite, Tornei, Avversari, Allenamenti), Equipment, Stats (Rendimento, Attività, Tecnica, Fisico, Setup), Profile.
- Autenticazione Google via Firebase Auth, dati privati per utente su Firestore.
- Separazione tra progetto Firebase di sviluppo e di produzione.
- PWA installabile: manifest, service worker, icone per la schermata Home (Android/iOS).
- Deploy su Firebase Hosting con pipeline CI/CD su GitHub Actions — check di lint+build sulle PR verso `main`, deploy automatico in produzione al merge.
