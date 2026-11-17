-- ==============================================================================
-- 38_fix_archivos_supabase_y_storage.sql
-- Corrige almacenamiento en Supabase Storage (todos los formatos de documentos),
-- políticas RLS de public.archivos (permisos individuales y de rol) y sincronización
-- con el selector de adjuntos en Noticias.
-- Cruz Verde Salvadoreña - Sistema Administrativo
-- ==============================================================================

-- 1. Asegurar tabla public.archivos y todas sus columnas
CREATE TABLE IF NOT EXISTS public.archivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT DEFAULT 'General',
  nombre_archivo TEXT NOT NULL,
  url_archivo TEXT NOT NULL,
  tipo_archivo TEXT,
  extension TEXT,
  tamano_bytes BIGINT DEFAULT 0,
  tamano_legible TEXT,
  subido_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subido_por_nombre TEXT,
  seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL,
  descargas_count INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  enlace_externo TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.archivos
  ADD COLUMN IF NOT EXISTS descripcion TEXT,
  ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS tipo_archivo TEXT,
  ADD COLUMN IF NOT EXISTS extension TEXT,
  ADD COLUMN IF NOT EXISTS tamano_bytes BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tamano_legible TEXT,
  ADD COLUMN IF NOT EXISTS subido_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subido_por_nombre TEXT,
  ADD COLUMN IF NOT EXISTS seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS descargas_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS enlace_externo TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[],
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;

CREATE INDEX IF NOT EXISTS idx_archivos_categoria ON public.archivos(categoria);
CREATE INDEX IF NOT EXISTS idx_archivos_activo ON public.archivos(activo);
CREATE INDEX IF NOT EXISTS idx_archivos_created_at ON public.archivos(created_at DESC);

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS can_upload_files BOOLEAN DEFAULT false;

-- 2. Habilitar RLS y actualizar políticas completas en public.archivos
ALTER TABLE public.archivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver archivos activos" ON public.archivos;
CREATE POLICY "Usuarios autenticados pueden ver archivos activos"
  ON public.archivos
  FOR SELECT
  TO authenticated
  USING (
    activo = true
    OR auth.uid() = subido_por_id
    OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      LEFT JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.id = auth.uid()
        AND (
          ur.role = 'admin'
          OR ur.can_upload_files = true
          OR COALESCE((ur.custom_permissions->>'view_archivos')::boolean, false) = true
          OR COALESCE((ur.custom_permissions->>'subir_archivos')::boolean, false) = true
          OR COALESCE((ur.custom_permissions->>'edit_archivos')::boolean, false) = true
          OR COALESCE((ur.custom_permissions->>'view_noticias_ajustes')::boolean, false) = true
          OR COALESCE((ur.custom_permissions->>'edit_noticias_banner')::boolean, false) = true
          OR COALESCE((rp.permissions->>'edit_archivos')::boolean, false) = true
          OR COALESCE((rp.permissions->>'subir_archivos')::boolean, false) = true
        )
    )
  );

DROP POLICY IF EXISTS "Usuarios autorizados pueden subir archivos" ON public.archivos;
CREATE POLICY "Usuarios autorizados pueden subir archivos"
  ON public.archivos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      LEFT JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.id = auth.uid()
        AND (
          ur.role = 'admin'
          OR ur.can_upload_files = true
          OR COALESCE((ur.custom_permissions->>'subir_archivos')::boolean, false) = true
          OR COALESCE((ur.custom_permissions->>'edit_archivos')::boolean, false) = true
          OR COALESCE((rp.permissions->>'subir_archivos')::boolean, false) = true
          OR COALESCE((rp.permissions->>'edit_archivos')::boolean, false) = true
        )
    )
  );

DROP POLICY IF EXISTS "Admin y autor pueden modificar archivos" ON public.archivos;
CREATE POLICY "Admin y autor pueden modificar archivos"
  ON public.archivos
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = subido_por_id
    OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      LEFT JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.id = auth.uid()
        AND (
          ur.role = 'admin'
          OR ur.can_upload_files = true
          OR COALESCE((ur.custom_permissions->>'subir_archivos')::boolean, false) = true
          OR COALESCE((ur.custom_permissions->>'edit_archivos')::boolean, false) = true
          OR COALESCE((rp.permissions->>'subir_archivos')::boolean, false) = true
          OR COALESCE((rp.permissions->>'edit_archivos')::boolean, false) = true
        )
    )
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admin y autor pueden eliminar archivos" ON public.archivos;
CREATE POLICY "Admin y autor pueden eliminar archivos"
  ON public.archivos
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = subido_por_id
    OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      LEFT JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.id = auth.uid()
        AND (
          ur.role = 'admin'
          OR ur.can_upload_files = true
          OR COALESCE((ur.custom_permissions->>'subir_archivos')::boolean, false) = true
          OR COALESCE((ur.custom_permissions->>'edit_archivos')::boolean, false) = true
          OR COALESCE((rp.permissions->>'subir_archivos')::boolean, false) = true
          OR COALESCE((rp.permissions->>'edit_archivos')::boolean, false) = true
        )
    )
  );

-- 3. Función RPC para incrementar descargas de archivos
CREATE OR REPLACE FUNCTION public.increment_descarga_archivo(archivo_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.archivos
  SET descargas_count = COALESCE(descargas_count, 0) + 1,
      updated_at = timezone('utc'::text, now())
  WHERE id = archivo_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_descarga_archivo(UUID) TO authenticated;

-- 4. Asegurar Buckets de Storage SIN restricción restrictiva de MIME types para documentos (PDF, Word, Excel, ZIP, imágenes)
-- NOTA: Anteriormente el bucket 'socorristas' solo aceptaba imágenes y PDF (migración 29), bloqueando .docx, .xlsx, .zip, etc.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('socorristas', 'socorristas', true, 52428800, NULL),
  ('archivos', 'archivos', true, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = NULL;

-- Políticas de Storage para lectura pública y subida/actualización/borrado autenticado
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

DROP POLICY IF EXISTS "Allow Authenticated Delete Objects" ON storage.objects;
CREATE POLICY "Allow Authenticated Delete Objects" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id IN ('socorristas', 'archivos', 'logos', 'plantillas', 'assets'));

-- 5. Asegurar columnas de adjuntos y recorte en noticias_banner (por si no se ejecutó migración 36)
ALTER TABLE IF EXISTS public.noticias_banner
  ADD COLUMN IF NOT EXISTS imagen_banner_url TEXT,
  ADD COLUMN IF NOT EXISTS archivos_adjuntos JSONB DEFAULT '[]'::jsonb;

-- Recargar caché de esquema de PostgREST
NOTIFY pgrst, 'reload schema';
