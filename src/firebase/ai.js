import { app } from './config';
import { SUMMARY_MODEL, sanitizeSummary } from '../lib/planSummary';

// Chiamata a Gemini (Developer API) tramite Firebase AI Logic: nessun backend
// nostro, nessuna chiave nel codice, protezione con App Check (vedi config.js).
// L'SDK `firebase/ai` si carica solo alla prima richiesta (import dinamico):
// non pesa sul bundle iniziale dell'app.
//
// REGOLA DA NON ROMPERE: il progetto resta su Spark, senza account di
// fatturazione. Oltre la quota la chiamata fallisce (429) e basta.

const TIMEOUT_MS = 45000;

// Errore con un `kind` che la UI traduce in una frase:
// 'offline' | 'quota' | 'denied' | 'unavailable' | 'timeout' | 'empty' | 'failed'
export class AiError extends Error {
  constructor(kind, cause) {
    super(kind);
    this.kind = kind;
    this.cause = cause;
  }
}

function classify(err) {
  const text = `${err?.code || ''} ${err?.message || ''} ${err?.customErrorData?.status || ''}`.toLowerCase();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  if (text.includes('429') || text.includes('quota') || text.includes('resource exhausted') || text.includes('resource_exhausted')) return 'quota';
  if (text.includes('403') || text.includes('permission') || text.includes('app check') || text.includes('appcheck')) return 'denied';
  if (text.includes('404') || text.includes('not found') || text.includes('503') || text.includes('unavailable') || text.includes('overloaded')) return 'unavailable';
  if (text.includes('network') || text.includes('failed to fetch')) return 'offline';
  return 'failed';
}

// Genera il riassunto. `pack` è il risultato di `buildPrompt` (system, prompt,
// focusIds). Ritorna `{ summary, highlights, suggestedFocus }` già ripulito.
export async function generatePlanSummary(pack) {
  let timer;
  try {
    const run = (async () => {
      const { getAI, getGenerativeModel, GoogleAIBackend, Schema } = await import('firebase/ai');
      const ai = getAI(app, { backend: new GoogleAIBackend() });
      const model = getGenerativeModel(ai, {
        model: SUMMARY_MODEL,
        systemInstruction: pack.system,
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
          responseSchema: Schema.object({
            properties: {
              summary: Schema.string(),
              highlights: Schema.array({ items: Schema.string() }),
              suggestedFocus: Schema.array({ items: Schema.enumString({ enum: pack.focusIds }) }),
            },
          }),
        },
      });
      const result = await model.generateContent(pack.prompt);
      return result.response.text();
    })();
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new AiError('timeout')), TIMEOUT_MS);
    });
    const text = await Promise.race([run, timeout]);
    const clean = sanitizeSummary(text);
    if (!clean) throw new AiError('empty');
    return clean;
  } catch (err) {
    if (err instanceof AiError) throw err;
    throw new AiError(classify(err), err);
  } finally {
    clearTimeout(timer);
  }
}
