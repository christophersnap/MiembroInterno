import { createClient } from '@supabase/supabase-js';

// Credenciales institucionales por defecto de Cruz Verde Salvadoreña
const DEFAULT_SUPABASE_URL = 'https://jdulcedfnxfwjhfdxxsk.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_Fsj872ZIHQ3AmAwwT3tD8g_1mORaBhD';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Si no están definidas en el build de Hostinger, usar valores institucionales para evitar pantalla blanca
const supabaseUrl = (rawUrl && typeof rawUrl === 'string' && rawUrl.trim() !== '') 
  ? rawUrl.trim() 
  : DEFAULT_SUPABASE_URL;

const supabaseAnonKey = (rawKey && typeof rawKey === 'string' && rawKey.trim() !== '') 
  ? rawKey.trim() 
  : DEFAULT_SUPABASE_ANON_KEY;

if (!rawUrl || !rawKey) {
  console.info('[Supabase] Usando credenciales preconfiguradas del sistema. Para personalizar, define VITE_SUPABASE_URL en tu .env antes de compilar.');
}

// Inicialización segura protegida contra excepciones fatales en navegadores
let client;
try {
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
} catch (err) {
  console.error('[Supabase Init Error] Error al inicializar cliente de Supabase:', err);
  // Fallback con URL válida para no romper React
  client = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);
}

export const supabase = client;
