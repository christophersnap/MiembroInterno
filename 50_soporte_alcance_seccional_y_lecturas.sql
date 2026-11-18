-- ============================================================================
-- MIGRACIÓN 50: SOPORTE CON NOTIFICACIONES DE LECTURA, ALCANCE POR SECCIONAL,
--               PERMISOS DE CREACIÓN Y SOLUCIÓN DE SOLICITUDES
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================================

-- 1. Ampliar tabla public.solicitudes_lecturas para soportar modulo = 'soporte'
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

-- 2. Asegurar estructura e índices de public.soporte_tickets
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
    tipo_caso IN (
      'Sistema',
      'Registro de elementos',
      'Información',
      'Cambio de seccional de elemento',
      'Otro'
    )
  ),
  descripcion TEXT NOT NULL,
  imagenes JSONB DEFAULT '[]'::jsonb,
  ruta_origen TEXT,
  estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK (
    estado IN ('Pendiente', 'En revisión', 'Finalizado')
  ),
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

-- Completar seccional_id / seccional_nombre en tickets históricos cuando el usuario tiene seccional vinculada
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

-- 3. Agregar claves de permisos de Soporte en role_permissions sin sobrescribir ajustes previos
UPDATE public.role_permissions
SET permissions = jsonb_build_object(
  'view_soporte', true,
  'crear_soporte', true,
  'view_soporte_seccional', (role = 'admin'),
  'view_soporte_historial', (role = 'admin'),
  'edit_soporte_estado', (role = 'admin')
) || COALESCE(permissions, '{}'::jsonb);

-- 4. Funciones auxiliares SECURITY DEFINER para evaluar permisos de Soporte (Global / Seccional / Crear / Solventar)
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
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_email = 'christopher.snap@gmail.com' THEN
    RETURN TRUE;
  END IF;

  SELECT ur.role, COALESCE(ur.custom_permissions, '{}'::jsonb), COALESCE(rp.permissions, '{}'::jsonb)
  INTO v_role, v_cp, v_rp
  FROM public.user_roles ur
  LEFT JOIN public.role_permissions rp ON rp.role = ur.role
  WHERE ur.id = v_uid
  LIMIT 1;

  IF v_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  IF v_role IN ('inactivo', 'pendiente') THEN
    RETURN FALSE;
  END IF;

  IF v_cp ? 'view_soporte' AND (v_cp->>'view_soporte')::boolean = false THEN
    RETURN FALSE;
  END IF;

  IF v_cp ? 'crear_soporte' THEN
    RETURN (v_cp->>'crear_soporte')::boolean;
  END IF;

  IF v_rp ? 'crear_soporte' THEN
    RETURN (v_rp->>'crear_soporte')::boolean;
  END IF;

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
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- El propio creador siempre puede ver su solicitud
  IF p_usuario_id IS NOT NULL AND p_usuario_id = v_uid THEN
    RETURN TRUE;
  END IF;

  IF v_email <> '' AND LOWER(COALESCE(p_usuario_email, '')) = v_email THEN
    RETURN TRUE;
  END IF;

  IF v_email = 'christopher.snap@gmail.com' THEN
    RETURN TRUE;
  END IF;

  SELECT
    ur.role,
    ur.socorrista_id,
    COALESCE(ur.custom_permissions, '{}'::jsonb),
    COALESCE(rp.permissions, '{}'::jsonb)
  INTO v_role, v_soc_id, v_cp, v_rp
  FROM public.user_roles ur
  LEFT JOIN public.role_permissions rp ON rp.role = ur.role
  WHERE ur.id = v_uid
  LIMIT 1;

  IF v_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  v_view_hist := CASE
    WHEN v_cp ? 'view_soporte_historial' THEN (v_cp->>'view_soporte_historial')::boolean
    ELSE COALESCE((v_rp->>'view_soporte_historial')::boolean, false)
  END;

  v_view_sec := CASE
    WHEN v_cp ? 'view_soporte_seccional' THEN (v_cp->>'view_soporte_seccional')::boolean
    ELSE COALESCE((v_rp->>'view_soporte_seccional')::boolean, false)
  END;

  v_edit_estado := CASE
    WHEN v_cp ? 'edit_soporte_estado' THEN (v_cp->>'edit_soporte_estado')::boolean
    ELSE COALESCE((v_rp->>'edit_soporte_estado')::boolean, false)
  END;

  v_scope := COALESCE(v_cp #>> '{_module_scopes,soporte}', '');

  -- Alcance Global explícito o heredado por permiso global
  IF v_scope = 'global' THEN
    RETURN TRUE;
  END IF;

  IF v_scope = '' AND (v_view_hist OR (v_edit_estado AND NOT v_view_sec)) THEN
    RETURN TRUE;
  END IF;

  -- Alcance por Seccional (explícito en _module_scopes.soporte o por permiso view_soporte_seccional)
  IF v_scope = 'seccional' OR (v_scope = '' AND v_view_sec) THEN
    v_allowed_sec_json := v_cp #> '{_module_seccionales,soporte}';

    IF v_allowed_sec_json IS NOT NULL
       AND jsonb_typeof(v_allowed_sec_json) = 'array'
       AND jsonb_array_length(v_allowed_sec_json) > 0 THEN
      IF p_seccional_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_allowed_sec_json) AS elem(val)
        WHERE elem.val = p_seccional_id::text
      ) THEN
        RETURN TRUE;
      END IF;

      IF COALESCE(TRIM(p_seccional_nombre), '') <> '' AND EXISTS (
        SELECT 1
        FROM public.seccionales s
        JOIN jsonb_array_elements_text(v_allowed_sec_json) AS elem(val)
          ON elem.val = s.id::text
        WHERE LOWER(p_seccional_nombre) LIKE '%' || LOWER(s.nombre) || '%'
      ) THEN
        RETURN TRUE;
      END IF;

      RETURN FALSE;
    END IF;

    -- Fallback: seccional asignada al socorrista o dirigida por el usuario
    SELECT COALESCE(soc.seccional_id, dir_sec.id)
    INTO v_user_sec_id
    FROM (SELECT 1) dummy
    LEFT JOIN public.socorristas soc ON soc.id = v_soc_id
    LEFT JOIN public.seccionales dir_sec ON dir_sec.director_id = v_uid;

    IF v_user_sec_id IS NOT NULL THEN
      IF p_seccional_id IS NOT NULL AND p_seccional_id = v_user_sec_id THEN
        RETURN TRUE;
      END IF;

      IF COALESCE(TRIM(p_seccional_nombre), '') <> '' AND EXISTS (
        SELECT 1
        FROM public.seccionales s
        WHERE s.id = v_user_sec_id
          AND LOWER(p_seccional_nombre) LIKE '%' || LOWER(s.nombre) || '%'
      ) THEN
        RETURN TRUE;
      END IF;
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
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_email = 'christopher.snap@gmail.com' THEN
    RETURN TRUE;
  END IF;

  SELECT
    ur.role,
    COALESCE(ur.custom_permissions, '{}'::jsonb),
    COALESCE(rp.permissions, '{}'::jsonb)
  INTO v_role, v_cp, v_rp
  FROM public.user_roles ur
  LEFT JOIN public.role_permissions rp ON rp.role = ur.role
  WHERE ur.id = v_uid
  LIMIT 1;

  IF v_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  v_edit_estado := CASE
    WHEN v_cp ? 'edit_soporte_estado' THEN (v_cp->>'edit_soporte_estado')::boolean
    ELSE COALESCE((v_rp->>'edit_soporte_estado')::boolean, false)
  END;

  IF NOT v_edit_estado THEN
    RETURN FALSE;
  END IF;

  -- Si además puede leer ese ticket según su alcance (global o seccional), puede solventarlo
  RETURN public.can_read_soporte_ticket(NULL, NULL, p_seccional_id, p_seccional_nombre);
