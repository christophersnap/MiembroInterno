import { createClient } from '@supabase/supabase-js';

// Credenciales institucionales por defecto de Cruz Verde Salvadoreña
const DEFAULT_SUPABASE_URL = 'https://jdulcedfnxfwjhfdxxsk.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_Fsj872ZIHQ3AmAwwT3tD8g_1mORaBhD';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl =
  rawUrl && typeof rawUrl === 'string' && rawUrl.trim() !== ''
    ? rawUrl.trim()
    : DEFAULT_SUPABASE_URL;

const supabaseAnonKey =
  rawKey && typeof rawKey === 'string' && rawKey.trim() !== ''
    ? rawKey.trim()
    : DEFAULT_SUPABASE_ANON_KEY;

if (!rawUrl || !rawKey) {
  console.info(
    '[Supabase] Usando credenciales preconfiguradas del sistema. Para personalizar, define VITE_SUPABASE_URL en tu .env antes de compilar.'
  );
}

const RETRY_DELAYS_MS = [650, 1400, 2600, 4200];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wrapper de fetch resiliente para Supabase/PostgREST:
 * Reintenta automáticamente cuando PostgREST devuelve temporalmente HTTP 502/503/504
 * o PGRST002 ("Could not query the database for the schema cache. Retrying.") mientras
 * recarga su caché de esquema tras una migración o al despertar conexiones inactivas.
 */
const resilientSupabaseFetch: typeof fetch = async (input, init) => {
  const method = (init?.method || 'GET').toUpperCase();
  const isSafeRetryMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await fetch(input, init);

      // Si es 502/503/504 (típico de PGRST002 schema cache reload), verificar y reintentar
      if (
        (response.status === 503 || response.status === 502 || response.status === 504) &&
        attempt < RETRY_DELAYS_MS.length
      ) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }

      // Algunas pasarelas devuelven 400/500 con PGRST002 en cuerpo JSON durante recarga de esquema
      if (
        response.status >= 500 &&
        attempt < RETRY_DELAYS_MS.length &&
        response.headers.get('content-type')?.includes('application/json')
      ) {
        const cloned = response.clone();
        try {
          const errJson = await cloned.json();
          const msg = String(errJson?.message || '').toLowerCase();
          if (errJson?.code === 'PGRST002' || msg.includes('schema cache')) {
            await sleep(RETRY_DELAYS_MS[attempt]);
            continue;
          }
        } catch {}
      }

      return response;
    } catch (networkErr) {
      if (isSafeRetryMethod && attempt < 2) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw networkErr;
    }
  }

  return fetch(input, init);
};

// Inicialización segura protegida contra excepciones fatales en navegadores
let client;
try {
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: resilientSupabaseFetch,
    },
  });
} catch (err) {
  console.error('[Supabase Init Error] Error al inicializar cliente de Supabase:', err);
  client = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY, {
    global: {
      fetch: resilientSupabaseFetch,
    },
  });
}

export const supabase = client;
