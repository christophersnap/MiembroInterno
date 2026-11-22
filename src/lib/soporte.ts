import { supabase } from './supabase';
import { getApiUrl } from './api';
import { optimizeImageForUpload } from '../utils/imageOptimizer';
import { getElSalvadorIsoTimestamp } from '../utils/dateUtils';

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
  created_at: row.created_at || getElSalvadorIsoTimestamp(),
  updated_at: row.updated_at || row.created_at || getElSalvadorIsoTimestamp(),
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

export const SQL_MIGRATION_50_TEXT = `-- ============================================================================
-- MIGRACIÓN 50: SOPORTE CON NOTIFICACIONES DE LECTURA, ALCANCE POR SECCIONAL,
--               PERMISOS DE CREACIÓN Y SOLUCIÓN DE SOLICITUDES
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.solicitudes_lecturas (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modulo TEXT NOT NULL,
  solicitud_key TEXT NOT NULL,
  leido_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, modulo, solicitud_key)
);

DO $$
DECLARE
  v_con RECORD;
BEGIN
  FOR v_con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'solicitudes_lecturas'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%modulo%'
  LOOP
    EXECUTE format('ALTER TABLE public.solicitudes_lecturas DROP CONSTRAINT IF EXISTS %I', v_con.conname);
  END LOOP;
END $$;

ALTER TABLE public.solicitudes_lecturas
  ADD CONSTRAINT solicitudes_lecturas_modulo_check
  CHECK (modulo IN ('carnet', 'combustible', 'compra', 'soporte'));

CREATE INDEX IF NOT EXISTS idx_solicitudes_lecturas_user_modulo
  ON public.solicitudes_lecturas (user_id, modulo);

ALTER TABLE public.solicitudes_lecturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "solicitudes_lecturas_select_own" ON public.solicitudes_lecturas;
CREATE POLICY "solicitudes_lecturas_select_own"
  ON public.solicitudes_lecturas FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "solicitudes_lecturas_insert_own" ON public.solicitudes_lecturas;
CREATE POLICY "solicitudes_lecturas_insert_own"
  ON public.solicitudes_lecturas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "solicitudes_lecturas_update_own" ON public.solicitudes_lecturas;
CREATE POLICY "solicitudes_lecturas_update_own"
  ON public.solicitudes_lecturas FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "solicitudes_lecturas_delete_own" ON public.solicitudes_lecturas;
CREATE POLICY "solicitudes_lecturas_delete_own"
  ON public.solicitudes_lecturas FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitudes_lecturas TO authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'solicitudes_lecturas_id_seq') THEN
    GRANT USAGE, SELECT ON SEQUENCE public.solicitudes_lecturas_id_seq TO authenticated;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.soporte_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT UNIQUE,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_nombre TEXT NOT NULL,
  usuario_email TEXT,
  seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL,
  seccional_nombre TEXT,
  motivo TEXT NOT NULL,
  tipo_caso TEXT NOT NULL CHECK (
    tipo_caso IN ('Sistema', 'Registro de elementos', 'Información', 'Cambio de seccional de elemento', 'Otro')
  ),
  descripcion TEXT NOT NULL,
  imagenes JSONB DEFAULT '[]'::jsonb,
  ruta_origen TEXT,
  estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'En revisión', 'Finalizado')),
  nota_resolucion TEXT,
  atendido_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  atendido_por_nombre TEXT,
  fecha_finalizacion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_soporte_tickets_usuario_id ON public.soporte_tickets(usuario_id);
CREATE INDEX IF NOT EXISTS idx_soporte_tickets_seccional_id ON public.soporte_tickets(seccional_id);
CREATE INDEX IF NOT EXISTS idx_soporte_tickets_estado ON public.soporte_tickets(estado);
CREATE INDEX IF NOT EXISTS idx_soporte_tickets_created_at ON public.soporte_tickets(created_at DESC);

UPDATE public.soporte_tickets st
SET
  seccional_id = sub.sec_id,
  seccional_nombre = COALESCE(st.seccional_nombre, sub.sec_nombre)
FROM (
  SELECT
    ur.id AS uid,
    COALESCE(soc.seccional_id, dir_sec.id) AS sec_id,
    COALESCE(sec_soc.nombre, dir_sec.nombre) AS sec_nombre
  FROM public.user_roles ur
  LEFT JOIN public.socorristas soc ON soc.id = ur.socorrista_id
  LEFT JOIN public.seccionales sec_soc ON sec_soc.id = soc.seccional_id
  LEFT JOIN public.seccionales dir_sec ON dir_sec.director_id = ur.id
) sub
WHERE st.usuario_id = sub.uid
  AND st.seccional_id IS NULL
  AND sub.sec_id IS NOT NULL;

UPDATE public.role_permissions
SET permissions = jsonb_build_object(
  'view_soporte', true,
  'crear_soporte', true,
  'view_soporte_seccional', (role = 'admin'),
  'view_soporte_historial', (role = 'admin'),
  'edit_soporte_estado', (role = 'admin')
) || COALESCE(permissions, '{}'::jsonb);

CREATE OR REPLACE FUNCTION public.can_create_soporte_ticket()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
  v_role TEXT;
  v_cp JSONB;
  v_rp JSONB;
BEGIN
  IF v_uid IS NULL THEN RETURN FALSE; END IF;
  IF v_email = 'christopher.snap@gmail.com' THEN RETURN TRUE; END IF;

  SELECT ur.role, COALESCE(ur.custom_permissions, '{}'::jsonb), COALESCE(rp.permissions, '{}'::jsonb)
  INTO v_role, v_cp, v_rp
  FROM public.user_roles ur
  LEFT JOIN public.role_permissions rp ON rp.role = ur.role
  WHERE ur.id = v_uid
  LIMIT 1;

  IF v_role = 'admin' THEN RETURN TRUE; END IF;
  IF v_role IN ('inactivo', 'pendiente') THEN RETURN FALSE; END IF;
  IF v_cp ? 'view_soporte' AND (v_cp->>'view_soporte')::boolean = false THEN RETURN FALSE; END IF;
  IF v_cp ? 'crear_soporte' THEN RETURN (v_cp->>'crear_soporte')::boolean; END IF;
  IF v_rp ? 'crear_soporte' THEN RETURN (v_rp->>'crear_soporte')::boolean; END IF;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_read_soporte_ticket(
  p_usuario_id UUID,
  p_usuario_email TEXT,
  p_seccional_id INTEGER,
  p_seccional_nombre TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
  v_role TEXT;
  v_soc_id INTEGER;
  v_user_sec_id INTEGER;
  v_cp JSONB := '{}'::jsonb;
  v_rp JSONB := '{}'::jsonb;
  v_scope TEXT;
  v_view_hist BOOLEAN;
  v_view_sec BOOLEAN;
  v_edit_estado BOOLEAN;
  v_allowed_sec_json JSONB;
BEGIN
  IF v_uid IS NULL THEN RETURN FALSE; END IF;
  IF p_usuario_id IS NOT NULL AND p_usuario_id = v_uid THEN RETURN TRUE; END IF;
  IF v_email <> '' AND LOWER(COALESCE(p_usuario_email, '')) = v_email THEN RETURN TRUE; END IF;
  IF v_email = 'christopher.snap@gmail.com' THEN RETURN TRUE; END IF;

  SELECT ur.role, ur.socorrista_id, COALESCE(ur.custom_permissions, '{}'::jsonb), COALESCE(rp.permissions, '{}'::jsonb)
  INTO v_role, v_soc_id, v_cp, v_rp
  FROM public.user_roles ur
  LEFT JOIN public.role_permissions rp ON rp.role = ur.role
  WHERE ur.id = v_uid
  LIMIT 1;

  IF v_role = 'admin' THEN RETURN TRUE; END IF;

  v_view_hist := CASE WHEN v_cp ? 'view_soporte_historial' THEN (v_cp->>'view_soporte_historial')::boolean ELSE COALESCE((v_rp->>'view_soporte_historial')::boolean, false) END;
  v_view_sec := CASE WHEN v_cp ? 'view_soporte_seccional' THEN (v_cp->>'view_soporte_seccional')::boolean ELSE COALESCE((v_rp->>'view_soporte_seccional')::boolean, false) END;
  v_edit_estado := CASE WHEN v_cp ? 'edit_soporte_estado' THEN (v_cp->>'edit_soporte_estado')::boolean ELSE COALESCE((v_rp->>'edit_soporte_estado')::boolean, false) END;
  v_scope := COALESCE(v_cp #>> '{_module_scopes,soporte}', '');

  IF v_scope = 'global' THEN RETURN TRUE; END IF;
  IF v_scope = '' AND (v_view_hist OR (v_edit_estado AND NOT v_view_sec)) THEN RETURN TRUE; END IF;

  IF v_scope = 'seccional' OR (v_scope = '' AND v_view_sec) THEN
    v_allowed_sec_json := v_cp #> '{_module_seccionales,soporte}';
    IF v_allowed_sec_json IS NOT NULL AND jsonb_typeof(v_allowed_sec_json) = 'array' AND jsonb_array_length(v_allowed_sec_json) > 0 THEN
      IF p_seccional_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(v_allowed_sec_json) AS elem(val) WHERE elem.val = p_seccional_id::text
      ) THEN RETURN TRUE; END IF;
      IF COALESCE(TRIM(p_seccional_nombre), '') <> '' AND EXISTS (
        SELECT 1 FROM public.seccionales s JOIN jsonb_array_elements_text(v_allowed_sec_json) AS elem(val) ON elem.val = s.id::text
        WHERE LOWER(p_seccional_nombre) LIKE '%' || LOWER(s.nombre) || '%'
      ) THEN RETURN TRUE; END IF;
      RETURN FALSE;
    END IF;

    SELECT COALESCE(soc.seccional_id, dir_sec.id)
    INTO v_user_sec_id
    FROM (SELECT 1) dummy
    LEFT JOIN public.socorristas soc ON soc.id = v_soc_id
    LEFT JOIN public.seccionales dir_sec ON dir_sec.director_id = v_uid;

    IF v_user_sec_id IS NOT NULL THEN
      IF p_seccional_id IS NOT NULL AND p_seccional_id = v_user_sec_id THEN RETURN TRUE; END IF;
      IF COALESCE(TRIM(p_seccional_nombre), '') <> '' AND EXISTS (
        SELECT 1 FROM public.seccionales s WHERE s.id = v_user_sec_id AND LOWER(p_seccional_nombre) LIKE '%' || LOWER(s.nombre) || '%'
      ) THEN RETURN TRUE; END IF;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_resolve_soporte_ticket(
  p_seccional_id INTEGER,
  p_seccional_nombre TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
  v_role TEXT;
  v_cp JSONB := '{}'::jsonb;
  v_rp JSONB := '{}'::jsonb;
  v_edit_estado BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RETURN FALSE; END IF;
  IF v_email = 'christopher.snap@gmail.com' THEN RETURN TRUE; END IF;

  SELECT ur.role, COALESCE(ur.custom_permissions, '{}'::jsonb), COALESCE(rp.permissions, '{}'::jsonb)
  INTO v_role, v_cp, v_rp
  FROM public.user_roles ur
  LEFT JOIN public.role_permissions rp ON rp.role = ur.role
  WHERE ur.id = v_uid
  LIMIT 1;

  IF v_role = 'admin' THEN RETURN TRUE; END IF;
  v_edit_estado := CASE WHEN v_cp ? 'edit_soporte_estado' THEN (v_cp->>'edit_soporte_estado')::boolean ELSE COALESCE((v_rp->>'edit_soporte_estado')::boolean, false) END;
  IF NOT v_edit_estado THEN RETURN FALSE; END IF;

  RETURN public.can_read_soporte_ticket(NULL, NULL, p_seccional_id, p_seccional_nombre);
END;
$$;

REVOKE ALL ON FUNCTION public.can_create_soporte_ticket() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_create_soporte_ticket() TO authenticated;
REVOKE ALL ON FUNCTION public.can_read_soporte_ticket(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_soporte_ticket(UUID, TEXT, INTEGER, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.can_resolve_soporte_ticket(INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_resolve_soporte_ticket(INTEGER, TEXT) TO authenticated;

ALTER TABLE public.soporte_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura de soporte por usuario o historial autorizado" ON public.soporte_tickets;
CREATE POLICY "Lectura de soporte por usuario o historial autorizado"
  ON public.soporte_tickets FOR SELECT TO authenticated
  USING (public.can_read_soporte_ticket(usuario_id, usuario_email, seccional_id, seccional_nombre));

DROP POLICY IF EXISTS "Usuarios autenticados pueden crear tickets de soporte" ON public.soporte_tickets;
CREATE POLICY "Usuarios autenticados pueden crear tickets de soporte"
  ON public.soporte_tickets FOR INSERT TO authenticated
  WITH CHECK (public.can_create_soporte_ticket());

DROP POLICY IF EXISTS "Autorizados pueden gestionar y finalizar soporte" ON public.soporte_tickets;
CREATE POLICY "Autorizados pueden gestionar y finalizar soporte"
  ON public.soporte_tickets FOR UPDATE TO authenticated
  USING (public.can_resolve_soporte_ticket(seccional_id, seccional_nombre))
  WITH CHECK (public.can_resolve_soporte_ticket(seccional_id, seccional_nombre));

GRANT SELECT, INSERT, UPDATE ON public.soporte_tickets TO authenticated;

NOTIFY pgrst, 'reload schema';`;

