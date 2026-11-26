import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';
import { getElSalvadorIsoTimestamp } from './dateUtils';

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

export const DEFAULT_CARGOS_JDN: string[] = [
  'Presidente',
  'Vice presidente',
  'Tesorero',
  'Pro tesorero',
  'Secretario',
  'Pro secretario',
  'Síndico',
  '1er Vocal',
  '2do Vocal',
  '3er Vocal',
  '4to Vocal',
];

export const JDN_PERIODO_ACTUAL = '2026 - 2028';

export type CargoAssignScope = 'todos' | 'seccional' | 'nacional' | 'bloqueado';

export const CARGO_ASSIGN_SCOPE_OPTIONS: {
  value: CargoAssignScope;
  label: string;
  shortLabel: string;
  description: string;
}[] = [
  {
    value: 'todos',
    label: 'Todos los usuarios con edición',
    shortLabel: 'Todos',
    description: 'Cualquier usuario con permiso de editar/registrar socorristas puede asignar este cargo.',
  },
  {
    value: 'seccional',
    label: 'Nivel Seccional y Nacional',
    shortLabel: 'Seccional / Nac.',
    description: 'Directores, Jefes de Seccional, Nivel Nacional y Administradores.',
  },
  {
    value: 'nacional',
    label: 'Solo Nivel Nacional / Admin',
    shortLabel: 'Solo Nacional',
    description: 'Únicamente usuarios con alcance nacional (ver todas las seccionales) o Administradores.',
  },
  {
    value: 'bloqueado',
    label: 'No asignable por usuarios (Solo Admin)',
    shortLabel: 'Solo Admin',
    description: 'Bloqueado para usuarios regulares y seccionales; únicamente Administradores pueden asignarlo.',
  },
];

export type CargoAssignmentRulesMap = Record<string, CargoAssignScope>;

export interface JdnAssignmentRecord {
  cargo_jdn: string;
  periodo: string;
  socorrista_id: number;
  nombre_completo: string;
  carnet: string;
  foto_url: string | null;
  seccional_id: number | null;
  seccional_nombre: string;
  cargo_institucional?: string | null;
  updated_at?: string | null;
}

export interface JdnSlotView {
  cargo: string;
  orden: number;
  periodo: string;
  miembro: JdnAssignmentRecord | null;
}

const LS_INST_KEY = 'cv_cargos_institucionales_catalog';
const LS_ADMIN_KEY = 'cv_cargos_administrativos_catalog';
const LS_RULES_KEY = 'cv_cargos_asignacion_reglas';
const LS_JDN_KEY = 'cv_jdn_asignaciones_2026_2028';

const CONFIG_KEY_RULES = 'cargos_asignacion_reglas';
const CONFIG_KEY_JDN = 'jdn_asignaciones_2026_2028';

export const normalizeCargoRuleKey = (cargoName: string): string =>
  (cargoName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export const normalizeAssignmentRules = (raw: unknown): CargoAssignmentRulesMap => {
  const validScopes = new Set<CargoAssignScope>(['todos', 'seccional', 'nacional', 'bloqueado']);
  const result: CargoAssignmentRulesMap = {};

  let obj: Record<string, unknown> | null = null;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        obj = parsed as Record<string, unknown>;
      }
    } catch {}
  }

  if (obj) {
    Object.entries(obj).forEach(([k, v]) => {
      const cleanKey = normalizeCargoRuleKey(k);
      const scope = String(v || '').trim().toLowerCase() as CargoAssignScope;
      if (cleanKey && validScopes.has(scope)) {
        result[cleanKey] = scope;
      }
    });
  }

  return result;
};

export const getCargoAssignScope = (
  cargoName: string,
  rules: CargoAssignmentRulesMap
): CargoAssignScope => {
  const key = normalizeCargoRuleKey(cargoName);
  return rules[key] || 'todos';
};

