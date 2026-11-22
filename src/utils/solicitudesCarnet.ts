import { supabase } from '../lib/supabase';
import { fileToCompactDataUrl } from './cropImage';
import { optimizeImageForUpload, getExtensionFromFile } from './imageOptimizer';
import { formatFechaHoraSV, getElSalvadorIsoTimestamp } from './dateUtils';

export interface InvalidNameFieldDetail {
  field: 'primer_nombre' | 'segundo_nombre' | 'primer_apellido' | 'segundo_apellido' | 'nombre_completo';
  label: string;
  value: string;
  symbols: string[];
}

export interface SocorristaNameValidationResult {
  isValid: boolean;
  missingRequired: boolean;
  invalidSymbols: string[];
  invalidFields: InvalidNameFieldDetail[];
  fullName: string;
  message: string;
}

const VALID_NAME_CHAR_REGEX = /^[\p{L}\s]+$/u;
const INVALID_NAME_CHAR_GLOBAL_REGEX = /[^\p{L}\s]/gu;

function extractInvalidNameSymbols(text: string): string[] {
  const matches = text.match(INVALID_NAME_CHAR_GLOBAL_REGEX);
  if (!matches) return [];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const ch of matches) {
    if (!seen.has(ch)) {
      seen.add(ch);
      unique.push(ch);
    }
  }
  return unique;
}

/**
 * Valida que el nombre de un socorrista no contenga números ni símbolos impropios
 * de un nombre antes de solicitar o emitir un carnet institucional.
 * Únicamente permite letras (incluyendo tildes, diéresis y ñ/Ñ) y espacios.
 */
export function validateSocorristaNameForCarnet(socorrista?: {
  primer_nombre?: string | null;
  segundo_nombre?: string | null;
  primer_apellido?: string | null;
  segundo_apellido?: string | null;
  nombre_completo?: string | null;
} | null): SocorristaNameValidationResult {
  if (!socorrista) {
    return {
      isValid: false,
      missingRequired: true,
      invalidSymbols: [],
      invalidFields: [],
      fullName: '',
      message: 'No se encontró el nombre del elemento para validar.',
    };
  }

  const hasStructuredFields =
    socorrista.primer_nombre !== undefined ||
    socorrista.segundo_nombre !== undefined ||
    socorrista.primer_apellido !== undefined ||
    socorrista.segundo_apellido !== undefined;

  const invalidFields: InvalidNameFieldDetail[] = [];
  const allSymbolsSet = new Set<string>();
  let missingRequired = false;

  if (hasStructuredFields) {
    const fields: Array<{
      field: InvalidNameFieldDetail['field'];
      label: string;
      value: string;
      required: boolean;
    }> = [
      { field: 'primer_nombre', label: 'Primer nombre', value: String(socorrista.primer_nombre || '').trim(), required: true },
      { field: 'segundo_nombre', label: 'Segundo nombre', value: String(socorrista.segundo_nombre || '').trim(), required: false },
      { field: 'primer_apellido', label: 'Primer apellido', value: String(socorrista.primer_apellido || '').trim(), required: true },
      { field: 'segundo_apellido', label: 'Segundo apellido', value: String(socorrista.segundo_apellido || '').trim(), required: false },
    ];

    for (const item of fields) {
      if (item.required && !item.value) {
        missingRequired = true;
      }
      if (item.value && !VALID_NAME_CHAR_REGEX.test(item.value)) {
        const symbols = extractInvalidNameSymbols(item.value);
        symbols.forEach((s) => allSymbolsSet.add(s));
        invalidFields.push({
          field: item.field,
          label: item.label,
          value: item.value,
          symbols,
        });
      }
    }
  } else {
    const full = String(socorrista.nombre_completo || '').trim();
    if (!full) {
      missingRequired = true;
    } else if (!VALID_NAME_CHAR_REGEX.test(full)) {
      const symbols = extractInvalidNameSymbols(full);
      symbols.forEach((s) => allSymbolsSet.add(s));
      invalidFields.push({
        field: 'nombre_completo',
        label: 'Nombre completo',
        value: full,
        symbols,
      });
    }
  }

  const fullName = hasStructuredFields
    ? [
        socorrista.primer_nombre,
        socorrista.segundo_nombre,
        socorrista.primer_apellido,
        socorrista.segundo_apellido,
      ]
        .filter((part) => Boolean(part && String(part).trim()))
        .join(' ')
    : String(socorrista.nombre_completo || '').trim();

  const invalidSymbols = Array.from(allSymbolsSet);
  const isValid = !missingRequired && invalidFields.length === 0;

  let message = '';
  if (missingRequired && invalidSymbols.length > 0) {
    message = `El nombre del elemento está incompleto y contiene símbolos no permitidos (${invalidSymbols.map((s) => `"${s}"`).join(', ')}). Corrige el nombre en el perfil antes de solicitar el carnet.`;
  } else if (missingRequired) {
    message = 'El elemento no tiene registrados su primer nombre y primer apellido completos. Corrige el perfil antes de solicitar el carnet.';
  } else if (invalidSymbols.length > 0) {
    const fieldsSummary = invalidFields
      .map((f) => `${f.label}: "${f.value}"`)
      .join(' · ');
    message = `El nombre del elemento contiene caracteres o símbolos que no corresponden a un nombre (${invalidSymbols.map((s) => `"${s}"`).join(', ')}). Detectado en ${fieldsSummary}. Debe corregirse en el perfil del socorrista antes de solicitar el carnet.`;
  }

  return {
    isValid,
    missingRequired,
    invalidSymbols,
    invalidFields,
    fullName,
    message,
  };
}

