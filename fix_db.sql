-- 1. Fix infinite recursion in user_roles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- Drop all existing policies on user_roles to be safe
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

-- Recreate policies for user_roles without recursion
CREATE POLICY "Users can view their own role"
  ON public.user_roles
  FOR SELECT
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can manage user roles"
  ON public.user_roles
  FOR ALL
  USING (public.is_admin());

-- 2. Create role_permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL UNIQUE,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on role_permissions
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Policies for role_permissions
DROP POLICY IF EXISTS "Admins can manage role permissions" ON public.role_permissions;
CREATE POLICY "Admins can manage role permissions"
  ON public.role_permissions
  FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Anyone can read role permissions" ON public.role_permissions;
CREATE POLICY "Anyone can read role permissions"
  ON public.role_permissions
  FOR SELECT
  USING (true);

-- Insert default roles if table is empty
INSERT INTO public.role_permissions (role, permissions)
SELECT 'admin', '{"can_manage_users": true, "can_manage_roles": true, "can_manage_settings": true, "can_edit_socorristas": true, "can_delete_socorristas": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'admin');

INSERT INTO public.role_permissions (role, permissions)
SELECT 'socorrista', '{"can_manage_users": false, "can_manage_roles": false, "can_manage_settings": false, "can_edit_socorristas": false, "can_delete_socorristas": false}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'socorrista');

-- 3. Fix policies on other tables to use is_admin()
-- Cursos
DROP POLICY IF EXISTS "Admins have full access to cursos" ON public.cursos;
CREATE POLICY "Admins have full access to cursos"
  ON public.cursos
  FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can read cursos" ON public.cursos;
CREATE POLICY "Authenticated users can read cursos"
  ON public.cursos
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Socorristas
DROP POLICY IF EXISTS "Admins have full access to socorristas" ON public.socorristas;
CREATE POLICY "Admins have full access to socorristas"
  ON public.socorristas
  FOR ALL
  USING (public.is_admin());

-- Seccionales
DROP POLICY IF EXISTS "Admins have full access to seccionales" ON public.seccionales;
CREATE POLICY "Admins have full access to seccionales"
  ON public.seccionales
  FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can read seccionales" ON public.seccionales;
CREATE POLICY "Authenticated users can read seccionales"
  ON public.seccionales
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 4. Ensure new columns exist (for existing databases)
DO $$ 
BEGIN 
    -- Add fecha_generacion_carnet to socorristas if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='socorristas' AND column_name='fecha_generacion_carnet') THEN
        ALTER TABLE public.socorristas ADD COLUMN fecha_generacion_carnet TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add user_email to activity_logs if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_logs' AND column_name='user_email') THEN
        ALTER TABLE public.activity_logs ADD COLUMN user_email TEXT;
    END IF;
END $$;