export const canUserAssignCargo = (
  cargoName: string,
  rules: CargoAssignmentRulesMap,
  userCtx: {
    role?: string | null;
    permissions?: Record<string, boolean>;
    directorSeccionalId?: number | null;
  }
): boolean => {
  const normalizedRole = (userCtx.role || '').trim().toLowerCase();
  if (normalizedRole === 'admin' || normalizedRole === 'superadmin') {
    return true;
  }

  const scope = getCargoAssignScope(cargoName, rules);
  if (scope === 'todos') return true;
  if (scope === 'bloqueado') return false;

  const isNacional = Boolean(userCtx.permissions?.ver_todas_seccionales);
  if (scope === 'nacional') {
    return isNacional;
  }

  if (scope === 'seccional') {
    return (
      isNacional ||
      normalizedRole === 'director' ||
      normalizedRole === 'jefe_seccional' ||
      normalizedRole === 'subdirector' ||
      Boolean(userCtx.directorSeccionalId)
    );
  }

  return true;
};

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
  asignacionReglas: CargoAssignmentRulesMap;
} => {
  let inst = [...DEFAULT_CARGOS_INSTITUCIONALES];
  let admin = [...DEFAULT_CARGOS_ADMINISTRATIVOS];
  let asignacionReglas: CargoAssignmentRulesMap = {};
  try {
    const rawInst = localStorage.getItem(LS_INST_KEY);
    if (rawInst) inst = normalizeCargoList(rawInst, DEFAULT_CARGOS_INSTITUCIONALES);
    const rawAdmin = localStorage.getItem(LS_ADMIN_KEY);
    if (rawAdmin) admin = normalizeCargoList(rawAdmin, DEFAULT_CARGOS_ADMINISTRATIVOS);
    const rawRules = localStorage.getItem(LS_RULES_KEY);
    if (rawRules) asignacionReglas = normalizeAssignmentRules(rawRules);
  } catch {}
  return { institucionales: inst, administrativos: admin, asignacionReglas };
};

export const loadCargosCatalog = async (): Promise<{
  institucionales: string[];
  administrativos: string[];
  asignacionReglas: CargoAssignmentRulesMap;
}> => {
  const cached = getCachedCargosCatalog();
  let institucionales = cached.institucionales;
  let administrativos = cached.administrativos;
  let asignacionReglas = cached.asignacionReglas;

  try {
    const { data, error } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .in('clave', [
        'cargos_institucionales_catalog',
        'cargos_administrativos_catalog',
        CONFIG_KEY_RULES,
      ]);

    if (!error && data && data.length > 0) {
      data.forEach((row) => {
        if (row.clave === 'cargos_institucionales_catalog' && row.valor) {
          institucionales = normalizeCargoList(row.valor, DEFAULT_CARGOS_INSTITUCIONALES);
        }
        if (row.clave === 'cargos_administrativos_catalog' && row.valor) {
          administrativos = normalizeCargoList(row.valor, DEFAULT_CARGOS_ADMINISTRATIVOS);
        }
        if (row.clave === CONFIG_KEY_RULES && row.valor) {
          asignacionReglas = normalizeAssignmentRules(row.valor);
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
          if (json[CONFIG_KEY_RULES]) {
            asignacionReglas = normalizeAssignmentRules(json[CONFIG_KEY_RULES]);
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
    localStorage.setItem(LS_RULES_KEY, JSON.stringify(asignacionReglas));
  } catch {}

  return { institucionales, administrativos, asignacionReglas };
};

export const saveCargosCatalog = async (
  institucionales: string[],
  administrativos: string[],
  asignacionReglas?: CargoAssignmentRulesMap
): Promise<void> => {
  const cleanInst = normalizeCargoList(institucionales, DEFAULT_CARGOS_INSTITUCIONALES);
  const cleanAdmin = normalizeCargoList(administrativos, DEFAULT_CARGOS_ADMINISTRATIVOS);
  const cleanRules = normalizeAssignmentRules(asignacionReglas ?? getCachedCargosCatalog().asignacionReglas);

  const instJson = JSON.stringify(cleanInst);
  const adminJson = JSON.stringify(cleanAdmin);
  const rulesJson = JSON.stringify(cleanRules);

  try {
    localStorage.setItem(LS_INST_KEY, instJson);
    localStorage.setItem(LS_ADMIN_KEY, adminJson);
    localStorage.setItem(LS_RULES_KEY, rulesJson);
  } catch {}

  const pairs = [
    { clave: 'cargos_institucionales_catalog', valor: instJson },
    { clave: 'cargos_administrativos_catalog', valor: adminJson },
    { clave: CONFIG_KEY_RULES, valor: rulesJson },
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
        [CONFIG_KEY_RULES]: rulesJson,
      }),
    });
  } catch {}

  window.dispatchEvent(new Event('cargos_catalog_updated'));
};

const buildSocorristaNombre = (s: any): string => {
  if (!s) return 'Sin nombre';
  return [s.primer_nombre, s.segundo_nombre, s.primer_apellido, s.segundo_apellido]
    .filter(Boolean)
    .join(' ')
    .trim() || s.nombre_completo || 'Sin nombre';
};

const matchCanonicalJdnCargo = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const target = normalizeCargoRuleKey(raw);
  const found = DEFAULT_CARGOS_JDN.find((c) => normalizeCargoRuleKey(c) === target);
  return found || null;
};