END;
$$;

REVOKE ALL ON FUNCTION public.can_create_soporte_ticket() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_create_soporte_ticket() TO authenticated;

REVOKE ALL ON FUNCTION public.can_read_soporte_ticket(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_soporte_ticket(UUID, TEXT, INTEGER, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.can_resolve_soporte_ticket(INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_resolve_soporte_ticket(INTEGER, TEXT) TO authenticated;

-- 5. Políticas RLS actualizadas en public.soporte_tickets
ALTER TABLE public.soporte_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura de soporte por usuario o historial autorizado" ON public.soporte_tickets;
CREATE POLICY "Lectura de soporte por usuario o historial autorizado"
  ON public.soporte_tickets
  FOR SELECT
  TO authenticated
  USING (
    public.can_read_soporte_ticket(usuario_id, usuario_email, seccional_id, seccional_nombre)
  );

DROP POLICY IF EXISTS "Usuarios autenticados pueden crear tickets de soporte" ON public.soporte_tickets;
CREATE POLICY "Usuarios autenticados pueden crear tickets de soporte"
  ON public.soporte_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_create_soporte_ticket()
  );

DROP POLICY IF EXISTS "Autorizados pueden gestionar y finalizar soporte" ON public.soporte_tickets;
CREATE POLICY "Autorizados pueden gestionar y finalizar soporte"
  ON public.soporte_tickets
  FOR UPDATE
  TO authenticated
  USING (
    public.can_resolve_soporte_ticket(seccional_id, seccional_nombre)
  )
  WITH CHECK (
    public.can_resolve_soporte_ticket(seccional_id, seccional_nombre)
  );

GRANT SELECT, INSERT, UPDATE ON public.soporte_tickets TO authenticated;

NOTIFY pgrst, 'reload schema';
