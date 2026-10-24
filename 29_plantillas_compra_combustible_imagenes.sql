-- ==============================================================================
-- 29_plantillas_compra_combustible_imagenes.sql
-- Separación de Configuración PDF, Imágenes, Almacenamiento Storage y Plantillas de Correo
-- Cruz Verde Salvadoreña - Sistema Institucional
-- ==============================================================================

-- 1. Asegurar existencia de la tabla general de configuraciones con RLS permisivo
CREATE TABLE IF NOT EXISTS public.configuracion (
  id BIGSERIAL,
  clave TEXT PRIMARY KEY,
  valor TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar restricción UNIQUE en 'clave' si la tabla ya existía
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
  NULL;
END $$;

ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura publica configuracion" ON public.configuracion;
DROP POLICY IF EXISTS "Public can read configuracion" ON public.configuracion;
CREATE POLICY "Permitir lectura publica configuracion" ON public.configuracion
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir gestion autenticada configuracion" ON public.configuracion;
DROP POLICY IF EXISTS "Admins can manage configuracion" ON public.configuracion;
CREATE POLICY "Permitir gestion autenticada configuracion" ON public.configuracion
  FOR ALL USING (true) WITH CHECK (true);

-- 2. Asegurar Buckets de Supabase Storage para Imágenes (socorristas, logos, plantillas)
-- Esto soluciona que las imágenes subidas no terminen de cargar o arrojen 400/403 al visor
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('socorristas', 'socorristas', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('logos', 'logos', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('plantillas', 'plantillas', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf'];

-- Políticas de lectura y escritura pública en storage.objects para que las imágenes siempre carguen
DROP POLICY IF EXISTS "Public Read Socorristas Bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow Public Read Objects" ON storage.objects;
CREATE POLICY "Allow Public Read Objects" ON storage.objects
  FOR SELECT USING (bucket_id IN ('socorristas', 'logos', 'plantillas', 'assets'));

DROP POLICY IF EXISTS "Allow Public Upload Objects" ON storage.objects;
CREATE POLICY "Allow Public Upload Objects" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id IN ('socorristas', 'logos', 'plantillas', 'assets'));

DROP POLICY IF EXISTS "Allow Public Update Objects" ON storage.objects;
CREATE POLICY "Allow Public Update Objects" ON storage.objects
  FOR UPDATE USING (bucket_id IN ('socorristas', 'logos', 'plantillas', 'assets'));

-- 3. Tabla específica de repositorio de imágenes de plantillas (PDF y Correo)
CREATE TABLE IF NOT EXISTS public.plantillas_imagenes (
  id BIGSERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  modulo TEXT NOT NULL, -- 'compra', 'combustible', 'correo', 'general'
  tipo TEXT NOT NULL,   -- 'logo_principal', 'logo_secundario', 'sello', 'footer', 'marca_agua'
  nombre TEXT NOT NULL,
  url TEXT,
  datos_base64 TEXT,
  posicion TEXT DEFAULT 'center', -- 'left', 'center', 'right', 'none'
  tamano TEXT DEFAULT 'medium',   -- 'small', 'medium', 'large'
  visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.plantillas_imagenes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Plantillas Imagenes" ON public.plantillas_imagenes;
CREATE POLICY "Public Read Plantillas Imagenes" ON public.plantillas_imagenes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Manage Plantillas Imagenes" ON public.plantillas_imagenes;
CREATE POLICY "Public Manage Plantillas Imagenes" ON public.plantillas_imagenes
  FOR ALL USING (true) WITH CHECK (true);

-- 4. Parámetros predeterminados para Solicitud de Compra / Mantenimiento
INSERT INTO public.configuracion (clave, valor)
VALUES
  -- Encabezado y Textos Oficiales Compra
  ('solicitudes_pdf_titulo', 'CRUZ VERDE SALVADOREÑA'),
  ('solicitudes_pdf_departamento', 'DEPARTAMENTO ADMINISTRATIVO.'),
  ('solicitudes_pdf_subtitulo', 'HOJA DE SOLICITUD DE COMPRA.'),
  ('solicitudes_pdf_font_family', 'sans'),
  ('solicitudes_pdf_font_size', 'normal'),
  ('solicitudes_pdf_watermark', 'true'),
  ('solicitudes_pdf_watermark_text', 'CRUZ VERDE SALVADOREÑA - DOCUMENTO OFICIAL'),
  ('solicitudes_pdf_watermark_opacity', '0.08'),
  ('solicitudes_pdf_pie_pagina', 'Cruz Verde Salvadoreña • Departamento Administrativo • Documento Oficial'),

  -- Imágenes Compra
  ('solicitudes_pdf_mostrar_logo', 'true'),
  ('solicitudes_pdf_logo_url', ''),
  ('solicitudes_pdf_logo_posicion', 'left'),
  ('solicitudes_pdf_logo_size', 'medium'),
  ('solicitudes_pdf_mostrar_logo_secundario', 'false'),
  ('solicitudes_pdf_logo_secundario_url', ''),
  ('solicitudes_pdf_logo_secundario_posicion', 'right'),
  ('solicitudes_pdf_logo_secundario_size', 'medium'),
  ('solicitudes_pdf_mostrar_sello', 'true'),
  ('solicitudes_pdf_mostrar_sello_img', 'false'),
  ('solicitudes_pdf_sello_img_url', ''),
  ('solicitudes_pdf_sello_img_posicion', 'center'),
  ('solicitudes_pdf_sello_img_size', 'medium'),
  ('solicitudes_pdf_mostrar_footer_img', 'false'),
  ('solicitudes_pdf_footer_img_url', ''),
  ('solicitudes_pdf_footer_img_posicion', 'center'),
  ('solicitudes_pdf_footer_img_size', 'medium'),

  -- Firmas en Orden Oficial Compra
  ('solicitudes_pdf_firma1_titulo', 'Firma: SOLICITANTE'),
  ('solicitudes_pdf_firma1_subtitulo', 'Director de Seccional'),
  ('solicitudes_pdf_firma2_titulo', 'Vo.Bo. Jefatura Administrativa'),
  ('solicitudes_pdf_firma2_subtitulo', 'Administración Central'),
  ('solicitudes_pdf_firma3_titulo', 'Autorizado'),
  ('solicitudes_pdf_firma3_subtitulo', 'Presidencia / Dirección General'),

  -- Plantilla de Correo Compra
  ('solicitudes_correo_destino', 'administracion@cruzverdesv.org'),
  ('solicitudes_correo_remitente', 'notificaciones@cruzverdesv.org'),
  ('solicitudes_correo_cc', 'presidencia@cruzverdesv.org'),
  ('solicitudes_asunto_plantilla', 'Solicitud de Compra/Mantenimiento - [DIRECTOR] - Seccional [SECCIONAL] - [FECHA]'),
  ('solicitudes_enviar_copia_solicitante', 'true'),
  ('solicitudes_correo_titulo', '¡Confirmamos de recibido tu solicitud de Compra y Mantenimiento!'),
  ('solicitudes_correo_subtitulo', 'Tu solicitud ha ingresado a la bandeja del Departamento Administrativo para su revisión'),
  ('solicitudes_correo_footer', 'Cualquier duda o consulta puedes enviar un correo a administracion@cruzverdesv.org o comunicarte al 2284-0000'),

  -- 5. Parámetros predeterminados para Solicitud de Combustible
  -- Encabezado y Textos Oficiales Combustible
  ('combustible_pdf_titulo', 'CRUZ VERDE SALVADOREÑA'),
  ('combustible_pdf_subtitulo', 'SOLICITUD DE VALES DE COMBUSTIBLE'),
  ('combustible_pdf_font_family', 'sans'),
  ('combustible_pdf_font_size', 'normal'),
  ('combustible_pdf_codigo_formulario', 'CVSCOMBUS/FORM001'),
  ('combustible_pdf_watermark', 'true'),
  ('combustible_pdf_watermark_text', 'CRUZ VERDE SALVADOREÑA - DOCUMENTO OFICIAL'),
  ('combustible_pdf_watermark_opacity', '0.08'),

  -- Imágenes Combustible
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
  ('combustible_pdf_footer_img_posicion', 'center'),
  ('combustible_pdf_footer_img_size', 'medium'),

  -- Etiquetas y Firmas en Orden Oficial Combustible
  ('combustible_pdf_label_solicitante', 'Nombre del Solicitante:'),
  ('combustible_pdf_label_seccional', 'Seccional:'),
  ('combustible_pdf_label_director', 'Director Seccional:'),
  ('combustible_pdf_label_actividad', 'Actividad o Servicio a Cubrir:'),
  ('combustible_pdf_label_correo', 'Correo Electrónico:'),
  ('combustible_pdf_label_contacto', 'Teléfono de Contacto:'),
  ('combustible_pdf_label_liquidacion', '¿Liquidó vales anteriores?:'),
  ('combustible_pdf_label_motivo', 'Motivo de No Liquidación:'),
  ('combustible_pdf_label_observaciones', 'Observaciones Adicionales:'),
  ('combustible_pdf_label_firma_solicitante', 'SOLICITANTE'),
  ('combustible_pdf_label_firma_admin', 'AUTORIZADO POR'),
  ('combustible_pdf_label_firma_sello', 'FIRMA Y SELLO DE AUTORIZACIÓN'),

  -- Plantilla de Correo Combustible
  ('combustible_correo_destino', 'control_combustible@cruzverdesv.org'),
  ('combustible_correo_remitente', 'notificaciones@cruzverdesv.org'),
  ('combustible_correo_cc', 'presidencia@cruzverdesv.org, administracion@cruzverdesv.org'),
  ('combustible_correo_asunto_plantilla', 'Solicitud de Combustible - [SOLICITANTE] - Seccional [SECCIONAL] - [FECHA]'),
  ('combustible_correo_enviar_copia_solicitante', 'true'),
  ('combustible_correo_titulo', '¡Confirmamos de recibido tu solicitud de Combustible!'),
  ('combustible_correo_subtitulo', 'Comunícate con Oficina Central para ver el estado de tu solicitud'),
  ('combustible_correo_footer_texto', 'Cualquier duda o consulta puedes enviar un correo a control_combustible@cruzverdesv.org o llamar al 7695-7911')
ON CONFLICT (clave) DO NOTHING;

-- Notificar a PostgREST para recargar esquema
NOTIFY pgrst, 'reload schema';