const readFallbackJdnConfig = async (): Promise<Record<string, JdnAssignmentRecord>> => {
  try {
    const { data } = await supabase
      .from('configuracion')
      .select('valor')
      .eq('clave', CONFIG_KEY_JDN)
      .maybeSingle();

    if (data?.valor) {
      const parsed = JSON.parse(data.valor);
      if (parsed && typeof parsed === 'object') {
        try {
          localStorage.setItem(LS_JDN_KEY, JSON.stringify(parsed));
        } catch {}
        return parsed as Record<string, JdnAssignmentRecord>;
      }
    }
  } catch {}

  try {
    const cached = localStorage.getItem(LS_JDN_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, JdnAssignmentRecord>;
      }
    }
  } catch {}

  return {};
};

const writeFallbackJdnConfig = async (map: Record<string, JdnAssignmentRecord>): Promise<void> => {
  const serialized = JSON.stringify(map);
  try {
    localStorage.setItem(LS_JDN_KEY, serialized);
  } catch {}

  try {
    const { data: existing } = await supabase
      .from('configuracion')
      .select('id')
      .eq('clave', CONFIG_KEY_JDN)
      .maybeSingle();

    if (existing) {
      await supabase.from('configuracion').update({ valor: serialized }).eq('id', existing.id);
    } else {
      await supabase.from('configuracion').insert({ clave: CONFIG_KEY_JDN, valor: serialized });
    }
  } catch (err) {
    console.warn('No se pudo respaldar JDN en configuracion:', err);
  }
};

