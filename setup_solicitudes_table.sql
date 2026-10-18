CREATE TABLE IF NOT EXISTS public.solicitudes_carnet (
  id SERIAL PRIMARY KEY,
  socorrista_id INTEGER REFERENCES public.socorristas(id) ON DELETE CASCADE,
  tipo_solicitud TEXT NOT NULL,
  motivo TEXT,
  detalles_motivo TEXT,
  foto_url TEXT,
  estado_solicitud TEXT DEFAULT 'Pendiente',
  fecha_solicitud TIMESTAMPTZ DEFAULT NOW(),
  codigo_seguimiento TEXT UNIQUE
);

-- RLS
ALTER TABLE public.solicitudes_carnet ENABLE ROW LEVEL SECURITY;

-- Anyone can insert since it's a public form
DROP POLICY IF EXISTS "Anyone can insert solicitudes" ON public.solicitudes_carnet;
CREATE POLICY "Anyone can insert solicitudes" ON public.solicitudes_carnet FOR INSERT WITH CHECK (true);

-- Authenticated can read
DROP POLICY IF EXISTS "Authenticated read solicitudes" ON public.solicitudes_carnet;
CREATE POLICY "Authenticated read solicitudes" ON public.solicitudes_carnet FOR SELECT USING (auth.role() = 'authenticated');

-- Admins can manage
DROP POLICY IF EXISTS "Admins manage solicitudes" ON public.solicitudes_carnet;
CREATE POLICY "Admins manage solicitudes" ON public.solicitudes_carnet FOR ALL USING (public.is_admin());