export async function uploadCarnetPhotoWithFallback(
  rawFile: File,
  prefix: string
): Promise<string> {
  if (!rawFile || rawFile.size < 100) {
    throw new Error('El archivo de fotografía está vacío o dañado. Vuelve a tomar o seleccionar la imagen.');
  }

  const file = await optimizeImageForUpload(rawFile, {
    profile: 'carnet',
    modulo: 'carnet',
    bucketId: 'socorristas',
  });

  const safePrefix = (prefix || 'carnet')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);
  const ext = getExtensionFromFile(file, 'jpg');
  const fileName = `${safePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;

  try {
    let { error: uploadError } = await supabase.storage
      .from('socorristas')
      .upload(fileName, file, { upsert: true, contentType: file.type || 'image/jpeg' });

    if (uploadError) {
      const retry = await supabase.storage.from('socorristas').upload(fileName, file);
      uploadError = retry.error;
    }

    if (!uploadError) {
      const { data } = supabase.storage.from('socorristas').getPublicUrl(fileName);
      if (data?.publicUrl) {
        return data.publicUrl;
      }
    } else {
      console.warn('Subida a Storage rechazada por permisos, usando imagen compacta de respaldo:', uploadError);
    }
  } catch (err) {
    console.warn('Error subiendo fotografía a Storage, usando respaldo compacto:', err);
  }

  // Respaldo garantizado en formato data:image/jpeg compacto (~30-45 KB) si Storage aún no tiene política pública
  return fileToCompactDataUrl(file, 520, 0.82);
}

export const BLOCKING_CARNET_STATES = [
  'Pendiente',
  'En revisión',
  'Aprobada',
  'Aceptada',
  'En impresión',
  'Lista para entrega',
] as const;

export const UNBLOCKED_CARNET_STATES = [
  'Observada',
  'Completado',
  'Completada',
  'Finalizada',
  'Rechazada',
  'Cancelada',
  'Cancelado',
] as const;

export function isCompletedCarnetEstado(estado?: string | null): boolean {
  return estado === 'Completado' || estado === 'Completada' || estado === 'Finalizada';
}

export function isCancelledCarnetEstado(estado?: string | null): boolean {
  return estado === 'Cancelada' || estado === 'Cancelado';
}

export function isClosedCarnetEstado(estado?: string | null): boolean {
  return isCompletedCarnetEstado(estado) || isCancelledCarnetEstado(estado);
}

export function isAcceptedCarnetEstado(estado?: string | null): boolean {
  return estado === 'Aprobada' || estado === 'Aceptada';
}

export interface CarnetRequestStatusInfo {
  id: string | number;
  socorrista_id: number;
  estado_solicitud: string;
  fecha_solicitud: string;
  tipo_solicitud: string;
  motivo: string | null;
  detalles_motivo: string | null;
  observaciones: string | null;
  solicitado_por: string | null;
  foto_url: string | null;
  lote_id: string | null;
  es_lote: boolean;
  source: 'db' | 'config';
  config_clave?: string;
}

export function isBlockingCarnetState(estado?: string | null): boolean {
  if (!estado) return false;
  return (BLOCKING_CARNET_STATES as readonly string[]).includes(estado);
}

export function formatCarnetRequestDate(isoDate?: string | null): string {
  if (!isoDate) return 'Fecha no disponible';
  const formatted = formatFechaHoraSV(isoDate, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: undefined,
    hour12: true,
  });
  return formatted === '-' ? 'Fecha no disponible' : formatted;
}

export async function fetchLatestCarnetRequestsMap(
  socorristaIds?: number[]
): Promise<Record<number, CarnetRequestStatusInfo>> {
  const result: Record<number, CarnetRequestStatusInfo> = {};

  const pickIfNewer = (entry: CarnetRequestStatusInfo) => {
    if (!entry.socorrista_id) return;
    const existing = result[entry.socorrista_id];
    if (!existing) {
      result[entry.socorrista_id] = entry;
      return;
    }
    const existingTime = new Date(existing.fecha_solicitud).getTime() || 0;
    const candidateTime = new Date(entry.fecha_solicitud).getTime() || 0;
    if (candidateTime > existingTime) {
      result[entry.socorrista_id] = entry;
    } else if (candidateTime === existingTime && existing.source === 'config' && entry.source === 'db') {
      result[entry.socorrista_id] = entry;
    }
  };

  try {
    let query = supabase
      .from('solicitudes_carnet')
      .select('*')
      .order('fecha_solicitud', { ascending: false });

    if (socorristaIds && socorristaIds.length > 0 && socorristaIds.length <= 200) {
      query = query.in('socorrista_id', socorristaIds);
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      data.forEach((row: any) => {
        pickIfNewer({
          id: row.id,
          socorrista_id: Number(row.socorrista_id),
          estado_solicitud: row.estado_solicitud || 'Pendiente',
          fecha_solicitud: row.fecha_solicitud || row.created_at || getElSalvadorIsoTimestamp(),
          tipo_solicitud: row.tipo_solicitud || 'Nuevo',
          motivo: row.motivo || null,
          detalles_motivo: row.detalles_motivo || null,
          observaciones: row.observaciones || null,
          solicitado_por: row.solicitado_por || null,
          foto_url: row.foto_url || null,
          lote_id: row.lote_id || null,
          es_lote: Boolean(row.es_lote || row.lote_id),
          source: 'db',
        });
      });
    }
  } catch (e) {
    console.warn('Error consultando solicitudes_carnet:', e);
  }

  // Consultar respaldo en configuracion (`solicitud_carnet_%`)
  try {
    const { data: cfgRows } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .like('clave', 'solicitud_carnet_%');

    if (Array.isArray(cfgRows)) {
      const idFilterSet = socorristaIds && socorristaIds.length > 0 ? new Set(socorristaIds.map(Number)) : null;
      cfgRows.forEach((row: any) => {
        try {
          const parsed = JSON.parse(row.valor);
          const socId = Number(parsed?.socorrista_id || 0);
          if (!socId) return;
          if (idFilterSet && !idFilterSet.has(socId)) return;
          pickIfNewer({
            id: row.clave,
            socorrista_id: socId,
            estado_solicitud: parsed.estado_solicitud || 'Pendiente',
            fecha_solicitud: parsed.fecha_solicitud || getElSalvadorIsoTimestamp(),
            tipo_solicitud: parsed.tipo_solicitud || 'Nuevo',
            motivo: parsed.motivo || null,
            detalles_motivo: parsed.detalles_motivo || null,
            observaciones: parsed.observaciones || null,
            solicitado_por: parsed.solicitado_por || parsed.nombre_completo || null,
            foto_url: parsed.foto_url || null,
            lote_id: parsed.lote_id || null,
            es_lote: Boolean(parsed.es_lote || parsed.lote_id),
            source: 'config',
            config_clave: row.clave,
          });
        } catch {
          // Ignorar fila malformada
        }
      });
    }
  } catch (e) {
    console.warn('Error consultando respaldo configuracion solicitudes:', e);
  }

  return result;
}

export interface CreateCarnetSolicitudInput {
  socorrista_id: number;
  carnet?: string | null;
  nombre_completo?: string;
  seccional_id?: number | null;
  seccional_nombre?: string | null;
  tipo_solicitud: string;
  motivo?: string | null;
  detalles_motivo?: string | null;
  foto_url?: string | null;
  solicitado_por?: string | null;
  solicitado_por_email?: string | null;
  lote_id?: string | null;
  es_lote?: boolean;
}

export async function createCarnetSolicitudSafe(
  input: CreateCarnetSolicitudInput
): Promise<{ ok: boolean; via: 'db' | 'config'; error?: string }> {
  if (input.nombre_completo && input.nombre_completo.trim()) {
    const nameCheck = validateSocorristaNameForCarnet({ nombre_completo: input.nombre_completo });
    if (!nameCheck.isValid) {
      return { ok: false, via: 'db', error: nameCheck.message };
    }
  }

  const nowIso = getElSalvadorIsoTimestamp();

  const corePayload = {
    socorrista_id: input.socorrista_id,
    tipo_solicitud: input.tipo_solicitud,
    motivo: input.motivo || null,
    detalles_motivo: input.detalles_motivo || null,
    foto_url: input.foto_url || null,
    estado_solicitud: 'Pendiente',
    fecha_solicitud: nowIso,
  };

  const extendedPayload = {
    ...corePayload,
    seccional_id: input.seccional_id ?? null,
    seccional_nombre: input.seccional_nombre ?? null,
    solicitado_por: input.solicitado_por ?? input.nombre_completo ?? null,
    solicitado_por_email: input.solicitado_por_email ?? null,
  };

  const batchPayload = {
    ...extendedPayload,
    lote_id: input.lote_id ?? null,
    es_lote: Boolean(input.es_lote),
  };

  // 1. Intento completo con lote_id / es_lote (requiere migración 35)
  let { error: err1 } = await supabase.from('solicitudes_carnet').insert([batchPayload]);
  if (!err1) return { ok: true, via: 'db' };

  // 2. Fallback sin lote_id / es_lote (migración 31)
  let { error: err2 } = await supabase.from('solicitudes_carnet').insert([extendedPayload]);
  if (!err2) {
    // Guardar metadato del lote en configuracion si era lote para no perder trazabilidad
    if (input.es_lote && input.lote_id) {
      try {
        await supabase.from('configuracion').insert({
          clave: `solicitud_carnet_${input.socorrista_id}_${Date.now()}`,
          valor: JSON.stringify({
            ...batchPayload,
            carnet: input.carnet || '',
            nombre_completo: input.nombre_completo || '',
            fecha_solicitud: nowIso,
          }),
        });
      } catch {}
    }
    return { ok: true, via: 'db' };
  }

  // 3. Fallback mínimo corePayload
  let { error: err3 } = await supabase.from('solicitudes_carnet').insert([corePayload]);
  if (!err3) return { ok: true, via: 'db' };

  // 4. Fallback a configuracion si RLS impide INSERT directo
  try {
    const { error: cfgErr } = await supabase.from('configuracion').insert({
      clave: `solicitud_carnet_${input.socorrista_id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      valor: JSON.stringify({
        ...batchPayload,
        carnet: input.carnet || '',
        nombre_completo: input.nombre_completo || '',
        fecha_solicitud: nowIso,
      }),
    });
    if (!cfgErr) return { ok: true, via: 'config' };
    return { ok: false, via: 'config', error: cfgErr.message };
  } catch (e: any) {
    return { ok: false, via: 'config', error: e?.message || err3.message || err1.message };
  }
}