export function matchesSoporteTicketScope(
  ticket: SoporteTicket,
  opts: {
    scope: 'global' | 'seccional' | 'usuario';
    usuarioId?: string | null;
    usuarioEmail?: string | null;
    allowedSeccionalIds?: number[];
    userSeccionalId?: number | null;
    userSeccionalNombre?: string | null;
    seccionalesCatalog?: { id: number; nombre: string }[];
  }
): boolean {
  if (opts.scope === 'global') return true;

  const isOwn =
    Boolean(opts.usuarioId && ticket.usuario_id && ticket.usuario_id === opts.usuarioId) ||
    Boolean(
      opts.usuarioEmail &&
        ticket.usuario_email &&
        ticket.usuario_email.toLowerCase() === opts.usuarioEmail.toLowerCase()
    );

  if (isOwn) return true;
  if (opts.scope === 'usuario') return false;

  // scope === 'seccional'
  const targetIds =
    opts.allowedSeccionalIds && opts.allowedSeccionalIds.length > 0
      ? opts.allowedSeccionalIds
      : opts.userSeccionalId
      ? [Number(opts.userSeccionalId)]
      : [];

  if (targetIds.length > 0) {
    if (ticket.seccional_id && targetIds.includes(Number(ticket.seccional_id))) {
      return true;
    }
    const allowedNames = (opts.seccionalesCatalog || [])
      .filter((s) => targetIds.includes(Number(s.id)))
      .map((s) => String(s.nombre || '').toLowerCase());
    if (
      ticket.seccional_nombre &&
      allowedNames.some(
        (n) => n && String(ticket.seccional_nombre).toLowerCase().includes(n)
      )
    ) {
      return true;
    }
    return false;
  }

  if (opts.userSeccionalNombre && ticket.seccional_nombre) {
    return String(ticket.seccional_nombre)
      .toLowerCase()
      .includes(opts.userSeccionalNombre.toLowerCase());
  }

  return false;
}

