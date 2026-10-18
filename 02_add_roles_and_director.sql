-- Add director_id to seccionales (if not exists)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='seccionales' AND column_name='director_id') THEN
        ALTER TABLE public.seccionales ADD COLUMN director_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Update user_roles check constraint to allow 'instructor' and 'director'
-- First, we need to drop the existing constraint. We might not know its exact name,
-- but usually it's user_roles_role_check.
DO $$
BEGIN
  ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
EXCEPTION
  WHEN undefined_object THEN
    -- ignore
END $$;

ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN ('admin', 'socorrista', 'instructor', 'director', 'inactivo'));

-- Insert role permissions for new roles if they don't exist
INSERT INTO public.role_permissions (role, permissions)
SELECT 'instructor', '{"can_manage_users": false, "can_manage_roles": false, "can_manage_settings": false, "can_edit_socorristas": false, "can_delete_socorristas": false, "view_cursos": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'instructor');

INSERT INTO public.role_permissions (role, permissions)
SELECT 'director', '{"can_manage_users": false, "can_manage_roles": false, "can_manage_settings": false, "can_edit_socorristas": true, "can_delete_socorristas": false, "view_socorristas": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'director');