export interface ResubmitCarnetSolicitudInput extends CreateCarnetSolicitudInput {
  previousRequest: CarnetRequestStatusInfo;
}

export async function resubmitCarnetSolicitudSafe(
  input: ResubmitCarnetSolicitudInput
): Promise<{ ok: boolean; via: 'db' | 'config'; error?: string }> {
  if (input.nombre_completo && input.nombre_completo.trim()) {
    const nameCheck = validateSocorristaNameForCarnet({ nombre_completo: input.nombre_completo });
    if (!nameCheck.isValid) {
      return { ok: false, via: 'db', error: nameCheck.message };
    }
  }

  const nowIso = getElSalvadorIsoTimestamp();
  const prev = input.previousRequest;

  const updateFields = {
    tipo_solicitud: input.tipo_solicitud,
    motivo: input.motivo || null,
    detalles_motivo: input.detalles_motivo || null,
    foto_url: input.foto_url || prev.foto_url || null,
    estado_solicitud: 'Pendiente',
    observaciones: null,
    revisado_por: null,
    fecha_revision: null,
    solicitado_por: input.solicitado_por ?? input.nombre_completo ?? prev.solicitado_por ?? null,
    solicitado_por_email: input.solicitado_por_email ?? null,
    fecha_solicitud: nowIso,
    updated_at: nowIso,
  };

  if (prev.source === 'config' && prev.config_clave) {
    try {
      const updatedCfgPayload = {
        socorrista_id: input.socorrista_id,
        carnet: input.carnet || '',
        nombre_completo: input.nombre_completo || '',
        seccional_id: input.seccional_id ?? null,
        seccional_nombre: input.seccional_nombre ?? null,
        ...updateFields,
        lote_id: prev.lote_id ?? null,
        es_lote: Boolean(prev.es_lote),
      };
      const { error: cfgUpdErr } = await supabase
        .from('configuracion')
        .update({ valor: JSON.stringify(updatedCfgPayload) })
        .eq('clave', prev.config_clave);

      if (!cfgUpdErr) return { ok: true, via: 'config' };
    } catch {}
  }

  if (prev.source === 'db' && prev.id !== undefined && prev.id !== null) {
    try {
      const { data: updRows, error: updErr } = await supabase
        .from('solicitudes_carnet')
        .update(updateFields)
        .eq('id', prev.id)
        .select('id');

      if (!updErr && Array.isArray(updRows) && updRows.length > 0) {
        return { ok: true, via: 'db' };
      }

      // Fallback sin columnas opcionales revisado_por / updated_at / solicitado_por_email
      const { revisado_por: _r, fecha_revision: _fr, solicitado_por_email: _e, updated_at: _u, ...minimalUpdate } =
        updateFields;
      const { data: retryRows, error: retryErr } = await supabase
        .from('solicitudes_carnet')
        .update(minimalUpdate)
        .eq('id', prev.id)
        .select('id');

      if (!retryErr && Array.isArray(retryRows) && retryRows.length > 0) {
        return { ok: true, via: 'db' };
      }
    } catch {}
  }

  // Fallback seguro si RLS aún no permite UPDATE a usuarios públicos sobre filas Observadas/Rechazadas:
  // crear nueva solicitud para que el cambio quede registrado de inmediato.
  return createCarnetSolicitudSafe(input);
}

