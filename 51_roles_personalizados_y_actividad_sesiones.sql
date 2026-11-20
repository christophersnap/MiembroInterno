-- ============================================================================
-- MIGRACIÓN 51: ROLES PERSONALIZADOS, AUDITORÍA DE SESIONES Y SECCIONALES
-- Cruz Verde Salvadoreña - Sistema Institucional
-- ============================================================================
-- Qué resuelve esta migración:
-- 1. Elimina cualquier restricción CHECK fija en public.user_roles(role) para
--    permitir crear y asignar roles personalizados desde Accesos -> Roles.
-- 2. Actualiza permisos RLS en public.role_permissions (SELECT/INSERT/UPDATE/DELETE)
--    para que administradores y encargados de Accesos puedan crear y editar roles.
-- 3. Asegura la estructura, índices y políticas RLS de public.activity_logs para
--    registrar inicios/cierres de sesión y actividad de TODOS los usuarios
--    autenticados, restringiendo la lectura a quienes tienen permiso view_activity.
-- 4. Verifica columnas de ubicación y contacto en public.seccionales.
-- ============================================================================

-- 1. Permitir roles personalizados en public.user_roles (eliminar CHECK fijo si existe)
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  FOR v_constraint IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'user_roles'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS %I', v_constraint);
  END LOOP;
END $$;

-- 2. Preparar public.role_permissions para creación y administración de roles
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL UNIQUE,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS descripcion TEXT;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_roles()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_custom JSONB;
  v_role_perms JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF lower(COALESCE(auth.jwt() ->> 'email', '')) = 'christopher.snap@gmail.com' THEN
    RETURN TRUE;
  END IF;

  SELECT ur.role, COALESCE(ur.custom_permissions, '{}'::jsonb)
  INTO v_role, v_custom
  FROM public.user_roles ur
  WHERE ur.id = auth.uid()
  LIMIT 1;

  IF v_role IN ('admin', 'superadmin') THEN
    RETURN TRUE;
  END IF;

  IF (v_custom ->> 'view_accesos') = 'true' OR (v_custom ->> 'can_manage_roles') = 'true' THEN
    RETURN TRUE;
  END IF;

  SELECT COALESCE(rp.permissions, '{}'::jsonb)
  INTO v_role_perms
  FROM public.role_permissions rp
  WHERE rp.role = v_role
  LIMIT 1;

  RETURN COALESCE((v_role_perms ->> 'view_accesos')::boolean, FALSE)
      OR COALESCE((v_role_perms ->> 'can_manage_roles')::boolean, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.can_manage_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_roles() TO authenticated;

DROP POLICY IF EXISTS "Admins can manage role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Anyone can read role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Authenticated can read role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Managers can insert role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Managers can update role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Managers can delete role permissions" ON public.role_permissions;

CREATE POLICY "Authenticated can read role permissions"
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can insert role permissions"
  ON public.role_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_roles());

CREATE POLICY "Managers can update role permissions"
  ON public.role_permissions
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_roles())
  WITH CHECK (public.can_manage_roles());

CREATE POLICY "Managers can delete role permissions"
  ON public.role_permissions
  FOR DELETE
  TO authenticated
  USING (
    public.can_manage_roles()
    AND role NOT IN ('admin', 'socorrista', 'director', 'instructor')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.role_permissions TO authenticated;

-- 3. Asegurar tabla, índices y RLS de public.activity_logs para sesiones y acciones
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS user_email TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id TEXT,
  ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
  ON public.activity_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_created
  ON public.activity_logs (entity_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id
  ON public.activity_logs (user_id);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_activity_logs()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_custom JSONB;
  v_role_perms JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF lower(COALESCE(auth.jwt() ->> 'email', '')) = 'christopher.snap@gmail.com' THEN
    RETURN TRUE;
  END IF;

  SELECT ur.role, COALESCE(ur.custom_permissions, '{}'::jsonb)
  INTO v_role, v_custom
  FROM public.user_roles ur
  WHERE ur.id = auth.uid()
  LIMIT 1;

  IF v_role IN ('admin', 'superadmin') THEN
    RETURN TRUE;
  END IF;

  IF v_custom ? 'view_activity' THEN
    RETURN COALESCE((v_custom ->> 'view_activity')::boolean, FALSE);
  END IF;

  SELECT COALESCE(rp.permissions, '{}'::jsonb)
  INTO v_role_perms
  FROM public.role_permissions rp
  WHERE rp.role = v_role
  LIMIT 1;

  RETURN COALESCE((v_role_perms ->> 'view_activity')::boolean, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.can_view_activity_logs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_activity_logs() TO authenticated;

DROP POLICY IF EXISTS "Users can insert own activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Admins can read activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Authorized users can read activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.activity_logs;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.activity_logs;

CREATE POLICY "Authenticated users can insert activity logs"
  ON public.activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Authorized users can read activity logs"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (public.can_view_activity_logs() OR user_id = auth.uid());

GRANT SELECT, INSERT ON TABLE public.activity_logs TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 4. Verificar columnas de contacto y ubicación en public.seccionales
ALTER TABLE IF EXISTS public.seccionales
  ADD COLUMN IF NOT EXISTS correo TEXT,
  ADD COLUMN IF NOT EXISTS google_maps_url TEXT,
  ADD COLUMN IF NOT EXISTS waze_url TEXT;

NOTIFY pgrst, 'reload schema';
