-- Complete Supabase Schema for Cruz Verde App

-- 1. Seccionales
CREATE TABLE IF NOT EXISTS public.seccionales (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  direccion TEXT,
  telefono1 TEXT,
  telefono2 TEXT,
  director TEXT,
  subdirector TEXT,
  estado TEXT DEFAULT 'Activa',
  departamento TEXT,
  zona TEXT,
  google_maps_url TEXT,
  waze_url TEXT,
  director_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Socorristas
CREATE TABLE IF NOT EXISTS public.socorristas (
  id SERIAL PRIMARY KEY,
  carnet TEXT UNIQUE NOT NULL,
  primer_nombre TEXT NOT NULL,
  segundo_nombre TEXT,
  primer_apellido TEXT NOT NULL,
  segundo_apellido TEXT,
  fecha_nacimiento DATE,
  telefono TEXT,
  direccion TEXT,
  seccional_id INTEGER REFERENCES public.seccionales(id),
  sexo TEXT,
  fecha_ingreso DATE,
  foto_url TEXT,
  estado TEXT DEFAULT 'Activo',
  cargo_institucional TEXT,
  cargo_administrativo TEXT,
  dui TEXT,
  carnet_generado_url TEXT,
  fecha_generacion_carnet TIMESTAMP WITH TIME ZONE,
  tipo_sangre TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Cursos
CREATE TABLE IF NOT EXISTS public.cursos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  duracion TEXT,
  vigencia_meses INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Socorrista Cursos
CREATE TABLE IF NOT EXISTS public.socorrista_cursos (
  id SERIAL PRIMARY KEY,
  socorrista_id INTEGER REFERENCES public.socorristas(id) ON DELETE CASCADE,
  curso_id INTEGER REFERENCES public.cursos(id) ON DELETE CASCADE,
  anio INTEGER,
  fecha_certificacion DATE,
  fecha_vencimiento DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Historial Carnet
CREATE TABLE IF NOT EXISTS public.historial_carnet (
  id SERIAL PRIMARY KEY,
  socorrista_id INTEGER REFERENCES public.socorristas(id) ON DELETE CASCADE,
  carnet_anterior TEXT,
  carnet_nuevo TEXT,
  motivo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Configuracion
CREATE TABLE IF NOT EXISTS public.configuracion (
  id SERIAL PRIMARY KEY,
  clave TEXT UNIQUE NOT NULL,
  valor TEXT,
  watermark_enabled BOOLEAN DEFAULT true
);

-- Insert default config
INSERT INTO public.configuracion (clave, valor) VALUES 
('verificacion_titulo', 'Verificación de Carnet - Cruz Verde Salvadoreña'),
('verificacion_mensaje', 'Este carnet es auténtico y pertenece a un elemento activo de la institución.')
ON CONFLICT (clave) DO NOTHING;

-- 7. Activity Logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Enable RLS on all tables
ALTER TABLE public.seccionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.socorristas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.socorrista_cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_carnet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 9. Basic RLS Policies (Assuming is_admin() function exists from fix_db.sql)
-- If is_admin() doesn't exist, run fix_db.sql first.

-- Seccionales: Anyone authenticated can read, only admins can write
DROP POLICY IF EXISTS "Authenticated users can read seccionales" ON public.seccionales;
CREATE POLICY "Authenticated users can read seccionales" ON public.seccionales FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admins can manage seccionales" ON public.seccionales;
CREATE POLICY "Admins can manage seccionales" ON public.seccionales FOR ALL USING (public.is_admin());

-- Socorristas: Anyone authenticated can read, only admins can write
DROP POLICY IF EXISTS "Authenticated users can read socorristas" ON public.socorristas;
CREATE POLICY "Authenticated users can read socorristas" ON public.socorristas FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admins can manage socorristas" ON public.socorristas;
CREATE POLICY "Admins can manage socorristas" ON public.socorristas FOR ALL USING (public.is_admin());

-- Cursos: Anyone authenticated can read, only admins can write
DROP POLICY IF EXISTS "Authenticated users can read cursos" ON public.cursos;
CREATE POLICY "Authenticated users can read cursos" ON public.cursos FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admins can manage cursos" ON public.cursos;
CREATE POLICY "Admins can manage cursos" ON public.cursos FOR ALL USING (public.is_admin());

-- Socorrista Cursos
DROP POLICY IF EXISTS "Authenticated users can read socorrista_cursos" ON public.socorrista_cursos;
CREATE POLICY "Authenticated users can read socorrista_cursos" ON public.socorrista_cursos FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admins can manage socorrista_cursos" ON public.socorrista_cursos;
CREATE POLICY "Admins can manage socorrista_cursos" ON public.socorrista_cursos FOR ALL USING (public.is_admin());

-- Historial Carnet
DROP POLICY IF EXISTS "Authenticated users can read historial_carnet" ON public.historial_carnet;
CREATE POLICY "Authenticated users can read historial_carnet" ON public.historial_carnet FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admins can manage historial_carnet" ON public.historial_carnet;
CREATE POLICY "Admins can manage historial_carnet" ON public.historial_carnet FOR ALL USING (public.is_admin());

-- Configuracion: Anyone authenticated can read, only admins can write
DROP POLICY IF EXISTS "Authenticated users can read configuracion" ON public.configuracion;
CREATE POLICY "Authenticated users can read configuracion" ON public.configuracion FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admins can manage configuracion" ON public.configuracion;
CREATE POLICY "Admins can manage configuracion" ON public.configuracion FOR ALL USING (public.is_admin());

-- Activity Logs: Admins can read all, users can read their own, anyone authenticated can insert
DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.activity_logs;
CREATE POLICY "Admins can view all activity logs" ON public.activity_logs FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.activity_logs;
CREATE POLICY "Users can view their own activity logs" ON public.activity_logs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON public.activity_logs;
CREATE POLICY "Authenticated users can insert activity logs" ON public.activity_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 10. Create View for Usuarios (combining auth.users and user_roles)
CREATE OR REPLACE VIEW public.usuarios_view AS
SELECT 
  u.id,
  u.email,
  u.created_at,
  r.role,
  r.socorrista_id
FROM auth.users u
LEFT JOIN public.user_roles r ON u.id = r.id
WHERE public.is_admin() OR u.id = auth.uid();

-- Grant access to the view
GRANT SELECT ON public.usuarios_view TO authenticated;
GRANT SELECT ON public.usuarios_view TO service_role;

-- 11. Ensure new columns exist (for existing databases)
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
