import { supabase } from '../lib/supabase';
import { fileToCompactDataUrl } from './cropImage';

export async function uploadCarnetPhotoWithFallback(
  file: File,
  prefix: string
): Promise<string> {
  if (!file || file.size < 100) {
    throw new Error('El archivo de fotografía está vacío o dañado. Vuelve a tomar o seleccionar la imagen.');
  }

  const safePrefix = (prefix || 'carnet')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);
  const fileName = `${safePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;

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
  'En impresión',
  'Lista para entrega',
] as const;

export const UNBLOCKED_CARNET_STATES = [
  'Observada',
  'Completada',
  'Finalizada',
  'Rechazada',
] as const;

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
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return 'Fecha no disponible';
  return d.toLocaleString('es-SV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
          fecha_solicitud: row.fecha_solicitud || row.created_at || new Date().toISOString(),
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
            fecha_solicitud: parsed.fecha_solicitud || new Date().toISOString(),
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
  const nowIso = new Date().toISOString();

  const corePayload = {
    socorrista_id: input.socorrista_id,
    tipo_solicitud: input.tipo_solicitud,
    motivo: input.motivo || null,
    detalles_motivo: input.detalles_motivo || null,
    foto_url: input.foto_url || null,
    estado_solicitud: 'Pendiente',
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
  const nowIso = new Date().toISOString();
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
