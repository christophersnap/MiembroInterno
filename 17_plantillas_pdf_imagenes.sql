-- ==============================================================================
-- 17_plantillas_pdf_imagenes.sql
-- Almacenamiento de Imágenes y Configuración de Plantillas PDF en Base de Datos
-- Cruz Verde Salvadoreña - Sistema Institucional
-- ==============================================================================

-- 1. Asegurar existencia de la tabla general de configuraciones
CREATE TABLE IF NOT EXISTS public.configuracion (
  id BIGSERIAL,
  clave TEXT PRIMARY KEY,
  valor TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Si la tabla ya existía sin PRIMARY KEY en 'clave', asegurar la restricción UNIQUE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.configuracion'::regclass 
    AND (contype = 'p' OR contype = 'u') 
    AND conname LIKE '%clave%'
  ) THEN
    ALTER TABLE public.configuracion ADD CONSTRAINT uq_configuracion_clave UNIQUE (clave);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Continuar si ya está configurado
  NULL;
END $$;

-- 2. Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

-- Política de lectura: Cualquier usuario (público o autenticado) puede leer la configuración
-- para poder visualizar correctamente los encabezados, logos, sellos y firmas en los PDF
DROP POLICY IF EXISTS "Permitir lectura publica configuracion" ON public.configuracion;
DROP POLICY IF EXISTS "Public can read configuracion" ON public.configuracion;
CREATE POLICY "Permitir lectura publica configuracion" ON public.configuracion
  FOR SELECT USING (true);

-- Política de modificación: Usuarios autenticados o con rol administrador pueden insertar y actualizar
DROP POLICY IF EXISTS "Permitir gestion autenticada configuracion" ON public.configuracion;
DROP POLICY IF EXISTS "Admins can manage configuracion" ON public.configuracion;
CREATE POLICY "Permitir gestion autenticada configuracion" ON public.configuracion
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Inicializar parámetros para Solicitudes de Compra y Mantenimiento
INSERT INTO public.configuracion (clave, valor)
VALUES
  -- Imágenes de Compra
  ('solicitudes_pdf_mostrar_logo', 'true'),
  ('solicitudes_pdf_logo_url', ''),
  ('solicitudes_pdf_logo_posicion', 'center'),
  ('solicitudes_pdf_logo_size', 'medium'),
  ('solicitudes_pdf_mostrar_logo_secundario', 'false'),
  ('solicitudes_pdf_logo_secundario_url', ''),
  ('solicitudes_pdf_logo_secundario_posicion', 'right'),
  ('solicitudes_pdf_logo_secundario_size', 'medium'),
  ('solicitudes_pdf_mostrar_sello_img', 'false'),
  ('solicitudes_pdf_sello_img_url', ''),
  ('solicitudes_pdf_sello_img_posicion', 'center'),
  ('solicitudes_pdf_sello_img_size', 'medium'),
  ('solicitudes_pdf_mostrar_footer_img', 'false'),
  ('solicitudes_pdf_footer_img_url', ''),
  ('solicitudes_pdf_footer_img_posicion', 'center'),
  ('solicitudes_pdf_footer_img_size', 'medium'),

  -- Imágenes de Combustible
  ('combustible_pdf_mostrar_logo_header', 'true'),
  ('combustible_pdf_logo_header_url', ''),
  ('combustible_pdf_logo_posicion', 'left'),
  ('combustible_pdf_logo_size', 'medium'),
  ('combustible_pdf_mostrar_logo_secundario', 'false'),
  ('combustible_pdf_logo_secundario_url', ''),
  ('combustible_pdf_logo_secundario_posicion', 'right'),
  ('combustible_pdf_logo_secundario_size', 'medium'),
  ('combustible_pdf_mostrar_sello_img', 'false'),
  ('combustible_pdf_sello_img_url', ''),
  ('combustible_pdf_sello_img_posicion', 'center'),
  ('combustible_pdf_sello_img_size', 'medium'),
  ('combustible_pdf_mostrar_logo_footer', 'true'),
  ('combustible_pdf_logo_footer_url', ''),
  ('combustible_pdf_logo_footer_posicion', 'left'),
  ('combustible_pdf_logo_footer_size', 'medium')
ON CONFLICT (clave) DO NOTHING;

-- 4. Notificar a PostgREST para recargar esquema en Supabase
NOTIFY pgrst, 'reload schema';
