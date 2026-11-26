-- =========================================================================================
-- MIGRACIÓN 62: PERMISO GRANULAR "SOLO VER" VS "VER Y CORREGIR" EN SOLICITUDES DE CARNET
-- Cruz Verde Salvadoreña - Sistema Institucional
-- =========================================================================================
-- Qué hace esta migración (100% idempotente, NO borra ni altera registros existentes):
-- 1. Agrega la clave de permiso `corregir_solicitudes_carnet` en `public.role_permissions`:
--      - Roles admin / superadmin: `true`
--      - Otros roles: hereda `edit_solicitudes_carnet` si ya lo tenían en true; en caso
--        contrario inicia en `false` (modo "Solo ver": ve la solicitud y la observación,
--        sin poder corregir ni cancelar).
-- 2. Crea la función auxiliar `public.usuario_puede_corregir_solicitud_carnet(UUID)` que
--    evalúa el permiso efectivo respetando:
--      - Rol admin / superadmin o correo administrador principal
--      - Permiso `edit_solicitudes_carnet` (Gestionar incluye corregir)
--      - Override individual en `public.user_roles.custom_permissions`
--      - Permiso base del rol en `public.role_permissions.permissions`
-- 3. Refuerza las funciones RPC `public.corregir_solicitud_carnet` y
--    `public.cancelar_solicitud_carnet` y la política RLS de UPDATE en
--    `public.solicitudes_carnet` para bloquear a nivel de base de datos a los usuarios
--    configurados en modo "Solo ver" (sin permiso de corregir).
-- 4. Recarga el esquema de PostgREST.
-- =========================================================================================

-- -----------------------------------------------------------------------------------------
-- 1. SEMBRAR `corregir_solicitudes_carnet` EN public.role_permissions (SIN SOBRESCRIBIR)
-- -----------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.role_permissions') IS NOT NULL THEN
    -- Admin / superadmin siempre habilitado
    UPDATE public.role_permissions
    SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_build_object('corregir_solicitudes_carnet', true)
    WHERE lower(role) IN ('admin', 'superadmin')
      AND NOT (COALESCE(permissions, '{}'::jsonb) ? 'corregir_solicitudes_carnet');

    -- Otros roles: true solo si ya tenían edit_solicitudes_carnet = true; de lo contrario false (Solo Ver)
    UPDATE public.role_permissions
    SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_build_object(
      'corregir_solicitudes_carnet',
      COALESCE((permissions ->> 'edit_solicitudes_carnet')::boolean, false)
    )
    WHERE lower(role) NOT IN ('admin', 'superadmin')
      AND NOT (COALESCE(permissions, '{}'::jsonb) ? 'corregir_solicitudes_carnet');
  END IF;
END $$;