export const loadJdnSlots = async (
  preloadedSocorristas?: any[]
): Promise<{ slots: JdnSlotView[]; bySocorristaId: Record<number, string> }> => {
  const mapByCargo: Record<string, JdnAssignmentRecord> = {};

  // 1. Read fallback configuracion first
  const fallbackMap = await readFallbackJdnConfig();
  Object.entries(fallbackMap).forEach(([k, val]) => {
    const canonical = matchCanonicalJdnCargo(val?.cargo_jdn || k);
    if (canonical && val && val.socorrista_id) {
      mapByCargo[canonical] = { ...val, cargo_jdn: canonical, periodo: val.periodo || JDN_PERIODO_ACTUAL };
    }
  });

  // 2. Read authoritative socorristas.cargo_jdn if column exists (Migration 57)
  let socRows: any[] | null = null;
  if (Array.isArray(preloadedSocorristas)) {
    const hasCargoJdnField = preloadedSocorristas.some((s) => Object.prototype.hasOwnProperty.call(s, 'cargo_jdn'));
    if (hasCargoJdnField) {
      socRows = preloadedSocorristas.filter((s) => s && s.cargo_jdn && String(s.cargo_jdn).trim() !== '');
    }
  }

  if (socRows === null) {
    try {
      const { data, error } = await supabase
        .from('socorristas')
        .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, carnet, foto_url, seccional_id, cargo_institucional, cargo_jdn, periodo_jdn, seccionales(nombre)')
        .not('cargo_jdn', 'is', null)
        .neq('cargo_jdn', '');

      if (!error && Array.isArray(data)) {
        socRows = data;
      }
    } catch {
      socRows = null;
    }
  }

  // If socorristas.cargo_jdn exists and returned cleanly, treat it as authoritative
  if (socRows !== null) {
    // Refresh details for any fallback entries if socRows is empty only if column existed
    if (socRows.length > 0) {
      Object.keys(mapByCargo).forEach((k) => delete mapByCargo[k]);
      socRows.forEach((s: any) => {
        const canonical = matchCanonicalJdnCargo(s.cargo_jdn);
        if (!canonical) return;
        const secName = Array.isArray(s.seccionales)
          ? s.seccionales[0]?.nombre || 'Sin seccional'
          : s.seccionales?.nombre || 'Sin seccional';
        mapByCargo[canonical] = {
          cargo_jdn: canonical,
          periodo: s.periodo_jdn || JDN_PERIODO_ACTUAL,
          socorrista_id: Number(s.id),
          nombre_completo: buildSocorristaNombre(s),
          carnet: s.carnet || '',
          foto_url: s.foto_url || null,
          seccional_id: s.seccional_id ? Number(s.seccional_id) : null,
          seccional_nombre: secName,
          cargo_institucional: s.cargo_institucional || null,
        };
      });
    }
  }

  const bySocorristaId: Record<number, string> = {};
  const slots: JdnSlotView[] = DEFAULT_CARGOS_JDN.map((cargo, idx) => {
    const miembro = mapByCargo[cargo] || null;
    if (miembro?.socorrista_id) {
      bySocorristaId[Number(miembro.socorrista_id)] = cargo;
    }
    return {
      cargo,
      orden: idx + 1,
      periodo: miembro?.periodo || JDN_PERIODO_ACTUAL,
      miembro,
    };
  });

  return { slots, bySocorristaId };
};

