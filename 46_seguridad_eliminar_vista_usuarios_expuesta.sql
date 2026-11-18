-- =========================================================================================
-- MIGRACIÓN 46: CORRECCIÓN CRÍTICA DE SEGURIDAD (SUPABASE SECURITY ADVISOR)
-- Solventa: "Datos de usuario expuestos a través de una vista" (auth_users_exposed /
-- usuarios_autenticados_expuestos) originado por public.usuarios_view.
--
-- Acciones que realiza este script:
-- 1. Revoca permisos públicos y elimina definitivamente la vista public.usuarios_view
--    que exponía auth.users a través de la API pública (anon / authenticated).
-- 2. Crea funciones RPC protegidas con validación estricta de sesión y permisos (RBAC)
--    y search_path fijo para que solo usuarios autorizados consulten el directorio de
--    Accesos y la lista de Directores de Seccional.
-- =========================================================================================

-- 1. Eliminar la vista expuesta public.usuarios_view
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public'
      AND viewname = 'usuarios_view'
  ) THEN
    EXECUTE 'REVOKE ALL ON public.usuarios_view FROM anon, authenticated, PUBLIC';
    EXECUTE 'DROP VIEW public.usuarios_view CASCADE';
  END IF;
END $$;

-- 2. Función auxiliar interna para validar permiso de lectura del módulo de Accesos
CREATE OR REPLACE FUNCTION public.can_view_accesos_directory()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := lower(COALESCE(auth.jwt() ->> 'email', ''));
  v_role TEXT;
  v_custom JSONB;
  v_role_perms JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_email = 'christopher.snap@gmail.com' THEN
    RETURN TRUE;
  END IF;

  SELECT ur.role, COALESCE(ur.custom_permissions, '{}'::jsonb)
  INTO v_role, v_custom
  FROM public.user_roles ur
  WHERE ur.id = v_uid
    AND COALESCE(ur.activo, true) = true
  LIMIT 1;

  IF v_role IN ('admin', 'superadmin') THEN
    RETURN TRUE;
  END IF;

  IF (v_custom ->> 'view_accesos') = 'true' OR (v_custom ->> 'perm_accesos') = 'true' THEN
    RETURN TRUE;
  END IF;

  IF v_role IS NOT NULL THEN
    SELECT COALESCE(rp.permissions, '{}'::jsonb)
    INTO v_role_perms
    FROM public.role_permissions rp
    WHERE rp.role = v_role
    LIMIT 1;

    IF (v_role_perms ->> 'view_accesos') = 'true' THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.can_view_accesos_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_accesos_directory() TO authenticated;

-- 3. RPC segura (solo Administradores / usuarios con permiso view_accesos):
--    Reemplaza por completo a public.usuarios_view sin exponer auth.users en la API abierta
CREATE OR REPLACE FUNCTION public.get_usuarios_directory()
RETURNS TABLE (
  id UUID,
  email TEXT,
  primer_nombre TEXT,
  primer_apellido TEXT,
  nombre_usuario TEXT,
  nombre_completo TEXT,
  role TEXT,
  activo BOOLEAN,
  estado TEXT,
  carnet TEXT,
  seccional_id INTEGER,
  created_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  email_confirmed_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.can_view_accesos_directory() THEN
    RAISE EXCEPTION 'Acceso denegado: no cuenta con permisos para consultar usuarios.';
  END IF;

  RETURN QUERY
  SELECT
    u.id::uuid AS id,
    COALESCE(u.email, '')::text AS email,
    COALESCE(
      NULLIF(TRIM(r.nombre_usuario), ''),
      NULLIF(TRIM(r.nombre_completo), ''),
      NULLIF(TRIM(s.primer_nombre), ''),
      NULLIF(TRIM(u.raw_user_meta_data ->> 'nombre_usuario'), ''),
      NULLIF(TRIM(u.raw_user_meta_data ->> 'nombre_completo'), ''),
      NULLIF(TRIM(u.raw_user_meta_data ->> 'full_name'), ''),
      split_part(COALESCE(u.email, ''), '@', 1)
    )::text AS primer_nombre,
    COALESCE(s.primer_apellido, '')::text AS primer_apellido,
    r.nombre_usuario::text AS nombre_usuario,
    r.nombre_completo::text AS nombre_completo,
    r.role::text AS role,
    COALESCE(r.activo, true)::boolean AS activo,
    COALESCE(r.estado, 'activo')::text AS estado,
    s.carnet::text AS carnet,
    s.seccional_id::integer AS seccional_id,
    u.created_at::timestamptz AS created_at,
    u.email_confirmed_at::timestamptz AS confirmed_at,
    u.email_confirmed_at::timestamptz AS email_confirmed_at,
    u.last_sign_in_at::timestamptz AS last_sign_in_at
  FROM auth.users u
  LEFT JOIN public.user_roles r ON u.id = r.id
  LEFT JOIN public.socorristas s ON r.socorrista_id = s.id
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_usuarios_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_usuarios_directory() TO authenticated;

-- 4. RPC segura (solo usuarios autenticados): Lista mínima de Directores para Seccionales
CREATE OR REPLACE FUNCTION public.get_directores_list()
RETURNS TABLE (
  id UUID,
  email TEXT,
  primer_nombre TEXT,
  primer_apellido TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida.';
  END IF;

  RETURN QUERY
  SELECT
    u.id::uuid AS id,
    COALESCE(u.email, '')::text AS email,
    COALESCE(
      NULLIF(TRIM(s.primer_nombre), ''),
      NULLIF(TRIM(r.nombre_usuario), ''),
      NULLIF(TRIM(r.nombre_completo), ''),
      split_part(COALESCE(u.email, ''), '@', 1)
    )::text AS primer_nombre,
    COALESCE(s.primer_apellido, '')::text AS primer_apellido
  FROM public.user_roles r
  INNER JOIN auth.users u ON u.id = r.id
  LEFT JOIN public.socorristas s ON s.id = r.socorrista_id
  WHERE r.role = 'director'
    AND COALESCE(r.activo, true) = true
  ORDER BY primer_nombre ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_directores_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_directores_list() TO authenticated;

-- 5. RPC segura (solo Administradores / Accesos): Buscar UUID de usuario por correo al aprobar solicitudes
CREATE OR REPLACE FUNCTION public.admin_find_user_id_by_email(target_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_found_id UUID;
BEGIN
  IF NOT public.can_view_accesos_directory() THEN
    RAISE EXCEPTION 'Acceso denegado.';
  END IF;

  IF target_email IS NULL OR trim(target_email) = '' THEN
    RETURN NULL;
  END IF;

  SELECT u.id
  INTO v_found_id
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(target_email))
  LIMIT 1;

  RETURN v_found_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_find_user_id_by_email(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_find_user_id_by_email(TEXT) TO authenticated;

-- 6. Asegurar revocación directa en tabla sensible de tokens de confirmación
REVOKE ALL ON TABLE public.email_confirmation_tokens FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