export interface CorrectObservedCarnetInput {
  solicitudId: number | string;
  source: 'db' | 'config';
  configClave?: string;
  socorristaId: number;
  primer_nombre: string;
  segundo_nombre?: string | null;
  primer_apellido: string;
  segundo_apellido?: string | null;
  foto_url?: string | null;
  foto_analisis?: {
    status: string;
    score: number;
    summary: string;
    checked_at?: string;
  } | null;
  foto_fondo_reemplazado?: boolean | null;
  nota_correccion?: string | null;
}

export async function correctObservedCarnetSolicitudSafe(
  input: CorrectObservedCarnetInput
): Promise<{ ok: boolean; via: 'rpc' | 'db' | 'config'; fullName: string; updatedAt: string; error?: string }> {
  const primerNombre = String(input.primer_nombre || '').trim().toUpperCase();
  const segundoNombre = String(input.segundo_nombre || '').trim().toUpperCase();
  const primerApellido = String(input.primer_apellido || '').trim().toUpperCase();
  const segundoApellido = String(input.segundo_apellido || '').trim().toUpperCase();

  const nameValidation = validateSocorristaNameForCarnet({
    primer_nombre: primerNombre,
    segundo_nombre: segundoNombre || null,
    primer_apellido: primerApellido,
    segundo_apellido: segundoApellido || null,
  });

  const nowIso = getElSalvadorIsoTimestamp();

  if (!nameValidation.isValid) {
    return {
      ok: false,
      via: 'db',
      fullName: nameValidation.fullName,
      updatedAt: nowIso,
      error: nameValidation.message,
    };
  }

  const fullName = [primerNombre, segundoNombre, primerApellido, segundoApellido]
    .filter(Boolean)
    .join(' ');
  const notaLimpia = input.nota_correccion ? input.nota_correccion.trim() : null;
  const fotoAnalisisPayload = input.foto_analisis
    ? {
        ...input.foto_analisis,
        checked_at: input.foto_analisis.checked_at || nowIso,
      }
    : null;

  if (input.source === 'config' && input.configClave) {
    try {
      // Actualizar perfil de socorrista si hay permisos
      if (input.socorristaId > 0) {
        const socPatch: Record<string, any> = {
          primer_nombre: primerNombre,
          segundo_nombre: segundoNombre || null,
          primer_apellido: primerApellido,
          segundo_apellido: segundoApellido || null,
        };
        if (input.foto_url) socPatch.foto_url = input.foto_url;
        await supabase.from('socorristas').update(socPatch).eq('id', input.socorristaId);
      }

      const { data: existing } = await supabase
        .from('configuracion')
        .select('valor')
        .eq('clave', input.configClave)
        .maybeSingle();
      const currentObj = existing?.valor ? JSON.parse(existing.valor) : {};
      const { error: cfgErr } = await supabase
        .from('configuracion')
        .update({
          valor: JSON.stringify({
            ...currentObj,
            nombre_completo: fullName,
            primer_nombre: primerNombre,
            segundo_nombre: segundoNombre || null,
            primer_apellido: primerApellido,
            segundo_apellido: segundoApellido || null,
            foto_url: input.foto_url ?? currentObj.foto_url ?? null,
            estado_solicitud: 'Pendiente',
            observaciones: null,
            revisado_por: null,
            fecha_revision: null,
            nota_correccion: notaLimpia,
            fecha_correccion: nowIso,
            fecha_solicitud: nowIso,
            updated_at: nowIso,
          }),
        })
        .eq('clave', input.configClave);

      if (!cfgErr) {
        return { ok: true, via: 'config', fullName, updatedAt: nowIso };
      }
      return { ok: false, via: 'config', fullName, updatedAt: nowIso, error: cfgErr.message };
    } catch (e: any) {
      return { ok: false, via: 'config', fullName, updatedAt: nowIso, error: e?.message || 'Error al guardar corrección.' };
    }
  }

  // 1. Intentar vía RPC SECURITY DEFINER (Migración 56 — permite corregir nombre y foto sin requerir edit_socorristas)
  const numericId = Number(input.solicitudId);
  if (!Number.isNaN(numericId) && numericId > 0) {
    try {
      const { error: rpcErr } = await supabase.rpc('corregir_solicitud_carnet', {
        p_solicitud_id: numericId,
        p_primer_nombre: primerNombre,
        p_segundo_nombre: segundoNombre || null,
        p_primer_apellido: primerApellido,
        p_segundo_apellido: segundoApellido || null,
        p_foto_url: input.foto_url ?? null,
        p_foto_analisis: fotoAnalisisPayload,
        p_foto_fondo_reemplazado:
          typeof input.foto_fondo_reemplazado === 'boolean' ? input.foto_fondo_reemplazado : null,
        p_nota_correccion: notaLimpia,
      });

      if (!rpcErr) {
        return { ok: true, via: 'rpc', fullName, updatedAt: nowIso };
      }

      const rpcMsg = (rpcErr.message || '').toLowerCase();
      const isMissingRpc =
        rpcErr.code === '42883' ||
        rpcErr.code === 'PGRST202' ||
        rpcMsg.includes('could not find the function') ||
        rpcMsg.includes('does not exist');

      if (!isMissingRpc) {
        return { ok: false, via: 'rpc', fullName, updatedAt: nowIso, error: rpcErr.message };
      }
    } catch {
      // Continuar al fallback directo de tablas
    }
  }

  // 2. Fallback directo sobre tablas si Migración 56 aún no ha sido ejecutada
  try {
    if (input.socorristaId > 0) {
      const socPatch: Record<string, any> = {
        primer_nombre: primerNombre,
        segundo_nombre: segundoNombre || null,
        primer_apellido: primerApellido,
        segundo_apellido: segundoApellido || null,
      };
      if (input.foto_url) {
        socPatch.foto_url = input.foto_url;
      }
      const { error: socErr } = await supabase
        .from('socorristas')
        .update(socPatch)
        .eq('id', input.socorristaId);

      if (socErr) {
        return {
          ok: false,
          via: 'db',
          fullName,
          updatedAt: nowIso,
          error:
            'No se pudo actualizar el nombre del elemento en la base de datos. Ejecuta la migración 56 en Supabase para habilitar la corrección directa por solicitantes.',
        };
      }
    }

    const fullUpdate: Record<string, any> = {
      estado_solicitud: 'Pendiente',
      observaciones: null,
      revisado_por: null,
      fecha_revision: null,
      fecha_solicitud: nowIso,
      updated_at: nowIso,
      nota_correccion: notaLimpia,
      fecha_correccion: nowIso,
    };
    if (input.foto_url) {
      fullUpdate.foto_url = input.foto_url;
    }
    if (fotoAnalisisPayload) {
      fullUpdate.foto_analisis = fotoAnalisisPayload;
    }
    if (typeof input.foto_fondo_reemplazado === 'boolean') {
      fullUpdate.foto_fondo_reemplazado = input.foto_fondo_reemplazado;
    }

    const { data: updRows, error: err1 } = await supabase
      .from('solicitudes_carnet')
      .update(fullUpdate)
      .eq('id', input.solicitudId)
      .select('id');

    if (!err1 && Array.isArray(updRows) && updRows.length > 0) {
      return { ok: true, via: 'db', fullName, updatedAt: nowIso };
    }

    // Fallback sin columnas nuevas de migración 56 / 53
    const baseUpdate: Record<string, any> = {
      estado_solicitud: 'Pendiente',
      observaciones: null,
      revisado_por: null,
      fecha_revision: null,
      fecha_solicitud: nowIso,
    };
    if (input.foto_url) {
      baseUpdate.foto_url = input.foto_url;
    }
    const { data: retryRows, error: err2 } = await supabase
      .from('solicitudes_carnet')
      .update(baseUpdate)
      .eq('id', input.solicitudId)
      .select('id');

    if (!err2 && Array.isArray(retryRows) && retryRows.length > 0) {
      return { ok: true, via: 'db', fullName, updatedAt: nowIso };
    }

    return {
      ok: false,
      via: 'db',
      fullName,
      updatedAt: nowIso,
      error: err2?.message || err1?.message || 'No se pudo reenviar la solicitud corregida.',
    };
  } catch (e: any) {
    return {
      ok: false,
      via: 'db',
      fullName,
      updatedAt: nowIso,
      error: e?.message || 'Error de red al guardar la corrección.',
    };
  }
}

