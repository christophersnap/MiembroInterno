import { supabase } from './supabase';
import { getApiUrl } from './api';
import { optimizeImageForUpload } from '../utils/imageOptimizer';

export type TipoCasoSoporte =
  | 'Sistema'
  | 'Registro de elementos'
  | 'Información'
  | 'Cambio de seccional de elemento'
  | 'Otro';

export type EstadoSoporte = 'Pendiente' | 'En revisión' | 'Finalizado';

export const TIPOS_CASO_SOPORTE: {
  value: TipoCasoSoporte;
  label: string;
  desc: string;
}[] = [
  {
    value: 'Sistema',
    label: 'Sistema',
    desc: 'Errores en pantallas, fallos de carga, permisos o anomalías técnicas.',
  },
  {
    value: 'Registro de elementos',
    label: 'Registro de elementos',
    desc: 'Inconvenientes al ingresar nuevos socorristas, DUI o carnets.',
  },
  {
    value: 'Información',
    label: 'Información',
    desc: 'Corrección de datos, cargos, constancias o consultas administrativas.',
  },
  {
    value: 'Cambio de seccional de elemento',
    label: 'Cambio de seccional de elemento',
    desc: 'Solicitud de traslado o reasignación de un elemento a otra seccional.',
  },
  {
    value: 'Otro',
    label: 'Otro',
    desc: 'Cualquier otro reporte o requerimiento institucional.',
  },
];

export interface SoporteImagen {
  url: string;
  nombre: string;
}

export interface SoporteTicket {
  id: string;
  folio: string;
  usuario_id?: string | null;
  usuario_nombre: string;
  usuario_email?: string | null;
  seccional_id?: number | null;
  seccional_nombre?: string | null;
  motivo: string;
  tipo_caso: TipoCasoSoporte;
  descripcion: string;
  imagenes: SoporteImagen[];
  ruta_origen?: string | null;
  estado: EstadoSoporte;
  nota_resolucion?: string | null;
  atendido_por_id?: string | null;
  atendido_por_nombre?: string | null;
  fecha_finalizacion?: string | null;
  created_at: string;
  updated_at?: string;
}

const LS_SOPORTE_KEY = 'cv_soporte_tickets';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const generateSoporteUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const generateSoporteFolio = (): string => {
  const year = new Date().getFullYear();
  const suffix = Math.floor(1000 + Math.random() * 9000);
  const timeTail = String(Date.now()).slice(-2);
  return `SOP-${year}-${suffix}${timeTail}`;
};

const normalizeImagenes = (raw: any): SoporteImagen[] => {
  if (!raw) return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item, idx) => {
      if (typeof item === 'string') return { url: item, nombre: `Evidencia_${idx + 1}.jpg` };
      if (item && typeof item === 'object' && item.url) {
        return { url: String(item.url), nombre: String(item.nombre || `Evidencia_${idx + 1}.jpg`) };
      }
      return null;
    })
    .filter((x): x is SoporteImagen => Boolean(x));
};

const normalizeTicket = (row: any): SoporteTicket => ({
  id: String(row.id),
  folio: String(row.folio || `SOP-${String(row.id).slice(0, 6).toUpperCase()}`),
  usuario_id: row.usuario_id || null,
  usuario_nombre: row.usuario_nombre || 'Usuario',
  usuario_email: row.usuario_email || null,
  seccional_id: row.seccional_id ? Number(row.seccional_id) : null,
  seccional_nombre: row.seccional_nombre || null,
  motivo: row.motivo || '',
  tipo_caso: (row.tipo_caso || 'Sistema') as TipoCasoSoporte,
  descripcion: row.descripcion || '',
  imagenes: normalizeImagenes(row.imagenes),
  ruta_origen: row.ruta_origen || null,
  estado: (row.estado || 'Pendiente') as EstadoSoporte,
  nota_resolucion: row.nota_resolucion || null,
  atendido_por_id: row.atendido_por_id || null,
  atendido_por_nombre: row.atendido_por_nombre || null,
  fecha_finalizacion: row.fecha_finalizacion || null,
  created_at: row.created_at || new Date().toISOString(),
  updated_at: row.updated_at || row.created_at || new Date().toISOString(),
});

