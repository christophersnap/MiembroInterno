import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';

export const DEFAULT_CARGOS_INSTITUCIONALES: string[] = [
  'Socorrista',
  'APAA',
  'Rescatista Vertical',
  'TEM',
  'Búsqueda y Rescate (BREC)',
  'Rescatista Acuático',
  'Instructor',
  'Jefe de Brigada',
  'Aspirante a Socorrista',
];

export const DEFAULT_CARGOS_ADMINISTRATIVOS: string[] = [
  'Presidente de Seccional',
  'Vicepresidente de Seccional',
  'Tesorero',
  'Secretario',
  'Coordinador de Operaciones',
  'Coordinador de Capacitación',
  'Coordinador de Logística',
  'Encargado de Flota',
  'Vocal',
];

const LS_INST_KEY = 'cv_cargos_institucionales_catalog';
const LS_ADMIN_KEY = 'cv_cargos_administrativos_catalog';

export const normalizeCargoList = (raw: unknown, fallback: string[]): string[] => {
  let list: string[] = [];
  if (Array.isArray(raw)) {
    list = raw.map((item) => String(item || '').trim()).filter(Boolean);
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        list = parsed.map((item) => String(item || '').trim()).filter(Boolean);
      }
    } catch {
      list = raw
        .split(/[\n,|]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const item of list) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }

  return deduped.length > 0 ? deduped : [...fallback];
};

export const getCachedCargosCatalog = (): {
  institucionales: string[];
  administrativos: string[];
} => {
  let inst = [...DEFAULT_CARGOS_INSTITUCIONALES];
  let admin = [...DEFAULT_CARGOS_ADMINISTRATIVOS];
  try {
    const rawInst = localStorage.getItem(LS_INST_KEY);
    if (rawInst) inst = normalizeCargoList(rawInst, DEFAULT_CARGOS_INSTITUCIONALES);
    const rawAdmin = localStorage.getItem(LS_ADMIN_KEY);
    if (rawAdmin) admin = normalizeCargoList(rawAdmin, DEFAULT_CARGOS_ADMINISTRATIVOS);
  } catch {}
  return { institucionales: inst, administrativos: admin };
};

export const loadCargosCatalog = async (): Promise<{
  institucionales: string[];
  administrativos: string[];
}> => {
  const cached = getCachedCargosCatalog();
  let institucionales = cached.institucionales;
  let administrativos = cached.administrativos;

  try {
    const { data, error } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .in('clave', ['cargos_institucionales_catalog', 'cargos_administrativos_catalog']);

    if (!error && data && data.length > 0) {
      data.forEach((row) => {
        if (row.clave === 'cargos_institucionales_catalog' && row.valor) {
          institucionales = normalizeCargoList(row.valor, DEFAULT_CARGOS_INSTITUCIONALES);
        }
        if (row.clave === 'cargos_administrativos_catalog' && row.valor) {
          administrativos = normalizeCargoList(row.valor, DEFAULT_CARGOS_ADMINISTRATIVOS);
        }
      });
    } else {
      try {
        const res = await fetch(getApiUrl('/api/configuracion'));
        if (res.ok) {
          const json = await res.json();
          if (json.cargos_institucionales_catalog) {
            institucionales = normalizeCargoList(
              json.cargos_institucionales_catalog,
              DEFAULT_CARGOS_INSTITUCIONALES
            );
          }
          if (json.cargos_administrativos_catalog) {
            administrativos = normalizeCargoList(
              json.cargos_administrativos_catalog,
              DEFAULT_CARGOS_ADMINISTRATIVOS
            );
          }
        }
      } catch {}
    }
  } catch (err) {
    console.warn('Error cargando catálogo de cargos:', err);
  }

  try {
    localStorage.setItem(LS_INST_KEY, JSON.stringify(institucionales));
    localStorage.setItem(LS_ADMIN_KEY, JSON.stringify(administrativos));
  } catch {}

  return { institucionales, administrativos };
};

export const saveCargosCatalog = async (
  institucionales: string[],
  administrativos: string[]
): Promise<void> => {
  const cleanInst = normalizeCargoList(institucionales, DEFAULT_CARGOS_INSTITUCIONALES);
  const cleanAdmin = normalizeCargoList(administrativos, DEFAULT_CARGOS_ADMINISTRATIVOS);

  const instJson = JSON.stringify(cleanInst);
  const adminJson = JSON.stringify(cleanAdmin);

  try {
    localStorage.setItem(LS_INST_KEY, instJson);
    localStorage.setItem(LS_ADMIN_KEY, adminJson);
  } catch {}

  const pairs = [
    { clave: 'cargos_institucionales_catalog', valor: instJson },
    { clave: 'cargos_administrativos_catalog', valor: adminJson },
  ];

  for (const pair of pairs) {
    const { data: existing } = await supabase
      .from('configuracion')
      .select('id')
      .eq('clave', pair.clave)
      .maybeSingle();

    if (existing) {
      await supabase.from('configuracion').update({ valor: pair.valor }).eq('id', existing.id);
    } else {
      await supabase.from('configuracion').insert(pair);
    }
  }

  try {
    await fetch(getApiUrl('/api/configuracion'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cargos_institucionales_catalog: instJson,
        cargos_administrativos_catalog: adminJson,
      }),
    });
  } catch {}

  window.dispatchEvent(new Event('cargos_catalog_updated'));
};

export const parseCargosSecundarios = (raw: unknown): string[] => {
  if (!raw) return [];
  let arr: string[] = [];
  if (Array.isArray(raw)) {
    arr = raw.map((v) => String(v || '').trim()).filter(Boolean);
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          arr = parsed.map((v) => String(v || '').trim()).filter(Boolean);
        }
      } catch {}
    } else {
      arr = trimmed
        .split(/[|,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  const seen = new Set<string>();
  return arr.filter((item) => {
    const k = item.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

export const saveSocorristaCargosSecundariosFallback = async (
  socorristaId: number | string,
  cargosSecundarios: string[]
) => {
  try {
    const clave = `socorrista_cargos_${socorristaId}`;
    const valor = JSON.stringify(cargosSecundarios);
    const { data: existing } = await supabase
      .from('configuracion')
      .select('id')
      .eq('clave', clave)
      .maybeSingle();

    if (existing) {
      await supabase.from('configuracion').update({ valor }).eq('id', existing.id);
    } else {
      await supabase.from('configuracion').insert({ clave, valor });
    }
  } catch (err) {
    console.warn('Error guardando respaldo de cargos secundarios:', err);
  }
};

export const normalizeTextForCompare = (value: string): string => {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
};

export const normalizeDocumentForCompare = (value: string): string => {
  return (value || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
};
