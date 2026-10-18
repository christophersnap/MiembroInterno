CREATE TABLE IF NOT EXISTS public.directorio_telefonico (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  telefono_personal TEXT,
  telefono_base TEXT,
  direccion TEXT,
  departamento TEXT,
  tipo TEXT NOT NULL DEFAULT 'Otro',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.directorio_telefonico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read directorio" ON public.directorio_telefonico;
CREATE POLICY "Authenticated users can read directorio" ON public.directorio_telefonico FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage directorio" ON public.directorio_telefonico;
CREATE POLICY "Admins can manage directorio" ON public.directorio_telefonico FOR ALL USING (public.is_admin());

-- Add permission setting for edit_directorio to role_permissions
UPDATE public.role_permissions 
SET permissions = jsonb_set(permissions, '{edit_directorio}', 'true') 
WHERE role = 'admin' AND NOT permissions ? 'edit_directorio';

UPDATE public.role_permissions 
SET permissions = jsonb_set(permissions, '{edit_directorio}', 'false') 
WHERE role != 'admin' AND NOT permissions ? 'edit_directorio';
