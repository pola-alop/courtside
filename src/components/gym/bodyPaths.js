// Tracciati SVG del manichino. Disegno originale e semplificato: una figura
// frontale e una dorsale sulla stessa griglia (0..200 di larghezza, asse di
// simmetria a x = 100, 0..420 di altezza).
//
// Si disegna SOLO la metà sinistra (x ≤ 100): il componente la specchia con
// una trasformazione per ottenere la destra. I muscoli lungo l'asse (addominali,
// lombari) sono comunque metà-forma specchiate, che si toccano al centro.
//
// `id` è quello dei MUSCLES di lib/gym.js. Un muscolo può comparire su entrambe
// le figure (trapezio, spalle, avambracci): si accende su tutte e due.

// Sagome del corpo (metà sinistra). Si disegnano due volte: prima con il
// contorno, poi con il riempimento, così il contorno è solo quello esterno
// dell'unione.
export const SILHOUETTE = [
  // busto fino al bacino
  'M100 60 C90 62 78 68 66 75 C62 90 64 112 68 132 C72 160 76 182 78 202 C74 212 68 224 66 238 L100 238 Z',
  // gamba e piede
  'M100 234 L66 234 C61 262 65 302 71 328 C67 346 67 364 72 380 C74 388 75 393 75 398 L69 411 C68 418 88 418 92 414 L91 398 C91 388 94 372 95 356 C95 346 94 336 91 328 C95 302 99 270 100 246 Z',
  // braccio e mano
  'M64 76 C54 76 45 84 43 99 C39 124 37 146 35 161 C31 190 26 214 22 232 C15 240 13 250 15 256 L31 256 C35 250 37 241 41 233 C47 211 53 187 57 161 C61 141 65 121 69 100 Z',
  // collo
  'M90 46 L110 46 L112 66 L88 66 Z',
]

export const HEAD = { cx: 100, cy: 29, rx: 18, ry: 24 }

// Dettagli di scultura (linee scure sopra i muscoli): stanghette degli
// addominali, separazioni. Non sono interattivi.
export const FRONT_DETAILS = [
  'M84 160 L98 160', 'M83 178 L98 178', 'M83 195 L98 195',
]
export const BACK_DETAILS = [
  'M98 70 L98 186',
]

export const FRONT = [
  { id: 'trapezio',     d: 'M92 64 C85 68 76 72 67 77 L74 84 C81 79 88 75 96 72 Z' },
  { id: 'spalle',       d: 'M66 77 C56 77 47 84 45 97 C44 109 47 119 53 127 C59 119 63 109 66 101 C67 92 67 84 66 77 Z' },
  { id: 'petto',        d: 'M98 80 L71 84 C68 98 70 112 76 122 C84 130 92 132 98 130 Z' },
  { id: 'bicipiti',     d: 'M50 124 L64 111 L62 137 L57 159 L41 158 C42 145 45 133 50 124 Z' },
  { id: 'avambracci',   d: 'M41 164 L56 162 C54 187 48 208 42 230 L27 227 C32 207 38 186 41 164 Z' },
  { id: 'obliqui',      d: 'M71 128 C78 134 82 138 82 142 L82 201 C76 203 71 202 69 197 C68 172 68 150 71 128 Z' },
  { id: 'addominali',   d: 'M98 136 C91 136 85 139 84 145 L84 200 C86 206 92 210 98 210 Z' },
  { id: 'adduttori',    d: 'M94 252 L99 246 C100 274 98 300 93 320 L91 318 C94 298 95 274 94 252 Z' },
  { id: 'quadricipiti', d: 'M92 256 C84 247 76 247 70 253 C66 273 68 303 76 324 C82 328 88 326 90 322 C92 300 94 274 92 256 Z' },
]

export const BACK = [
  { id: 'trapezio',     d: 'M98 64 C88 68 76 74 67 77 C73 92 86 106 98 122 Z' },
  { id: 'spalle',       d: 'M66 77 C56 77 47 84 45 97 C44 109 47 119 53 127 C59 119 63 109 66 101 C67 92 67 84 66 77 Z' },
  { id: 'dorsali',      d: 'M67 108 C75 116 88 124 98 128 L98 184 C92 190 84 192 80 188 C72 168 67 134 67 108 Z' },
  { id: 'lombari',      d: 'M98 190 C90 190 84 192 82 195 C82 205 88 212 98 216 Z' },
  { id: 'tricipiti',    d: 'M47 112 L65 108 L62 138 L57 159 L41 158 C40 141 43 125 47 112 Z' },
  { id: 'avambracci',   d: 'M41 164 L56 162 C54 187 48 208 42 230 L27 227 C32 207 38 186 41 164 Z' },
  { id: 'glutei',       d: 'M98 218 C88 214 78 216 72 224 C68 234 70 246 78 254 C88 258 96 254 98 250 Z' },
  { id: 'femorali',     d: 'M97 260 C88 262 78 260 72 256 C68 278 70 305 77 324 C83 328 89 326 92 322 C95 302 98 280 97 260 Z' },
  { id: 'polpacci',     d: 'M79 335 C71 343 69 361 74 382 C78 389 85 389 90 383 C95 366 94 347 89 335 Z' },
]
