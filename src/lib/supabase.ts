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

const RETRY_DELAYS_MS = [800, 2200];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Cortocircuito breve para evitar tormentas de reintentos si PostgREST está saturado o reiniciando
let postgrestCooldownUntil = 0;
let consecutiveServerFailures = 0;

/**
 * Wrapper de fetch resiliente y ligero para Supabase/PostgREST:
 * Reintenta de forma controlada (máx. 2 intentos, solo lecturas GET/HEAD/OPTIONS)
 * ante errores transitorios 502/503/504 o PGRST002 (schema cache), con enfriamiento
 * breve para evitar saturar la base de datos.
 */
const resilientSupabaseFetch: typeof fetch = async (input, init) => {
  const method = (init?.method || 'GET').toUpperCase();
  const isSafeRetryMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  const maxRetries = isSafeRetryMethod && Date.now() >= postgrestCooldownUntil ? RETRY_DELAYS_MS.length : 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(input, init);

      if (response.ok) {
        consecutiveServerFailures = 0;
        return response;
      }

      const isTransientGateway =
        response.status === 503 || response.status === 502 || response.status === 504;

      if (isTransientGateway) {
        consecutiveServerFailures += 1;
        if (consecutiveServerFailures >= 4) {
          postgrestCooldownUntil = Date.now() + 10000;
        }
        if (attempt < maxRetries) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        return response;
      }

      // Verificar PGRST002 (recarga temporal de caché de esquema) en respuestas 500 JSON
      if (
        response.status >= 500 &&
        attempt < maxRetries &&
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
      if (attempt < maxRetries && attempt < 1) {
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
