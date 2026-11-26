import { supabase } from '../lib/supabase';

export type TipoSolicitudLimite = 'combustible' | 'compra';

export interface ActiveSolicitudSummary {
  id: string | number;
  folio: string;
  estado: string;
  fecha: string;
  solicitante: string;
  seccional_id?: number | null;
  seccional_nombre: string;
}

export interface SolicitudQuotaResult {
  blocked: boolean;
  activeItems: ActiveSolicitudSummary[];
  activeCount: number;
  /** -1 = sin límite; 0 = ninguna adicional (máx. 1 en proceso); N = N adicionales (máx. 1 + N en proceso) */
  extraAllowed: number;
  maxAllowed: number | null;
  remaining: number | null;
}

function normalizeEstado(estado?: string | null): string {
  return String(estado || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeText(value?: string | null): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Determina si una solicitud de compra o combustible se encuentra finalizada/entregada.
 */
export function isSolicitudFinalizada(estado?: string | null): boolean {
  const norm = normalizeEstado(estado);
  return norm === 'finalizada' || norm === 'entregada';
}

/**
 * Determina si una solicitud ya cerró su ciclo (finalizada, entregada, rechazada o cancelada).
 */
export function isSolicitudCerrada(estado?: string | null): boolean {
  const norm = normalizeEstado(estado);
  return (
    norm === 'finalizada' ||
    norm === 'entregada' ||
    norm === 'rechazada' ||
    norm === 'cancelada'
  );
}

/**
 * Determina si una solicitud sigue activa / en proceso y bloquea nuevas solicitudes.
 */
export function isSolicitudActivaEnProceso(estado?: string | null): boolean {
  return !isSolicitudCerrada(estado);
}

/**
 * Evalúa si una seccional puede crear otra solicitud según la cantidad de activas
 * y el cupo adicional configurado para el usuario en Accesos.
 */
export function evaluateSolicitudQuota(
  activeItems: ActiveSolicitudSummary[],
  extraAllowed: number
): SolicitudQuotaResult {
  const activeCount = activeItems.length;
  if (extraAllowed < 0) {
    return {
      blocked: false,
      activeItems,
      activeCount,
      extraAllowed: -1,
      maxAllowed: null,
      remaining: null,
    };
  }

  const safeExtra = Math.max(0, Math.floor(Number.isFinite(extraAllowed) ? extraAllowed : 0));
  const maxAllowed = 1 + safeExtra;
  const remaining = Math.max(0, maxAllowed - activeCount);

  return {
    blocked: activeCount >= maxAllowed,
    activeItems,
    activeCount,
    extraAllowed: safeExtra,
    maxAllowed,
    remaining,
  };
}

function matchesSeccional(
  row: { seccional_id?: number | null; seccional_nombre?: string | null },
  seccionalId: number | null | undefined,
  seccionalNombre: string | null | undefined
): boolean {
  if (seccionalId && row.seccional_id && Number(row.seccional_id) === Number(seccionalId)) {
    return true;
  }
  const targetName = normalizeText(seccionalNombre);
  const rowName = normalizeText(row.seccional_nombre);
  if (targetName && rowName && rowName === targetName) {
    return true;
  }
  return false;
}

function mapRawRow(row: any, tipo: TipoSolicitudLimite): ActiveSolicitudSummary {
  return {
    id: row.id ?? row.folio ?? Math.random().toString(36).slice(2),
    folio: String(row.folio || `#${row.id || 'S/N'}`),
    estado: String(row.estado || 'Pendiente'),
    fecha: String(row.fecha_solicitud || row.fecha || row.created_at || ''),
    solicitante: String(
      tipo === 'combustible'
        ? row.nombre_solicitante || row.solicitante || 'Solicitante'
        : row.solicitado_por || row.solicitante || 'Solicitante'
    ),
    seccional_id: row.seccional_id ? Number(row.seccional_id) : null,
    seccional_nombre: String(row.seccional_nombre || ''),
  };
}

/**
 * Consulta las solicitudes activas (no finalizadas ni rechazadas) para una seccional específica.
 * Prioriza el RPC SECURITY DEFINER (si está instalado en Supabase) para no verse limitado por RLS
 * cuando otro usuario de la misma seccional creó la solicitud en proceso, y respalda con consulta
 * directa y lista local.
 */
export async function fetchActiveSolicitudesForSeccional(
  tipo: TipoSolicitudLimite,
  seccionalId: number | null | undefined,
  seccionalNombre: string | null | undefined,
  fallbackList: any[] = []
): Promise<ActiveSolicitudSummary[]> {
  const cleanId = seccionalId ? Number(seccionalId) : null;
  const cleanName = (seccionalNombre || '').trim();

  if (!cleanId && !cleanName) return [];

  const dedupe = (items: ActiveSolicitudSummary[]): ActiveSolicitudSummary[] => {
    const map = new Map<string, ActiveSolicitudSummary>();
    items.forEach((item) => {
      const key = `${item.folio || item.id}`;
      if (!map.has(key)) map.set(key, item);
    });
    return Array.from(map.values());
  };

  const localActive = fallbackList
    .filter((row) => isSolicitudActivaEnProceso(row?.estado) && matchesSeccional(row, cleanId, cleanName))
    .map((row) => mapRawRow(row, tipo));

  // 1. Intentar RPC autorizado en Supabase (migración 60)
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('obtener_solicitudes_activas_seccional', {
      p_tipo: tipo,
      p_seccional_id: cleanId,
      p_seccional_nombre: cleanName || null,
    });

    if (!rpcError && Array.isArray(rpcData)) {
      const mapped = rpcData
        .filter((row: any) => isSolicitudActivaEnProceso(row?.estado))
        .map((row: any) => mapRawRow(row, tipo));
      return dedupe([...mapped, ...localActive]);
    }
  } catch {
    // RPC aún no desplegado; continuamos con consulta directa
  }

  // 2. Consulta directa a la tabla correspondiente
  try {
    const tableName = tipo === 'combustible' ? 'solicitudes_combustible' : 'solicitudes_compra';
    const selectFields =
      tipo === 'combustible'
        ? 'id, folio, estado, fecha_solicitud, created_at, seccional_id, seccional_nombre, nombre_solicitante'
        : 'id, folio, estado, fecha_solicitud, created_at, seccional_id, seccional_nombre, solicitado_por';

    const queries: Promise<any>[] = [];

    if (cleanId) {
      queries.push(
        Promise.resolve(
          supabase
            .from(tableName)
            .select(selectFields)
            .eq('seccional_id', cleanId)
            .order('created_at', { ascending: false })
            .limit(50)
        )
      );
    }

    if (cleanName) {
      queries.push(
        Promise.resolve(
          supabase
            .from(tableName)
            .select(selectFields)
            .ilike('seccional_nombre', cleanName)
            .order('created_at', { ascending: false })
            .limit(50)
        )
      );
    }

    const results = await Promise.all(queries);
    const dbRows: ActiveSolicitudSummary[] = [];

    results.forEach((res) => {
      if (!res?.error && Array.isArray(res.data)) {
        res.data.forEach((row: any) => {
          if (isSolicitudActivaEnProceso(row?.estado)) {
            dbRows.push(mapRawRow(row, tipo));
          }
        });
      }
    });

    return dedupe([...dbRows, ...localActive]);
  } catch {
    return dedupe(localActive);
  }
}
