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

// Errore con un `kind` che la UI traduce in una frase e un `detail` col motivo
// vero (codice dell'SDK, stato HTTP e messaggio del server, senza gli URL):
// 'offline' | 'quota' | 'denied' | 'notEnabled' | 'rejected' | 'blocked' |
// 'unavailable' | 'timeout' | 'empty' | 'failed'
export class AiError extends Error {
  constructor(kind, cause, detail = null) {
    super(kind);
    this.kind = kind;
    this.cause = cause;
    this.detail = detail;
  }
}

// «AI/fetch-error · 400 · Invalid JSON payload…»: ciò che serve a capire che cosa
// ha risposto il servizio, senza gli URL (lunghi e inutili da leggere).
function describe(err) {
  const status = err?.customErrorData?.status;
  const message = String(err?.message || '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
  return [err?.code, status, message].filter(Boolean).join(' · ') || null;
}

function classify(err) {
  const code = String(err?.code || '').toLowerCase();
  const status = Number(err?.customErrorData?.status) || 0;
  const text = `${code} ${err?.message || ''} ${status || ''}`.toLowerCase();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  if (code.includes('api-not-enabled')) return 'notEnabled';
  if (code.includes('response-error') || code.includes('invalid-content')) return 'blocked';
  if (status === 400 || text.includes('invalid_argument') || code.includes('invalid-schema') || code.includes('request-error')) return 'rejected';
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
    // In console resta l'errore intero: la UI ne mostra solo il motivo.
    console.error('[AI Logic]', err);
    throw new AiError(classify(err), err, describe(err));
  } finally {
    clearTimeout(timer);
  }
}
