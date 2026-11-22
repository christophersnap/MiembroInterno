import { supabase } from './supabase';
import { getElSalvadorIsoTimestamp } from '../utils/dateUtils';
import { getApiUrl } from './api';

export type CountdownPosition = 'izquierda' | 'centro' | 'derecha';
export type CountdownFontKey = 'jakarta' | 'outfit' | 'oswald' | 'playfair' | 'antonio' | 'jetbrains';
export type CountdownTitleSize = 'sm' | 'md' | 'lg';
export type CountdownLayoutMode = 'grid' | 'stack';

export interface NoticiaCountdown {
  id: string;
  nombre_evento: string;
  etiqueta_superior?: string | null;
  subtitulo?: string | null;
  fecha_objetivo: string; // ISO string
  texto_finalizado?: string | null;
  mostrar_meses: boolean;
  imagen_url?: string | null;
  logo_url?: string | null;
  posicion_imagen: CountdownPosition;
  posicion_logo: CountdownPosition;
  posicion_conteo: CountdownPosition;
  tipografia: CountdownFontKey;
  tamano_titulo: CountdownTitleSize;
  color_fondo: string;
  color_fondo_secundario: string;
  usar_gradiente: boolean;
  color_texto: string;
  color_acento: string;
  color_caja_tiempo: string;
  color_texto_tiempo: string;
  enlace_url?: string | null;
  enlace_texto?: string | null;
  activo: boolean;
  orden: number;
  autor_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface NoticiasCountdownConfig {
  activo: boolean;
  layout: CountdownLayoutMode;
}

export const DEFAULT_COUNTDOWN_CONFIG: NoticiasCountdownConfig = {
  activo: true,
  layout: 'grid',
};

export const COUNTDOWN_FONT_OPTIONS: Array<{
  key: CountdownFontKey;
  label: string;
  sample: string;
  cssFamily: string;
}> = [
  {
    key: 'jakarta',
    label: 'Plus Jakarta Sans',
    sample: 'Institucional Moderna',
    cssFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  {
    key: 'outfit',
    label: 'Outfit',
    sample: 'Geométrica Limpia',
    cssFamily: "'Outfit', system-ui, sans-serif",
  },
  {
    key: 'oswald',
    label: 'Oswald',
    sample: 'Condensada Impacto',
    cssFamily: "'Oswald', system-ui, sans-serif",
  },
  {
    key: 'antonio',
    label: 'Antonio',
    sample: 'Display Evento',
    cssFamily: "'Antonio', system-ui, sans-serif",
  },
  {
    key: 'playfair',
    label: 'Playfair Display',
    sample: 'Editorial Ceremonial',
    cssFamily: "'Playfair Display', Georgia, serif",
  },
  {
    key: 'jetbrains',
    label: 'JetBrains Mono',
    sample: 'Técnica / Digital',
    cssFamily: "'JetBrains Mono', ui-monospace, monospace",
  },
];

export interface CountdownThemePreset {
  id: string;
  name: string;
  color_fondo: string;
  color_fondo_secundario: string;
  usar_gradiente: boolean;
  color_texto: string;
  color_acento: string;
  color_caja_tiempo: string;
  color_texto_tiempo: string;
}

export const COUNTDOWN_THEME_PRESETS: CountdownThemePreset[] = [
  {
    id: 'cruz-verde',
    name: 'Cruz Verde Institucional',
    color_fondo: '#064e3b',
    color_fondo_secundario: '#0f172a',
    usar_gradiente: true,
    color_texto: '#ffffff',
    color_acento: '#34d399',
    color_caja_tiempo: '#022c22',
    color_texto_tiempo: '#ffffff',
  },
  {
    id: 'claro-editorial',
    name: 'Claro Minimalista',
    color_fondo: '#ffffff',
    color_fondo_secundario: '#f1f5f9',
    usar_gradiente: true,
    color_texto: '#0f172a',
    color_acento: '#047857',
    color_caja_tiempo: '#0f172a',
    color_texto_tiempo: '#ffffff',
  },
  {
    id: 'operativo-rojo',
    name: 'Alerta / Emergencia',
    color_fondo: '#7f1d1d',
    color_fondo_secundario: '#18181b',
    usar_gradiente: true,
    color_texto: '#ffffff',
    color_acento: '#fca5a5',
    color_caja_tiempo: '#450a0a',
    color_texto_tiempo: '#ffffff',
  },
  {
    id: 'azul-comando',
    name: 'Azul Operativo',
    color_fondo: '#0f172a',
    color_fondo_secundario: '#1e3a8a',
    usar_gradiente: true,
    color_texto: '#f8fafc',
    color_acento: '#38bdf8',
    color_caja_tiempo: '#172554',
    color_texto_tiempo: '#ffffff',
  },
  {
    id: 'gala-dorada',
    name: 'Aniversario / Gala',
    color_fondo: '#18181b',
    color_fondo_secundario: '#27272a',
    usar_gradiente: true,
    color_texto: '#fafaf9',
    color_acento: '#fbbf24',
    color_caja_tiempo: '#09090b',
    color_texto_tiempo: '#fde68a',
  },
];

const LS_COUNTDOWNS_KEY = 'cv_noticias_countdown_list';
const LS_COUNTDOWN_CFG_KEY = 'cv_noticias_countdown_config';

export function getCountdownFontFamily(key?: string | null): string {
  const found = COUNTDOWN_FONT_OPTIONS.find((f) => f.key === key);
  return found ? found.cssFamily : COUNTDOWN_FONT_OPTIONS[0].cssFamily;
}

export interface CountdownRemaining {
  finished: boolean;
  months: number;
  days: number;
  totalDays: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Calcula tiempo restante con meses calendario exactos + días + horas + minutos + segundos.
 */
export function calculateCountdownRemaining(
  targetIso: string,
  includeMonths = true,
  nowMs = Date.now()
): CountdownRemaining {
  const targetDate = new Date(targetIso);
  if (isNaN(targetDate.getTime())) {
    return { finished: true, months: 0, days: 0, totalDays: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const diffMs = targetDate.getTime() - nowMs;
  if (diffMs <= 0) {
    return { finished: true, months: 0, days: 0, totalDays: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const totalDays = Math.floor(diffMs / 86400000);

  if (!includeMonths) {
    const days = totalDays;
    const remAfterDays = diffMs % 86400000;
    const hours = Math.floor(remAfterDays / 3600000);
    const remAfterHours = remAfterDays % 3600000;
    const minutes = Math.floor(remAfterHours / 60000);
    const seconds = Math.floor((remAfterHours % 60000) / 1000);
    return { finished: false, months: 0, days, totalDays, hours, minutes, seconds };
  }

  const nowDate = new Date(nowMs);
  let cursor = new Date(nowDate.getTime());
  let months = 0;

  // Avanzar meses calendario completos sin pasarse de targetDate
  while (months < 120) {
    const next = new Date(cursor.getTime());
    const targetMonth = next.getMonth() + 1;
    const origDay = nowDate.getDate();
    next.setDate(1);
    next.setMonth(targetMonth);
    const maxDaysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(origDay, maxDaysInMonth));

    if (next.getTime() <= targetDate.getTime()) {
      months += 1;
      cursor = next;
    } else {
      break;
    }
  }

  const remMs = Math.max(0, targetDate.getTime() - cursor.getTime());
  const days = Math.floor(remMs / 86400000);
  const remAfterDays = remMs % 86400000;
  const hours = Math.floor(remAfterDays / 3600000);
  const remAfterHours = remAfterDays % 3600000;
  const minutes = Math.floor(remAfterHours / 60000);
  const seconds = Math.floor((remAfterHours % 60000) / 1000);

  return { finished: false, months, days, totalDays, hours, minutes, seconds };
}

function normalizePosition(val: any, fallback: CountdownPosition): CountdownPosition {
  if (val === 'izquierda' || val === 'centro' || val === 'derecha') return val;
  return fallback;
}

function normalizeCountdown(row: any): NoticiaCountdown {
  return {
    id: String(row.id),
    nombre_evento: row.nombre_evento || 'Evento Institucional',
    etiqueta_superior: row.etiqueta_superior ?? 'Próximo Evento',
    subtitulo: row.subtitulo || null,
    fecha_objetivo: row.fecha_objetivo || getElSalvadorIsoTimestamp(new Date(Date.now() + 7 * 86400000)),
    texto_finalizado: row.texto_finalizado || '¡El evento ha comenzado!',
    mostrar_meses: row.mostrar_meses === undefined ? true : Boolean(row.mostrar_meses),
    imagen_url: row.imagen_url || null,
    logo_url: row.logo_url || null,
    posicion_imagen: normalizePosition(row.posicion_imagen, 'izquierda'),
    posicion_logo: normalizePosition(row.posicion_logo, 'izquierda'),
    posicion_conteo: normalizePosition(row.posicion_conteo, 'derecha'),
    tipografia: COUNTDOWN_FONT_OPTIONS.some((f) => f.key === row.tipografia) ? row.tipografia : 'jakarta',
    tamano_titulo: row.tamano_titulo === 'sm' || row.tamano_titulo === 'lg' ? row.tamano_titulo : 'md',
    color_fondo: row.color_fondo || '#064e3b',
    color_fondo_secundario: row.color_fondo_secundario || '#0f172a',
    usar_gradiente: row.usar_gradiente === undefined ? true : Boolean(row.usar_gradiente),
    color_texto: row.color_texto || '#ffffff',
    color_acento: row.color_acento || '#34d399',
    color_caja_tiempo: row.color_caja_tiempo || '#022c22',
    color_texto_tiempo: row.color_texto_tiempo || '#ffffff',
    enlace_url: row.enlace_url || null,
    enlace_texto: row.enlace_texto || 'Ver más detalles',
    activo: row.activo === undefined ? true : Boolean(row.activo),
    orden: Number(row.orden ?? 0),
    autor_id: row.autor_id || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function fetchNoticiasCountdownData(includeInactive = false): Promise<{
  countdowns: NoticiaCountdown[];
  config: NoticiasCountdownConfig;
  source: 'supabase' | 'api' | 'local';
}> {
  let config: NoticiasCountdownConfig = { ...DEFAULT_COUNTDOWN_CONFIG };
  try {
    const rawCfg = localStorage.getItem(LS_COUNTDOWN_CFG_KEY);
    if (rawCfg) config = { ...config, ...JSON.parse(rawCfg) };
  } catch {}

  try {
    const { data: cfgRows } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .in('clave', ['noticias_countdown_activo', 'noticias_countdown_layout']);

    if (cfgRows && cfgRows.length > 0) {
      cfgRows.forEach((r) => {
        if (r.clave === 'noticias_countdown_activo') config.activo = r.valor !== 'false';
        if (r.clave === 'noticias_countdown_layout') {
          config.layout = r.valor === 'stack' ? 'stack' : 'grid';
        }
      });
      try {
        localStorage.setItem(LS_COUNTDOWN_CFG_KEY, JSON.stringify(config));
      } catch {}
    }
  } catch {
    try {
      const res = await fetch(getApiUrl('/api/configuracion'));
      if (res.ok) {
        const obj = await res.json();
        if (obj.noticias_countdown_activo !== undefined) {
          config.activo = obj.noticias_countdown_activo !== 'false';
        }
        if (obj.noticias_countdown_layout !== undefined) {
          config.layout = obj.noticias_countdown_layout === 'stack' ? 'stack' : 'grid';
        }
      }
    } catch {}
  }

  try {
    let query = supabase
      .from('noticias_countdown')
      .select('*')
      .order('orden', { ascending: true })
      .order('fecha_objetivo', { ascending: true });

    if (!includeInactive) {
      query = query.eq('activo', true);
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      const countdowns = data.map(normalizeCountdown);
      if (includeInactive) {
        try {
          localStorage.setItem(LS_COUNTDOWNS_KEY, JSON.stringify(countdowns));
        } catch {}
      }
      return { countdowns, config, source: 'supabase' };
    }
  } catch {}

  try {
    const res = await fetch(
      getApiUrl(`/api/noticias-countdown${includeInactive ? '?all=true' : ''}`)
    );
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows)) {
        const countdowns = rows.map(normalizeCountdown);
        return { countdowns, config, source: 'api' };
      }
    }
  } catch {}

  try {
    const raw = localStorage.getItem(LS_COUNTDOWNS_KEY);
    if (raw) {
      const all = (JSON.parse(raw) as any[]).map(normalizeCountdown);
      const countdowns = includeInactive ? all : all.filter((c) => c.activo);
      return { countdowns, config, source: 'local' };
    }
  } catch {}

  return { countdowns: [], config, source: 'local' };
}

export async function saveNoticiasCountdownConfig(config: NoticiasCountdownConfig): Promise<void> {
  try {
    localStorage.setItem(LS_COUNTDOWN_CFG_KEY, JSON.stringify(config));
  } catch {}

  const entries = [
    {
      clave: 'noticias_countdown_activo',
      valor: config.activo ? 'true' : 'false',
      descripcion: 'Activa o desactiva el Banner Countdown en el Dashboard',
    },
    {
      clave: 'noticias_countdown_layout',
      valor: config.layout === 'stack' ? 'stack' : 'grid',
      descripcion: 'Disposición de múltiples countdowns en escritorio (grid o stack)',
    },
  ];

  for (const row of entries) {
    try {
      const { error } = await supabase
        .from('configuracion')
        .upsert(row, { onConflict: 'clave' });
      if (error) {
        const { data: existing } = await supabase
          .from('configuracion')
          .select('id')
          .eq('clave', row.clave)
          .maybeSingle();
        if (existing) {
          await supabase.from('configuracion').update({ valor: row.valor }).eq('clave', row.clave);
        } else {
          await supabase.from('configuracion').insert([row]);
        }
      }
    } catch {}
  }

  try {
    await fetch(getApiUrl('/api/configuracion'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        noticias_countdown_activo: entries[0].valor,
        noticias_countdown_layout: entries[1].valor,
      }),
    });
  } catch {}
}

export function persistCountdownsLocal(list: NoticiaCountdown[]): void {
  try {
    localStorage.setItem(LS_COUNTDOWNS_KEY, JSON.stringify(list));
  } catch {}
}
