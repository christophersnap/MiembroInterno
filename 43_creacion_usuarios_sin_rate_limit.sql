-- =========================================================================================
-- MIGRACIÓN 43: CREACIÓN DE USUARIOS Y ENLACES DE CONFIRMACIÓN SIN LÍMITE DE SUPABASE
-- Cruz Verde Salvadoreña - Sistema Institucional
-- =========================================================================================
-- ¿Por qué existía "email rate limit exceeded"?
-- Porque supabase.auth.signUp() dispara el servidor SMTP gratuito interno de Supabase,
-- el cual tiene un límite estricto de 2 correos por hora para todo el proyecto.
--
-- Esta migración permite:
-- 1. Crear usuarios directamente desde SQL (solo Admin) sin pasar por el límite de Supabase Auth.
-- 2. Generar tokens propios de confirmación de correo para enviar el enlace desde
--    notificaciones@cruzverdesv.org en texto plano.
-- 3. Validar el enlace de confirmación cuando el usuario abre la app.
-- =========================================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE IF EXISTS public.user_roles
  ADD COLUMN IF NOT EXISTS nombre_completo TEXT,
  ADD COLUMN IF NOT EXISTS nombre_usuario TEXT;

-- 1. Tabla de tokens propios de confirmación de correo
CREATE TABLE IF NOT EXISTS public.email_confirmation_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.email_confirmation_tokens ENABLE ROW LEVEL SECURITY;

-- Sin políticas directas públicas: solo accesible vía funciones SECURITY DEFINER

-- 2. RPC segura (Solo Admin): Crear usuario directamente en auth.users + auth.identities + user_roles
--    Evita por completo el error "email rate limit exceeded" de auth.signUp()
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email TEXT,
  p_password TEXT,
  p_nombre_usuario TEXT,
  p_role TEXT DEFAULT 'socorrista',
  p_socorrista_id INTEGER DEFAULT NULL,
  p_can_upload_files BOOLEAN DEFAULT false,
  p_custom_permissions JSONB DEFAULT '{}'::jsonb,
  p_requires_password_reset BOOLEAN DEFAULT false,
  p_auto_confirm BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_email TEXT;
  v_nombre TEXT;
  v_role TEXT;
  v_user_id UUID;
  v_token TEXT := NULL;
BEGIN
  IF NOT (
    public.is_admin()
    OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE id = auth.uid()
        AND (role IN ('admin', 'superadmin') OR (custom_permissions ->> 'perm_accesos') = 'true')
    )
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores pueden crear usuarios.';
  END IF;

  v_email := lower(trim(COALESCE(p_email, '')));
  v_nombre := trim(COALESCE(p_nombre_usuario, ''));
  v_role := COALESCE(NULLIF(trim(p_role), ''), 'socorrista');

  IF v_email = '' OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'Debe ingresar un correo electrónico válido.';
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres.';
  END IF;

  IF v_nombre = '' THEN
    v_nombre := split_part(v_email, '@', 1);
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'Este correo electrónico ya se encuentra registrado en el sistema.';
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    CASE WHEN COALESCE(p_auto_confirm, true) THEN NOW() ELSE NULL END,
    '',
    '',
    '',
    '',
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object(
      'full_name', v_nombre,
      'nombre_completo', v_nombre,
      'nombre_usuario', v_nombre,
      'socorrista_id', p_socorrista_id
    ),
    false,
    NOW(),
    NOW()
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', COALESCE(p_auto_confirm, true),
      'phone_verified', false
    ),
    'email',
    v_user_id::text,
    NOW(),
    NOW(),
    NOW()
  );

  INSERT INTO public.user_roles (
    id,
    role,
    activo,
    estado,
    socorrista_id,
    nombre_completo,
    nombre_usuario,
    can_upload_files,
    custom_permissions,
    requires_password_reset
  ) VALUES (
    v_user_id,
    v_role,
    true,
    'activo',
    p_socorrista_id,
    v_nombre,
    v_nombre,
    COALESCE(p_can_upload_files, false),
    COALESCE(p_custom_permissions, '{}'::jsonb),
    COALESCE(p_requires_password_reset, false)
  )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    activo = true,
    estado = 'activo',
    socorrista_id = EXCLUDED.socorrista_id,
    nombre_completo = EXCLUDED.nombre_completo,
    nombre_usuario = EXCLUDED.nombre_usuario,
    can_upload_files = EXCLUDED.can_upload_files,
    custom_permissions = EXCLUDED.custom_permissions,
    requires_password_reset = EXCLUDED.requires_password_reset;

  IF NOT COALESCE(p_auto_confirm, true) THEN
    v_token := encode(extensions.gen_random_bytes(24), 'hex');
    INSERT INTO public.email_confirmation_tokens (user_id, email, token)
    VALUES (v_user_id, v_email, v_token);
  END IF;

  RETURN jsonb_build_object(
    'user_id', v_user_id,
    'email', v_email,
    'auto_confirmed', COALESCE(p_auto_confirm, true),
    'confirmation_token', v_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_user(
  TEXT, TEXT, TEXT, TEXT, INTEGER, BOOLEAN, JSONB, BOOLEAN, BOOLEAN
) TO authenticated;

-- 3. RPC segura (Solo Admin): Generar o regenerar token de confirmación para enviar vía notificaciones@cruzverdesv.org
CREATE OR REPLACE FUNCTION public.admin_generar_token_confirmacion(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_email TEXT;
  v_token TEXT;
BEGIN
  IF NOT (
    public.is_admin()
    OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE id = auth.uid()
        AND (role IN ('admin', 'superadmin') OR (custom_permissions ->> 'perm_accesos') = 'true')
    )
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores pueden generar enlaces de confirmación.';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = target_user_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado.';
  END IF;

  -- Invalida tokens previos sin usar del mismo usuario
  UPDATE public.email_confirmation_tokens
  SET used_at = NOW()
  WHERE user_id = target_user_id AND used_at IS NULL;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  INSERT INTO public.email_confirmation_tokens (user_id, email, token)
  VALUES (target_user_id, v_email, v_token);

  RETURN jsonb_build_object(
    'user_id', target_user_id,
    'email', v_email,
    'confirmation_token', v_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_generar_token_confirmacion(UUID) TO authenticated;

-- 4. RPC pública: Confirmar correo electrónico al hacer clic en el enlace enviado por notificaciones@cruzverdesv.org
CREATE OR REPLACE FUNCTION public.confirmar_cuenta_por_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Token de confirmación inválido.');
  END IF;

  SELECT *
  INTO v_rec
  FROM public.email_confirmation_tokens
  WHERE token = trim(p_token)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El enlace de confirmación no existe o ya no es válido.');
  END IF;

  IF v_rec.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'email', v_rec.email, 'already_confirmed', true);
  END IF;

  IF v_rec.expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El enlace de confirmación ha expirado. Solicita uno nuevo al administrador.');
  END IF;

  UPDATE public.email_confirmation_tokens
  SET used_at = NOW()
  WHERE id = v_rec.id;

  UPDATE auth.users
  SET
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
  WHERE id = v_rec.user_id;

  UPDATE auth.identities
  SET
    identity_data = COALESCE(identity_data, '{}'::jsonb) || '{"email_verified": true}'::jsonb,
    updated_at = NOW()
  WHERE user_id = v_rec.user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'email', v_rec.email,
    'already_confirmed', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirmar_cuenta_por_token(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