-- -----------------------------------------------------------------------------------------
-- 2. FUNCIÓN AUXILIAR: VERIFICAR SI EL USUARIO PUEDE CORREGIR / CANCELAR SOLICITUDES DE CARNET
-- -----------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.usuario_puede_corregir_solicitud_carnet(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_email TEXT;
  v_custom_perms JSONB := '{}'::jsonb;
  v_role_perms JSONB := '{}'::jsonb;
  v_can_edit BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT
    ur.role,
    ur.email,
    COALESCE(ur.custom_permissions, '{}'::jsonb)
  INTO v_role, v_email, v_custom_perms
  FROM public.user_roles ur
  WHERE ur.id = p_user_id
  LIMIT 1;

  -- Administradores siempre pueden corregir
  IF lower(COALESCE(v_role, '')) IN ('admin', 'superadmin')
     OR lower(COALESCE(v_email, '')) = 'christopher.snap@gmail.com' THEN
    RETURN TRUE;
  END IF;

  -- Cargar permisos base del rol
  IF v_role IS NOT NULL AND to_regclass('public.role_permissions') IS NOT NULL THEN
    SELECT COALESCE(rp.permissions, '{}'::jsonb)
    INTO v_role_perms
    FROM public.role_permissions rp
    WHERE lower(rp.role) = lower(v_role)
    LIMIT 1;
  END IF;

  -- Si tiene permiso efectivo de Gestionar (edit_solicitudes_carnet), incluye corregir
  IF v_custom_perms ? 'edit_solicitudes_carnet' THEN
    v_can_edit := lower(COALESCE(v_custom_perms ->> 'edit_solicitudes_carnet', 'false')) = 'true';
  ELSE
    v_can_edit := lower(COALESCE(v_role_perms ->> 'edit_solicitudes_carnet', 'false')) = 'true';
  END IF;

  IF v_can_edit THEN
    RETURN TRUE;
  END IF;

  -- Override individual explícito de corregir_solicitudes_carnet
  IF v_custom_perms ? 'corregir_solicitudes_carnet' THEN
    RETURN lower(COALESCE(v_custom_perms ->> 'corregir_solicitudes_carnet', 'false')) = 'true';
  END IF;

  -- Permiso base del rol
  IF v_role_perms ? 'corregir_solicitudes_carnet' THEN
    RETURN lower(COALESCE(v_role_perms ->> 'corregir_solicitudes_carnet', 'false')) = 'true';
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.usuario_puede_corregir_solicitud_carnet(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.usuario_puede_corregir_solicitud_carnet(UUID) TO authenticated;

-- -----------------------------------------------------------------------------------------
-- 3. ACTUALIZAR POLÍTICA RLS EN public.solicitudes_carnet PARA EXIGIR PERMISO DE CORRECCIÓN
-- -----------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.solicitudes_carnet') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Permitir reenvio de solicitudes observadas o rechazadas" ON public.solicitudes_carnet;
    CREATE POLICY "Permitir reenvio de solicitudes observadas o rechazadas"
      ON public.solicitudes_carnet
      FOR UPDATE
      TO authenticated
      USING (
        estado_solicitud IN ('Observada', 'Rechazada')
        AND public.usuario_puede_corregir_solicitud_carnet(auth.uid())
      )
      WITH CHECK (
        estado_solicitud IN ('Pendiente', 'Cancelada')
        AND public.usuario_puede_corregir_solicitud_carnet(auth.uid())
      );
  END IF;
END $$;

-- -----------------------------------------------------------------------------------------
-- 4. REFORZAR RPC public.corregir_solicitud_carnet(...) CON VALIDACIÓN DE PERMISO
-- -----------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.corregir_solicitud_carnet(
  p_solicitud_id BIGINT,
  p_primer_nombre TEXT,
  p_segundo_nombre TEXT DEFAULT NULL,
  p_primer_apellido TEXT DEFAULT NULL,
  p_segundo_apellido TEXT DEFAULT NULL,
  p_foto_url TEXT DEFAULT NULL,
  p_foto_analisis JSONB DEFAULT NULL,
  p_foto_fondo_reemplazado BOOLEAN DEFAULT NULL,
  p_nota_correccion TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sol RECORD;
  v_p1 TEXT;
  v_p2 TEXT;
  v_a1 TEXT;
  v_a2 TEXT;
  v_full_name TEXT;
  v_foto_final TEXT;
  v_nota TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debe iniciar sesión para corregir una solicitud de carnet.';
  END IF;

  IF NOT public.usuario_puede_corregir_solicitud_carnet(auth.uid()) THEN
    RAISE EXCEPTION 'No tienes permiso para corregir solicitudes de carnet (tu acceso está configurado como Solo Ver).';
  END IF;

  SELECT id, socorrista_id, estado_solicitud, foto_url
  INTO v_sol
  FROM public.solicitudes_carnet
  WHERE id = p_solicitud_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud de carnet #% no existe.', p_solicitud_id;
  END IF;

  IF v_sol.estado_solicitud NOT IN ('Observada', 'Rechazada') THEN
    RAISE EXCEPTION 'Solo se pueden corregir solicitudes en estado Observada o Rechazada (estado actual: %).',
      v_sol.estado_solicitud;
  END IF;

  v_p1 := upper(trim(COALESCE(p_primer_nombre, '')));
  v_p2 := NULLIF(upper(trim(COALESCE(p_segundo_nombre, ''))), '');
  v_a1 := upper(trim(COALESCE(p_primer_apellido, '')));
  v_a2 := NULLIF(upper(trim(COALESCE(p_segundo_apellido, ''))), '');

  IF v_p1 = '' OR v_a1 = '' THEN
    RAISE EXCEPTION 'El primer nombre y el primer apellido son obligatorios según DUI.';
  END IF;

  IF v_p1 !~ '^[[:alpha:][:space:]]+$'
     OR (v_p2 IS NOT NULL AND v_p2 !~ '^[[:alpha:][:space:]]+$')
     OR v_a1 !~ '^[[:alpha:][:space:]]+$'
     OR (v_a2 IS NOT NULL AND v_a2 !~ '^[[:alpha:][:space:]]+$') THEN
    RAISE EXCEPTION 'El nombre o apellido contiene símbolos o números no permitidos para emisión de carnet.';
  END IF;

  v_full_name := trim(regexp_replace(
    concat_ws(' ', v_p1, v_p2, v_a1, v_a2),
    '[[:space:]]+',
    ' ',
    'g'
  ));

  v_foto_final := COALESCE(NULLIF(trim(COALESCE(p_foto_url, '')), ''), v_sol.foto_url);
  v_nota := NULLIF(trim(COALESCE(p_nota_correccion, '')), '');

  IF v_sol.socorrista_id IS NOT NULL THEN
    UPDATE public.socorristas
    SET
      primer_nombre = v_p1,
      segundo_nombre = v_p2,
      primer_apellido = v_a1,
      segundo_apellido = v_a2,
      foto_url = COALESCE(v_foto_final, foto_url)
    WHERE id = v_sol.socorrista_id;
  END IF;

  UPDATE public.solicitudes_carnet
  SET
    foto_url = v_foto_final,
    foto_analisis = COALESCE(p_foto_analisis, foto_analisis),
    foto_fondo_reemplazado = COALESCE(p_foto_fondo_reemplazado, foto_fondo_reemplazado),
    estado_solicitud = 'Pendiente',
    observaciones = NULL,
    revisado_por = NULL,
    fecha_revision = NULL,
    nota_correccion = v_nota,
    fecha_correccion = v_now,
    fecha_solicitud = v_now,
    updated_at = v_now
  WHERE id = p_solicitud_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_solicitud_id,
    'socorrista_id', v_sol.socorrista_id,
    'nombre_completo', v_full_name,
    'estado_solicitud', 'Pendiente',
    'fecha_correccion_sv', to_char(timezone('America/El_Salvador', v_now), 'DD/MM/YYYY HH12:MI AM')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.corregir_solicitud_carnet(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.corregir_solicitud_carnet(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------------------
-- 5. REFORZAR RPC public.cancelar_solicitud_carnet(...) CON VALIDACIÓN DE PERMISO
-- -----------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_solicitud_carnet(
  p_solicitud_id BIGINT,
  p_motivo TEXT DEFAULT NULL,
  p_cancelado_por TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sol RECORD;
  v_motivo TEXT;
  v_actor TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debe iniciar sesión para cancelar una solicitud de carnet.';
  END IF;

  IF NOT public.usuario_puede_corregir_solicitud_carnet(auth.uid()) THEN
    RAISE EXCEPTION 'No tienes permiso para cancelar solicitudes de carnet (tu acceso está configurado como Solo Ver).';
  END IF;

  SELECT id, estado_solicitud
  INTO v_sol
  FROM public.solicitudes_carnet
  WHERE id = p_solicitud_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud de carnet #% no existe.', p_solicitud_id;
  END IF;

  IF v_sol.estado_solicitud IN ('Completado', 'Completada', 'Finalizada') THEN
    RAISE EXCEPTION 'No se puede cancelar una solicitud que ya fue completada.';
  END IF;

  IF v_sol.estado_solicitud IN ('Cancelada', 'Cancelado') THEN
    RETURN jsonb_build_object(
      'ok', true,
      'id', p_solicitud_id,
      'estado_solicitud', 'Cancelada',
      'already_cancelled', true
    );
  END IF;

  v_motivo := NULLIF(trim(COALESCE(p_motivo, '')), '');
  v_actor := NULLIF(trim(COALESCE(p_cancelado_por, '')), '');

  UPDATE public.solicitudes_carnet
  SET
    estado_solicitud = 'Cancelada',
    motivo_cancelacion = v_motivo,
    cancelado_por = v_actor,
    fecha_cancelacion = v_now,
    updated_at = v_now
  WHERE id = p_solicitud_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_solicitud_id,
    'estado_solicitud', 'Cancelada',
    'fecha_cancelacion_sv', to_char(timezone('America/El_Salvador', v_now), 'DD/MM/YYYY HH12:MI AM')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_solicitud_carnet(BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_solicitud_carnet(BIGINT, TEXT, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------------------
-- 6. REFRESCAR ESQUEMA DE POSTGREST
-- -----------------------------------------------------------------------------------------
ANALYZE public.solicitudes_carnet;
NOTIFY pgrst, 'reload schema';
