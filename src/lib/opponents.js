// Undicesimo modulo puro di src/lib/ (nessun React/Firestore): vocabolario
// controllato per Livello/classifica e Stile di gioco dell'anagrafica
// avversari, prima campi di testo libero. Sostituisce i valori arbitrari con
// un elenco fisso così i dropdown di AddOpponentModal/OpponentDetailModal e
// gli split di Stats condividono la stessa unica fonte di verità.

// Classificazione federale FITP: quarta categoria da 4.6 (ingresso) a 4.1,
// terza da 3.5 a 3.1, seconda da 2.8 a 2.1, poi la prima categoria
// (Nazionale). NC precede la classifica vera e propria. Elenco dal metodo di
// classificazione FITP (fitp.it, classifiche 2026).
export const LEVELS = [
  { id: 'nc',   label: 'NC (non classificato)' },
  { id: '4.6',  label: '4.6' },
  { id: '4.5',  label: '4.5' },
  { id: '4.4',  label: '4.4' },
  { id: '4.3',  label: '4.3' },
  { id: '4.2',  label: '4.2' },
  { id: '4.1',  label: '4.1' },
  { id: '3.5',  label: '3.5' },
  { id: '3.4',  label: '3.4' },
  { id: '3.3',  label: '3.3' },
  { id: '3.2',  label: '3.2' },
  { id: '3.1',  label: '3.1' },
  { id: '2.8',  label: '2.8' },
  { id: '2.7',  label: '2.7' },
  { id: '2.6',  label: '2.6' },
  { id: '2.5',  label: '2.5' },
  { id: '2.4',  label: '2.4' },
  { id: '2.3',  label: '2.3' },
  { id: '2.2',  label: '2.2' },
  { id: '2.1',  label: '2.1' },
  { id: '1cat', label: '1ª categoria (Nazionale)' },
]

export const LEVEL_BY_ID = Object.fromEntries(LEVELS.map(l => [l.id, l]))
export const levelLabel = id => LEVEL_BY_ID[id]?.label || null

// Le 5 tipologie di giocatore riconosciute dalla stessa FITP (fitp.it,
// "Giocare a tennis" › Tecnica e stili di gioco) più "Regolarista", termine
// amatoriale italiano molto diffuso per chi gioca di pura rimessa senza
// necessariamente contrattaccare — distinto dal contrattaccante da fondo.
export const PLAYSTYLES = [
  { id: 'regolarista',      label: 'Regolarista (di rimessa)' },
  { id: 'contrattaccante',  label: 'Contrattaccante da fondo' },
  { id: 'aggressivo-fondo', label: 'Aggressivo da fondo campo' },
  { id: 'attacco',          label: "Giocatore d'attacco (servizio potente)" },
  { id: 'serve-volley',     label: 'Serve & volley' },
  { id: 'completo',         label: 'Completo (a tutto campo)' },
]

export const PLAYSTYLE_BY_ID = Object.fromEntries(PLAYSTYLES.map(p => [p.id, p]))
export const playstyleLabel = id => PLAYSTYLE_BY_ID[id]?.label || null