export async function uploadSoporteImage(rawFile: File): Promise<SoporteImagen> {
  const file = await optimizeImageForUpload(rawFile, {
    profile: 'general',
    modulo: 'soporte',
    bucketId: 'socorristas',
  });
  const safeName = file.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `soporte/${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${safeName}`;

  // 1. Subir directo a Supabase Storage
  for (const bucket of ['socorristas', 'archivos'] as const) {
    try {
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'image/jpeg',
      });
      if (!error) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        if (data?.publicUrl) {
          return { url: data.publicUrl, nombre: rawFile.name };
        }
      }
    } catch {
      // probar siguiente opción
    }
  }

  // 2. Fallback a API local /api/upload-file
  try {
    const formData = new FormData();
    formData.append('archivo', file);
    const res = await fetch(getApiUrl('/api/upload-file'), {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.url) {
        return { url: json.url, nombre: file.name };
      }
    }
  } catch {
    // probar último recurso comprimido
  }

  // 3. Fallback comprimido DataURL (para que las capturas siempre se adjunten)
  const compressedDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        const maxDim = 1400;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(raw);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => resolve(raw);
      img.src = raw;
    };
    reader.onerror = () => reject(new Error('No se pudo leer la imagen adjunta'));
    reader.readAsDataURL(file);
  });

  return { url: compressedDataUrl, nombre: file.name };
}

