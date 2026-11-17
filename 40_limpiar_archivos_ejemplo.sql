-- ==============================================================================
-- 40_limpiar_archivos_ejemplo.sql
-- Elimina los 3 archivos de ejemplo precargados de public.archivos y asegura
-- permisos RLS y Storage para que los archivos reales aparezcan en Archivos y Noticias.
-- Cruz Verde Salvadoreña - Sistema Administrativo
-- ==============================================================================

-- 1. Eliminar los 3 registros de ejemplo sembrados inicialmente por la migración 21
DELETE FROM public.archivos
WHERE url_archivo LIKE 'https://images.unsplash.com/%'
  AND titulo IN (
    'Manual de Primeros Auxilios Básicos y Avanzados 2026',
    'Formato Oficial de Hoja de Servicio y Turnos de Ambulancia',
    'Reglamento Interno y Código de Ética Institucional'
  );

-- 2. Asegurar políticas RLS de lectura/escritura en public.archivos
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

-- 3. Asegurar Storage buckets sin restricción de MIME para documentos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('socorristas', 'socorristas', true, 52428800, NULL),
  ('archivos', 'archivos', true, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = NULL;

-- 4. Asegurar columna archivos_adjuntos en public.noticias_banner
ALTER TABLE IF EXISTS public.noticias_banner
  ADD COLUMN IF NOT EXISTS imagen_banner_url TEXT,
  ADD COLUMN IF NOT EXISTS archivos_adjuntos JSONB DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