export interface CancelCarnetSolicitudInput {
  solicitudId: number | string;
  source: 'db' | 'config';
  configClave?: string;
  motivo_cancelacion?: string | null;
  cancelado_por?: string | null;
}

export async function cancelCarnetSolicitudSafe(
  input: CancelCarnetSolicitudInput
): Promise<{ ok: boolean; via: 'rpc' | 'db' | 'config'; updatedAt: string; error?: string }> {
  const nowIso = getElSalvadorIsoTimestamp();
  const motivoLimpio = input.motivo_cancelacion ? input.motivo_cancelacion.trim() : null;
  const canceladoPor = input.cancelado_por ? input.cancelado_por.trim() : null;

  if (input.source === 'config' && input.configClave) {
    try {
      const { data: existing } = await supabase
        .from('configuracion')
        .select('valor')
        .eq('clave', input.configClave)
        .maybeSingle();
      const currentObj = existing?.valor ? JSON.parse(existing.valor) : {};
      const { error: cfgErr } = await supabase
        .from('configuracion')
        .update({
          valor: JSON.stringify({
            ...currentObj,
            estado_solicitud: 'Cancelada',
            motivo_cancelacion: motivoLimpio,
            cancelado_por: canceladoPor,
            fecha_cancelacion: nowIso,
            updated_at: nowIso,
          }),
        })
        .eq('clave', input.configClave);

      if (!cfgErr) {
        return { ok: true, via: 'config', updatedAt: nowIso };
      }
      return { ok: false, via: 'config', updatedAt: nowIso, error: cfgErr.message };
    } catch (e: any) {
      return { ok: false, via: 'config', updatedAt: nowIso, error: e?.message || 'Error al cancelar la solicitud.' };
    }
  }

  // 1. Intentar vía RPC SECURITY DEFINER (Migración 56)
  const numericId = Number(input.solicitudId);
  if (!Number.isNaN(numericId) && numericId > 0) {
    try {
      const { error: rpcErr } = await supabase.rpc('cancelar_solicitud_carnet', {
        p_solicitud_id: numericId,
        p_motivo: motivoLimpio,
        p_cancelado_por: canceladoPor,
      });

      if (!rpcErr) {
        return { ok: true, via: 'rpc', updatedAt: nowIso };
      }

      const rpcMsg = (rpcErr.message || '').toLowerCase();
      const isMissingRpc =
        rpcErr.code === '42883' ||
        rpcErr.code === 'PGRST202' ||
        rpcMsg.includes('could not find the function') ||
        rpcMsg.includes('does not exist');

      if (!isMissingRpc) {
        return { ok: false, via: 'rpc', updatedAt: nowIso, error: rpcErr.message };
      }
    } catch {
      // Continuar al fallback directo
    }
  }

  // 2. Fallback directo sobre tabla
  try {
    const fullPayload: Record<string, any> = {
      estado_solicitud: 'Cancelada',
      motivo_cancelacion: motivoLimpio,
      cancelado_por: canceladoPor,
      fecha_cancelacion: nowIso,
      updated_at: nowIso,
    };

    const { data: rows1, error: err1 } = await supabase
      .from('solicitudes_carnet')
      .update(fullPayload)
      .eq('id', input.solicitudId)
      .select('id');

    if (!err1 && Array.isArray(rows1) && rows1.length > 0) {
      return { ok: true, via: 'db', updatedAt: nowIso };
    }

    // Fallback sin columnas nuevas de migración 56
    const { data: rows2, error: err2 } = await supabase
      .from('solicitudes_carnet')
      .update({
        estado_solicitud: 'Cancelada',
        observaciones: motivoLimpio
          ? `Cancelada por solicitante: ${motivoLimpio}`
          : 'Cancelada por solicitante',
      })
      .eq('id', input.solicitudId)
      .select('id');

    if (!err2 && Array.isArray(rows2) && rows2.length > 0) {
      return { ok: true, via: 'db', updatedAt: nowIso };
    }

    const errMsg = err2?.message || err1?.message || '';
    if (err2?.code === '23514' || err1?.code === '23514' || errMsg.toLowerCase().includes('check constraint')) {
      return {
        ok: false,
        via: 'db',
        updatedAt: nowIso,
        error:
          'La base de datos aún no tiene habilitado el estado "Cancelada". Ejecuta el archivo 56_correccion_cancelacion_solicitudes_carnet.sql en Supabase.',
      };
    }

    return {
      ok: false,
      via: 'db',
      updatedAt: nowIso,
      error: errMsg || 'No se pudo cancelar la solicitud.',
    };
  } catch (e: any) {
    return {
      ok: false,
      via: 'db',
      updatedAt: nowIso,
      error: e?.message || 'Error de red al cancelar la solicitud.',
    };
  }
}
