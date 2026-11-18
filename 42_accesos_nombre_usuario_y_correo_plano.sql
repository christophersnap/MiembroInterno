-- =========================================================================================
-- MIGRACIÓN 42: NOMBRE DE USUARIO EN ACCESOS, CONFIRMACIÓN Y RESETEO SEGURO POR ADMIN
-- Cruz Verde Salvadoreña - Sistema Institucional
-- =========================================================================================
-- Ejecutar este script en el SQL Editor de Supabase para:
-- 1. Guardar el nombre de usuario / nombre para mostrar en usuarios internos y externos.
-- 2. Actualizar la vista public.usuarios_view con nombre_usuario, nombre_completo y estado de correo.
-- 3. Habilitar funciones seguras (solo Admin) para confirmar correo o restablecer clave temporal.
-- =========================================================================================

-- 1. Asegurar columnas de nombre en public.user_roles
ALTER TABLE IF EXISTS public.user_roles
  ADD COLUMN IF NOT EXISTS nombre_completo TEXT,
  ADD COLUMN IF NOT EXISTS nombre_usuario TEXT;

-- Sincronizar valores existentes si uno está lleno y el otro vacío
UPDATE public.user_roles
SET
  nombre_usuario = COALESCE(NULLIF(TRIM(nombre_usuario), ''), NULLIF(TRIM(nombre_completo), '')),
  nombre_completo = COALESCE(NULLIF(TRIM(nombre_completo), ''), NULLIF(TRIM(nombre_usuario), ''))
WHERE (nombre_usuario IS NULL OR TRIM(nombre_usuario) = '' OR nombre_completo IS NULL OR TRIM(nombre_completo) = '')
  AND (nombre_usuario IS NOT NULL OR nombre_completo IS NOT NULL);

-- Rellenar nombre desde metadatos de auth.users o tabla socorristas si aún está vacío
UPDATE public.user_roles ur
SET
  nombre_usuario = COALESCE(
    NULLIF(TRIM(ur.nombre_usuario), ''),
    NULLIF(TRIM(ur.nombre_completo), ''),
    NULLIF(TRIM(src.socorrista_nombre), ''),
    NULLIF(TRIM(src.meta_nombre_usuario), ''),
    NULLIF(TRIM(src.meta_nombre_completo), ''),
    NULLIF(TRIM(src.meta_full_name), '')
  ),
  nombre_completo = COALESCE(
    NULLIF(TRIM(ur.nombre_completo), ''),
    NULLIF(TRIM(ur.nombre_usuario), ''),
    NULLIF(TRIM(src.socorrista_nombre), ''),
    NULLIF(TRIM(src.meta_nombre_completo), ''),
    NULLIF(TRIM(src.meta_full_name), ''),
    NULLIF(TRIM(src.meta_nombre_usuario), '')
  )
FROM (
  SELECT
    ur_inner.id AS role_id,
    NULLIF(TRIM(COALESCE(s.primer_nombre, '') || ' ' || COALESCE(s.primer_apellido, '')), '') AS socorrista_nombre,
    au.raw_user_meta_data ->> 'nombre_usuario' AS meta_nombre_usuario,
    au.raw_user_meta_data ->> 'nombre_completo' AS meta_nombre_completo,
    au.raw_user_meta_data ->> 'full_name' AS meta_full_name
  FROM public.user_roles ur_inner
  LEFT JOIN auth.users au ON au.id = ur_inner.id
  LEFT JOIN public.socorristas s ON s.id = ur_inner.socorrista_id
) src
WHERE ur.id = src.role_id
  AND (
    ur.nombre_usuario IS NULL OR TRIM(ur.nombre_usuario) = ''
    OR ur.nombre_completo IS NULL OR TRIM(ur.nombre_completo) = ''
  );

-- 2. Por seguridad (Supabase Security Advisor: auth_users_exposed), NO crear vistas públicas sobre auth.users.
--    Utilizar las funciones RPC protegidas de la Migración 46 (public.get_usuarios_directory).
DROP VIEW IF EXISTS public.usuarios_view CASCADE;

-- 3. Asegurar extensión pgcrypto (para hash bcrypt en restablecimiento de clave por administrador)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 4. RPC segura (Solo Admin): Confirmar correo de un usuario creado manualmente o aprobado
--    Útil cuando las notificaciones y confirmaciones se gestionan vía notificaciones@cruzverdesv.org
CREATE OR REPLACE FUNCTION public.admin_confirm_user_email(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT (
    public.is_admin()
    OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores pueden confirmar usuarios.';
  END IF;

  UPDATE auth.users
  SET
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
  WHERE id = target_user_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_confirm_user_email(UUID) TO authenticated;

-- 5. RPC segura (Solo Admin): Asignar contraseña temporal/manual directamente en auth.users
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(target_user_id UUID, new_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF NOT (
    public.is_admin()
    OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores pueden restablecer contraseñas.';
  END IF;

  IF new_password IS NULL OR length(trim(new_password)) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres.';
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
  WHERE id = target_user_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO authenticated;

-- 6. Recargar esquema de PostgREST
NOTIFY pgrst, 'reload schema';