export async function fetchSoporteTickets(opts: {
  usuarioId?: string | null;
  usuarioEmail?: string | null;
  scope?: 'global' | 'seccional' | 'usuario';
  canViewAll?: boolean;
  allowedSeccionalIds?: number[];
  userSeccionalId?: number | null;
  userSeccionalNombre?: string | null;
}): Promise<{ tickets: SoporteTicket[]; supabaseError: string | null }> {
  const effectiveScope: 'global' | 'seccional' | 'usuario' =
    opts.scope || (opts.canViewAll ? 'global' : 'usuario');
  const needsBroaderQuery = effectiveScope === 'global' || effectiveScope === 'seccional';

  let supabaseError: string | null = null;
  const merged = new Map<string, SoporteTicket>();
  let supabaseOk = false;
  let seccionalesCatalog: { id: number; nombre: string }[] = [];

  if (effectiveScope === 'seccional') {
    try {
      const { data: secRows } = await supabase.from('seccionales').select('id, nombre');
      if (Array.isArray(secRows)) seccionalesCatalog = secRows;
    } catch {}
  }

  try {
    let query = supabase
      .from('soporte_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (!needsBroaderQuery && opts.usuarioId && UUID_REGEX.test(opts.usuarioId)) {
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
      const qs = needsBroaderQuery
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
            merged.set(item.id, item);
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

  const scopedList = list.filter((t) =>
    matchesSoporteTicketScope(t, {
      scope: effectiveScope,
      usuarioId: opts.usuarioId,
      usuarioEmail: opts.usuarioEmail,
      allowedSeccionalIds: opts.allowedSeccionalIds,
      userSeccionalId: opts.userSeccionalId,
      userSeccionalNombre: opts.userSeccionalNombre,
      seccionalesCatalog,
    })
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
  const now = getElSalvadorIsoTimestamp();

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
  const now = getElSalvadorIsoTimestamp();
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