export async function fetchSoporteTickets(opts: {
  usuarioId?: string | null;
  usuarioEmail?: string | null;
  canViewAll: boolean;
}): Promise<{ tickets: SoporteTicket[]; supabaseError: string | null }> {
  let supabaseError: string | null = null;
  const merged = new Map<string, SoporteTicket>();
  let supabaseOk = false;

  try {
    let query = supabase
      .from('soporte_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (!opts.canViewAll && opts.usuarioId && UUID_REGEX.test(opts.usuarioId)) {
      query = query.eq('usuario_id', opts.usuarioId);
    }

    const { data, error } = await query;
    if (error) {
      supabaseError = error.message;
    } else if (Array.isArray(data)) {
      supabaseOk = true;
      for (const row of data) {
        const item = normalizeTicket(row);
        merged.set(item.id, item);
      }
    }
  } catch (err: any) {
    supabaseError = err?.message || 'Error conectando con Supabase';
  }

  // Respaldo API local si Supabase falló o para registros pendientes locales
  if (!supabaseOk || merged.size === 0) {
    try {
      const qs = opts.canViewAll
        ? '?all=true'
        : `?usuario_id=${encodeURIComponent(opts.usuarioId || '')}&usuario_email=${encodeURIComponent(
            opts.usuarioEmail || ''
          )}`;
      const res = await fetch(getApiUrl(`/api/soporte${qs}`));
      if (res.ok) {
        const localRows = await res.json();
        if (Array.isArray(localRows)) {
          for (const row of localRows) {
            const item = normalizeTicket(row);
            if (!merged.has(item.id)) merged.set(item.id, item);
          }
        }
      }
    } catch {
      // Sin API local
    }
  }

  // Fallback localStorage si no hubo datos ni de Supabase ni API local
  if (merged.size === 0 && !supabaseOk) {
    try {
      const cached = localStorage.getItem(LS_SOPORTE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          for (const row of parsed) {
            const item = normalizeTicket(row);
            if (
              opts.canViewAll ||
              (opts.usuarioId && item.usuario_id === opts.usuarioId) ||
              (opts.usuarioEmail &&
                item.usuario_email?.toLowerCase() === opts.usuarioEmail.toLowerCase())
            ) {
              merged.set(item.id, item);
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  const list = Array.from(merged.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Asegurar aislamiento estricto del lado cliente cuando no tiene acceso al historial global
  const scopedList = opts.canViewAll
    ? list
    : list.filter(
        (t) =>
          (opts.usuarioId && t.usuario_id === opts.usuarioId) ||
          (opts.usuarioEmail &&
            t.usuario_email &&
            t.usuario_email.toLowerCase() === opts.usuarioEmail.toLowerCase())
      );

  if (supabaseOk) {
    try {
      localStorage.setItem(LS_SOPORTE_KEY, JSON.stringify(list));
    } catch {}
  }

  return { tickets: scopedList, supabaseError };
}

export async function createSoporteTicket(input: {
  usuario_id?: string | null;
  usuario_nombre: string;
  usuario_email?: string | null;
  seccional_id?: number | null;
  seccional_nombre?: string | null;
  motivo: string;
  tipo_caso: TipoCasoSoporte;
  descripcion: string;
  imagenes: SoporteImagen[];
  ruta_origen?: string | null;
}): Promise<{ ticket: SoporteTicket; savedInSupabase: boolean; warning?: string }> {
  const id = generateSoporteUuid();
  const folio = generateSoporteFolio();
  const now = new Date().toISOString();

  const validUserId = input.usuario_id && UUID_REGEX.test(input.usuario_id) ? input.usuario_id : null;

  const payload: Record<string, any> = {
    id,
    folio,
    usuario_id: validUserId,
    usuario_nombre: input.usuario_nombre,
    usuario_email: input.usuario_email || null,
    seccional_id: input.seccional_id || null,
    seccional_nombre: input.seccional_nombre || null,
    motivo: input.motivo.trim(),
    tipo_caso: input.tipo_caso,
    descripcion: input.descripcion.trim(),
    imagenes: input.imagenes || [],
    ruta_origen: input.ruta_origen || null,
    estado: 'Pendiente',
    nota_resolucion: null,
    created_at: now,
    updated_at: now,
  };

  let savedInSupabase = false;
  let warning: string | undefined;
  let ticket: SoporteTicket = normalizeTicket(payload);

  try {
    const { data, error } = await supabase
      .from('soporte_tickets')
      .insert([payload])
      .select()
      .single();

    if (!error && data) {
      savedInSupabase = true;
      ticket = normalizeTicket(data);
    } else if (error) {
      warning = error.message;
      console.warn('Error guardando ticket de soporte en Supabase:', error.message);
    }
  } catch (err: any) {
    warning = err?.message || 'Error de conexión con Supabase';
  }

  // Guardar también en API local / localStorage como respaldo
  try {
    await fetch(getApiUrl('/api/soporte'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticket),
    });
  } catch {}

  try {
    const prevRaw = localStorage.getItem(LS_SOPORTE_KEY);
    const prev = prevRaw ? JSON.parse(prevRaw) : [];
    const next = Array.isArray(prev) ? [ticket, ...prev.filter((x: any) => x.id !== ticket.id)] : [ticket];
    localStorage.setItem(LS_SOPORTE_KEY, JSON.stringify(next));
  } catch {}

  window.dispatchEvent(new Event('soporte_updated'));

  return { ticket, savedInSupabase, warning };
}

export async function updateSoporteTicketEstado(input: {
  id: string;
  estado: EstadoSoporte;
  nota_resolucion: string | null;
  atendido_por_id?: string | null;
  atendido_por_nombre: string;
}): Promise<{ ticket?: SoporteTicket; error?: string }> {
  const now = new Date().toISOString();
  const validAdminId =
    input.atendido_por_id && UUID_REGEX.test(input.atendido_por_id) ? input.atendido_por_id : null;

  const updatePayload: Record<string, any> = {
    estado: input.estado,
    nota_resolucion: input.nota_resolucion?.trim() ? input.nota_resolucion.trim() : null,
    atendido_por_id: validAdminId,
    atendido_por_nombre: input.atendido_por_nombre,
    fecha_finalizacion: input.estado === 'Finalizado' ? now : null,
    updated_at: now,
  };

  let supabaseErrMsg: string | undefined;
  let updatedTicket: SoporteTicket | undefined;

  try {
    const { data, error } = await supabase
      .from('soporte_tickets')
      .update(updatePayload)
      .eq('id', input.id)
      .select()
      .single();

    if (!error && data) {
      updatedTicket = normalizeTicket(data);
    } else if (error) {
      supabaseErrMsg = error.message;
    }
  } catch (err: any) {
    supabaseErrMsg = err?.message || 'Error al actualizar ticket';
  }

  try {
    await fetch(getApiUrl(`/api/soporte/${encodeURIComponent(input.id)}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload),
    });
  } catch {}

  try {
    const prevRaw = localStorage.getItem(LS_SOPORTE_KEY);
    if (prevRaw) {
      const prev = JSON.parse(prevRaw);
      if (Array.isArray(prev)) {
        const next = prev.map((t: any) => (t.id === input.id ? { ...t, ...updatePayload } : t));
        localStorage.setItem(LS_SOPORTE_KEY, JSON.stringify(next));
      }
    }
  } catch {}

  window.dispatchEvent(new Event('soporte_updated'));

  return { ticket: updatedTicket, error: supabaseErrMsg };
}
