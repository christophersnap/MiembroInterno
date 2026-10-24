-- =========================================================================
-- MIGRACIÓN 28: CONTACTOS DE EMERGENCIA, DOCUMENTOS VERSIONADOS Y MÉRITOS
-- Cruz Verde Salvadoreña - Sistema Oficial de Gestión
-- =========================================================================

-- 1. AGREGAR CONTACTOS DE EMERGENCIA A SOCORRISTAS
ALTER TABLE public.socorristas
ADD COLUMN IF NOT EXISTS contacto_emergencia_nombre TEXT,
ADD COLUMN IF NOT EXISTS contacto_emergencia_telefono TEXT,
ADD COLUMN IF NOT EXISTS contacto_emergencia_nombre_2 TEXT,
ADD COLUMN IF NOT EXISTS contacto_emergencia_telefono_2 TEXT;

-- 2. CORREGIR POLÍTICA DE RLS EN SOLICITUDES DE CARNET (Permitir envíos públicos y fotos)
ALTER TABLE public.solicitudes_carnet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert solicitudes" ON public.solicitudes_carnet;
CREATE POLICY "Anyone can insert solicitudes" ON public.solicitudes_carnet
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public select solicitudes" ON public.solicitudes_carnet;
CREATE POLICY "Public select solicitudes" ON public.solicitudes_carnet
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated update solicitudes" ON public.solicitudes_carnet;
CREATE POLICY "Authenticated update solicitudes" ON public.solicitudes_carnet
  FOR UPDATE USING (auth.role() = 'authenticated');

-- 3. TABLA DE DOCUMENTOS VERSIONADOS DE SOCORRISTA (CV, Antecedentes, etc.)
CREATE TABLE IF NOT EXISTS public.documentos_socorrista (
  id SERIAL PRIMARY KEY,
  socorrista_id INTEGER NOT NULL REFERENCES public.socorristas(id) ON DELETE CASCADE,
  tipo_documento TEXT NOT NULL, -- 'cv', 'antecedentes_penales', 'antecedentes_policiales', 'solvencia_municipal', 'otro'
  nombre_archivo TEXT NOT NULL,
  archivo_url TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  es_vigente BOOLEAN DEFAULT true,
  tamanio_bytes INTEGER,
  fecha_subida TIMESTAMPTZ DEFAULT NOW(),
  subido_por TEXT
);

CREATE INDEX IF NOT EXISTS idx_doc_socorrista ON public.documentos_socorrista(socorrista_id, tipo_documento);

ALTER TABLE public.documentos_socorrista ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on documentos_socorrista" ON public.documentos_socorrista;
CREATE POLICY "Allow all on documentos_socorrista" ON public.documentos_socorrista
  FOR ALL USING (true);

-- 4. TABLA DE MÉRITOS, PREMIOS Y RECONOCIMIENTOS DE OPERACIONES
CREATE TABLE IF NOT EXISTS public.meritos (
  id SERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  categoria TEXT DEFAULT 'Misión Humanitaria',
  descripcion TEXT,
  institucion_otorgante TEXT DEFAULT 'Cruz Verde Salvadoreña',
  fecha_merito DATE DEFAULT CURRENT_DATE,
  socorristas_asignados JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.meritos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on meritos" ON public.meritos;
CREATE POLICY "Allow all on meritos" ON public.meritos
  FOR ALL USING (true);

-- 5. AGREGAR PERMISO VER_TODOS_FORMULARIOS AL ROL ADMIN
UPDATE public.role_permissions
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{ver_todos_formularios}',
  'true'::jsonb
)
WHERE role = 'admin';
