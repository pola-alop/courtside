import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

// ── App Check ───────────────────────────────────────────────
// Dal 2026-11-02 Firebase AI Logic richiede un token App Check valido (senza,
// la chiamata al modello risponde 403): è ciò che impedisce a chi copia la
// chiave web dal bundle di consumare la quota. Viene inizializzato prima degli
// altri servizi, come chiede la documentazione.
//  · in SVILUPPO (`npm run dev`) con `VITE_APPCHECK_DEBUG_TOKEN` si usa il
//    provider di debug: il token va registrato nella console (App Check › Apps ›
//    Manage debug tokens). Il valore sta solo in `.env.development.local` e il
//    ramo è guardato da `import.meta.env.DEV`, quindi non entra mai nella build.
//  · in PRODUZIONE serve `VITE_RECAPTCHA_SITE_KEY` (chiave reCAPTCHA Enterprise
//    di tipo Web). Senza chiave App Check non parte e le funzioni AI falliscono
//    con un messaggio: il resto dell'app non ne risente.
const debugToken = import.meta.env.DEV ? import.meta.env.VITE_APPCHECK_DEBUG_TOKEN : undefined;
const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

if (debugToken || siteKey) {
  if (debugToken) self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey || 'debug'),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