export const assignJdnCargoSafe = async (params: {
  cargoJdn: string | null;
  socorristaId: number | null;
  socorristaSnapshot?: {
    id: number;
    nombre_completo: string;
    carnet?: string | null;
    foto_url?: string | null;
    seccional_id?: number | null;
    seccional_nombre?: string | null;
    cargo_institucional?: string | null;
  } | null;
  periodo?: string;
  replaceExisting?: boolean;
}): Promise<{ ok: boolean; error?: string }> => {
  const {
    cargoJdn,
    socorristaId,
    socorristaSnapshot,
    periodo = JDN_PERIODO_ACTUAL,
    replaceExisting = true,
  } = params;

  const canonicalCargo = cargoJdn ? matchCanonicalJdnCargo(cargoJdn) : null;
  if (cargoJdn && !canonicalCargo) {
    return { ok: false, error: `El cargo "${cargoJdn}" no pertenece a la Junta Directiva Nacional.` };
  }

  // 1. Try secure RPC from Migration 57 first (if assigning/clearing a specific socorrista)
  let persistedInDbColumn = false;

  if (socorristaId) {
    try {
      const { data, error } = await supabase.rpc('asignar_cargo_jdn', {
        p_socorrista_id: socorristaId,
        p_cargo_jdn: canonicalCargo,
        p_periodo: periodo,
        p_reemplazar: replaceExisting,
      });

      if (!error) {
        if (data && typeof data === 'object' && (data as any).ok === false) {
          return { ok: false, error: (data as any).error || 'No se pudo asignar el cargo JDN.' };
        }
        persistedInDbColumn = true;
      } else {
        const msg = (error.message || '').toLowerCase();
        // If explicit permission or uniqueness error came from RPC, surface it immediately
        if (
          msg.includes('permiso') ||
          msg.includes('autorizado') ||
          msg.includes('ocupado') ||
          msg.includes('ya está asignado')
        ) {
          return { ok: false, error: error.message };
        }
      }
    } catch {
      // RPC may not exist yet before Migration 57 is executed
    }
  }

  // 2. Fallback direct column update if RPC wasn't present
  if (!persistedInDbColumn) {
    try {
      if (canonicalCargo) {
        // Release previous holder of this cargo if replacing
        if (replaceExisting) {
          const { error: clearErr } = await supabase
            .from('socorristas')
            .update({ cargo_jdn: null, periodo_jdn: null })
            .eq('cargo_jdn', canonicalCargo);
          if (!clearErr) persistedInDbColumn = true;
        }
        if (socorristaId) {
          const { error: setErr } = await supabase
            .from('socorristas')
            .update({ cargo_jdn: canonicalCargo, periodo_jdn: periodo })
            .eq('id', socorristaId);
          if (!setErr) persistedInDbColumn = true;
        }
      } else if (socorristaId) {
        const { error: clearErr } = await supabase
          .from('socorristas')
          .update({ cargo_jdn: null, periodo_jdn: null })
          .eq('id', socorristaId);
        if (!clearErr) persistedInDbColumn = true;
      }
    } catch {
      // Column cargo_jdn may not exist yet before Migration 57
    }
  }

  // 3. Always keep configuracion JSON mirror in sync so JDN works immediately even pre-migration
  const currentFallback = await readFallbackJdnConfig();
  const nextFallback: Record<string, JdnAssignmentRecord> = { ...currentFallback };

  // Remove this socorrista from any previous JDN seat (one JDN seat per person)
  if (socorristaId) {
    Object.keys(nextFallback).forEach((k) => {
      if (Number(nextFallback[k]?.socorrista_id) === Number(socorristaId)) {
        delete nextFallback[k];
      }
    });
  }

  if (canonicalCargo && socorristaId) {
    let snap = socorristaSnapshot;
    if (!snap) {
      const { data: s } = await supabase
        .from('socorristas')
        .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, carnet, foto_url, seccional_id, cargo_institucional, seccionales(nombre)')
        .eq('id', socorristaId)
        .maybeSingle();
      if (s) {
        const secName = Array.isArray((s as any).seccionales)
          ? (s as any).seccionales[0]?.nombre || 'Sin seccional'
          : (s as any).seccionales?.nombre || 'Sin seccional';
        snap = {
          id: Number(s.id),
          nombre_completo: buildSocorristaNombre(s),
          carnet: s.carnet || '',
          foto_url: s.foto_url || null,
          seccional_id: s.seccional_id ? Number(s.seccional_id) : null,
          seccional_nombre: secName,
          cargo_institucional: s.cargo_institucional || null,
        };
      }
    }

    if (snap) {
      nextFallback[canonicalCargo] = {
        cargo_jdn: canonicalCargo,
        periodo,
        socorrista_id: Number(snap.id),
        nombre_completo: snap.nombre_completo,
        carnet: snap.carnet || '',
        foto_url: snap.foto_url || null,
        seccional_id: snap.seccional_id ?? null,
        seccional_nombre: snap.seccional_nombre || 'Sin seccional',
        cargo_institucional: snap.cargo_institucional || null,
        updated_at: getElSalvadorIsoTimestamp(),
      };
    }
  } else if (canonicalCargo && !socorristaId) {
    // Releasing a specific cargo without passing socorristaId
    const prevHolderId = nextFallback[canonicalCargo]?.socorrista_id;
    delete nextFallback[canonicalCargo];
    if (prevHolderId && !persistedInDbColumn) {
      try {
        await supabase
          .from('socorristas')
          .update({ cargo_jdn: null, periodo_jdn: null })
          .eq('id', prevHolderId);
      } catch {}
    }
  }

  await writeFallbackJdnConfig(nextFallback);
  window.dispatchEvent(new Event('jdn_updated'));
  return { ok: true };
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
