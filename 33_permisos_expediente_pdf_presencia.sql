-- =========================================================================================
-- MIGRACIÓN 33: PERMISOS DE EXPEDIENTE DIGITAL, PREVISUALIZACIÓN PDF Y PERSONAS CONECTADAS
-- =========================================================================================
-- Ejecutar este script en el SQL Editor de Supabase para habilitar y sincronizar:
-- 1. Nuevas claves de permisos en public.role_permissions:
--    - ver_previsualizacion_pdf (Controla botones de Previsualización / Impresión PDF)
--    - subir_expediente_socorrista (Subir o reemplazar documentos digitales del socorrista)
--    - ver_expediente_socorrista (Previsualizar documentos del expediente en línea)
--    - descargar_expediente_socorrista (Descargar archivos del expediente digital)
--    - ver_personas_conectadas (Permite abrir el listado de quiénes están en línea)
-- 2. Tabla public.documentos_socorrista asegurada para el expediente digital versionado.
-- 3. Columna custom_permissions en public.user_roles para excepciones individuales.
-- =========================================================================================

-- -----------------------------------------------------------------------------------------
-- 1. ASEGURAR COLUMNA custom_permissions EN public.user_roles
-- -----------------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.user_roles
  ADD COLUMN IF NOT EXISTS custom_permissions JSONB DEFAULT '{}'::jsonb;

-- -----------------------------------------------------------------------------------------
-- 2. ACTUALIZAR PERMISOS BASE DE ROLES EN public.role_permissions SIN BORRAR CONFIGURACIÓN PREVIA
-- -----------------------------------------------------------------------------------------
-- Admin: todos los nuevos permisos habilitados por defecto
UPDATE public.role_permissions
SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_build_object(
  'ver_previsualizacion_pdf', true,
  'subir_expediente_socorrista', true,
  'ver_expediente_socorrista', true,
  'descargar_expediente_socorrista', true,
  'ver_personas_conectadas', true
)
WHERE role = 'admin';

-- Director y Jefe de Seccional: PDF y expediente habilitados; listado de personas conectadas desactivado por defecto
UPDATE public.role_permissions
SET permissions = jsonb_build_object(
  'ver_previsualizacion_pdf', true,
  'subir_expediente_socorrista', true,
  'ver_expediente_socorrista', true,
  'descargar_expediente_socorrista', true,
  'ver_personas_conectadas', false
) || COALESCE(permissions, '{}'::jsonb)
WHERE role IN ('director', 'jefe_seccional');

-- Otros roles (socorrista, instructor, administrativo): PDF habilitado; expediente y lista de conectados desactivados por defecto
UPDATE public.role_permissions
SET permissions = jsonb_build_object(
  'ver_previsualizacion_pdf', true,
  'subir_expediente_socorrista', false,
  'ver_expediente_socorrista', false,
  'descargar_expediente_socorrista', false,
  'ver_personas_conectadas', false
) || COALESCE(permissions, '{}'::jsonb)
WHERE role IN ('socorrista', 'instructor', 'administrativo');

-- -----------------------------------------------------------------------------------------
-- 3. ASEGURAR TABLA Y RLS DE EXPEDIENTE DIGITAL (public.documentos_socorrista)
-- -----------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documentos_socorrista (
  id SERIAL PRIMARY KEY,
  socorrista_id INTEGER NOT NULL REFERENCES public.socorristas(id) ON DELETE CASCADE,
  tipo_documento TEXT NOT NULL,
  nombre_archivo TEXT NOT NULL,
  archivo_url TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  es_vigente BOOLEAN DEFAULT true,
  tamanio_bytes INTEGER,
  fecha_subida TIMESTAMPTZ DEFAULT NOW(),
  subido_por TEXT
);

CREATE INDEX IF NOT EXISTS idx_doc_socorrista
  ON public.documentos_socorrista(socorrista_id, tipo_documento);

ALTER TABLE public.documentos_socorrista ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on documentos_socorrista" ON public.documentos_socorrista;
DROP POLICY IF EXISTS "Autenticados leen documentos_socorrista" ON public.documentos_socorrista;
DROP POLICY IF EXISTS "Autorizados escriben documentos_socorrista" ON public.documentos_socorrista;

CREATE POLICY "Autenticados leen documentos_socorrista"
  ON public.documentos_socorrista
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Autorizados escriben documentos_socorrista"
  ON public.documentos_socorrista
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      LEFT JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.id = auth.uid()
        AND (
          ur.role IN ('admin', 'director', 'jefe_seccional')
          OR COALESCE((ur.custom_permissions->>'subir_expediente_socorrista')::boolean, false) = true
          OR COALESCE((rp.permissions->>'subir_expediente_socorrista')::boolean, false) = true
        )
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      LEFT JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.id = auth.uid()
        AND (
          ur.role IN ('admin', 'director', 'jefe_seccional')
          OR COALESCE((ur.custom_permissions->>'subir_expediente_socorrista')::boolean, false) = true
          OR COALESCE((rp.permissions->>'subir_expediente_socorrista')::boolean, false) = true
        )
    )
  );

-- Recargar caché de esquema de PostgREST
NOTIFY pgrst, 'reload schema';
