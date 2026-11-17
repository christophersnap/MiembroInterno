-- =========================================================================================
-- MIGRACIÓN 44: VISIBILIDAD DE IMÁGENES EN SOLICITUDES DE CARNET Y STORAGE PÚBLICO
-- Cruz Verde Salvadoreña - Sistema Institucional
-- =========================================================================================
-- Ejecutar este script en el SQL Editor de Supabase para asegurar que:
-- 1. El bucket 'socorristas' (y demás buckets institucionales) sea público y legible sin bloqueos.
-- 2. Las políticas de storage.objects permitan lectura y subida de fotografías de carnet.
-- 3. Las tablas solicitudes_carnet y socorristas permitan lectura de fotografías y limpien URLs inválidas.
-- =========================================================================================

-- 1. Asegurar buckets públicos sin restricción restrictiva de MIME types
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('socorristas', 'socorristas', true, 52428800, NULL),
  ('archivos', 'archivos', true, 52428800, NULL),
  ('logos', 'logos', true, 52428800, NULL),
  ('plantillas', 'plantillas', true, 52428800, NULL),
  ('assets', 'assets', true, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = NULL;

-- 2. Políticas de lectura/subida/actualización en storage.objects (aplican a todos los roles)
DROP POLICY IF EXISTS "Allow Public Read Objects" ON storage.objects;
CREATE POLICY "Allow Public Read Objects" ON storage.objects
  FOR SELECT
  USING (bucket_id IN ('socorristas', 'archivos', 'logos', 'plantillas', 'assets'));

DROP POLICY IF EXISTS "Allow Public Upload Objects" ON storage.objects;
CREATE POLICY "Allow Public Upload Objects" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id IN ('socorristas', 'archivos', 'logos', 'plantillas', 'assets'));

DROP POLICY IF EXISTS "Allow Public Update Objects" ON storage.objects;
CREATE POLICY "Allow Public Update Objects" ON storage.objects
  FOR UPDATE
  USING (bucket_id IN ('socorristas', 'archivos', 'logos', 'plantillas', 'assets'));

-- 3. Asegurar columnas necesarias en solicitudes_carnet
ALTER TABLE IF EXISTS public.solicitudes_carnet
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seccional_nombre TEXT,
  ADD COLUMN IF NOT EXISTS solicitado_por TEXT,
  ADD COLUMN IF NOT EXISTS solicitado_por_email TEXT,
  ADD COLUMN IF NOT EXISTS observaciones TEXT,
  ADD COLUMN IF NOT EXISTS revisado_por TEXT,
  ADD COLUMN IF NOT EXISTS fecha_revision TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lote_id TEXT,
  ADD COLUMN IF NOT EXISTS es_lote BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Limpiar URLs temporales 'blob:' inválidas de sesiones de navegador anteriores
UPDATE public.solicitudes_carnet
SET foto_url = NULL
WHERE foto_url LIKE 'blob:%' OR btrim(COALESCE(foto_url, '')) = '';

UPDATE public.socorristas
SET foto_url = NULL
WHERE foto_url LIKE 'blob:%' OR btrim(COALESCE(foto_url, '')) = '';

-- 5. Completar foto_url en solicitudes_carnet cuando esté vacía pero el elemento ya tenga foto en perfil
UPDATE public.solicitudes_carnet sc
SET foto_url = s.foto_url
FROM public.socorristas s
WHERE sc.socorrista_id = s.id
  AND (sc.foto_url IS NULL OR btrim(sc.foto_url) = '')
  AND s.foto_url IS NOT NULL
  AND btrim(s.foto_url) <> ''
  AND s.foto_url NOT LIKE 'blob:%';

-- 6. Asegurar políticas RLS sin error de sintaxis en solicitudes_carnet y socorristas
ALTER TABLE IF EXISTS public.solicitudes_carnet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura solicitudes_carnet" ON public.solicitudes_carnet;
CREATE POLICY "Permitir lectura solicitudes_carnet"
  ON public.solicitudes_carnet
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Permitir crear solicitudes_carnet publico" ON public.solicitudes_carnet;
CREATE POLICY "Permitir crear solicitudes_carnet publico"
  ON public.solicitudes_carnet
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion solicitudes_carnet" ON public.solicitudes_carnet;
CREATE POLICY "Permitir actualizacion solicitudes_carnet"
  ON public.solicitudes_carnet
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver socorristas" ON public.socorristas;
CREATE POLICY "Usuarios autenticados pueden ver socorristas"
  ON public.socorristas
  FOR SELECT
  USING (true);

NOTIFY pgrst, 'reload schema';
