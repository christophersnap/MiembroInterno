-- ==============================================================================
-- Script de Creación y Migración: Módulo de Solicitudes de Combustible y Seccionales
-- Cruz Verde Salvadoreña - Control y Dotación Institucional
-- ==============================================================================

-- 0. Actualizar tabla seccionales para incluir campo de correo institucional
ALTER TABLE public.seccionales ADD COLUMN IF NOT EXISTS correo TEXT;

-- Inicializar correos institucionales para las seccionales existentes si aún no tienen
UPDATE public.seccionales 
SET correo = LOWER(REGEXP_REPLACE(TRANSLATE(nombre, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'), '[^a-zA-Z0-9]', '', 'g')) || '@cruzverde.org.sv'
WHERE correo IS NULL OR correo = '';

-- 1. Tabla de Solicitudes de Combustible
CREATE TABLE IF NOT EXISTS public.solicitudes_combustible (
  id BIGSERIAL PRIMARY KEY,
  folio TEXT NOT NULL UNIQUE,
  seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL,
  seccional_nombre TEXT NOT NULL,
  director_nombre TEXT NOT NULL,
  correo_electronico TEXT NOT NULL,
  actividad TEXT NOT NULL,
  entrego_liquidacion_anterior BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_no_liquidacion TEXT,
  nombre_solicitante TEXT NOT NULL,
  telefono_solicitante TEXT NOT NULL,
  observaciones TEXT,
  fecha_solicitud DATE DEFAULT CURRENT_DATE,
  hora_solicitud TEXT,
  fecha_envio_completa TEXT,
  estado TEXT NOT NULL DEFAULT 'Pendiente', -- Pendiente, Aprobada, En Proceso, Rechazada, Entregada
  autorizado_por TEXT,
  fecha_autorizacion TIMESTAMPTZ,
  motivo_rechazo TEXT,
  correo_enviado BOOLEAN DEFAULT FALSE,
  correos_notificados TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índices de optimización
CREATE INDEX IF NOT EXISTS idx_solicitudes_combustible_seccional ON public.solicitudes_combustible(seccional_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_combustible_estado ON public.solicitudes_combustible(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_combustible_fecha ON public.solicitudes_combustible(fecha_solicitud);
CREATE INDEX IF NOT EXISTS idx_solicitudes_combustible_folio ON public.solicitudes_combustible(folio);

-- 3. Habilitar Seguridad por Filas (RLS)
ALTER TABLE public.solicitudes_combustible ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura solicitudes_combustible" ON public.solicitudes_combustible;
CREATE POLICY "Permitir lectura solicitudes_combustible" ON public.solicitudes_combustible
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion solicitudes_combustible" ON public.solicitudes_combustible;
CREATE POLICY "Permitir insercion solicitudes_combustible" ON public.solicitudes_combustible
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion solicitudes_combustible" ON public.solicitudes_combustible;
CREATE POLICY "Permitir actualizacion solicitudes_combustible" ON public.solicitudes_combustible
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir eliminacion solicitudes_combustible" ON public.solicitudes_combustible;
CREATE POLICY "Permitir eliminacion solicitudes_combustible" ON public.solicitudes_combustible
  FOR DELETE USING (true);

-- 4. Parámetros de Configuración por defecto para Notificaciones y Plantillas
INSERT INTO public.configuracion (clave, valor)
VALUES 
  ('combustible_correo_destino', 'control_combustible@cruzverdesv.org'),
  ('combustible_correo_cc', 'presidencia@cruzverde.org.sv, administracion@cruzverde.org.sv'),
  ('combustible_correo_contacto_telefono', '7695-7911'),
  ('combustible_correo_asunto_plantilla', 'Solicitud de Combustible - [SOLICITANTE] - Seccional [SECCIONAL] - [FECHA]'),
  ('combustible_correo_enviar_copia_solicitante', 'true'),
  ('combustible_correo_titulo', '¡Confirmamos de recibido tu solicitud de Combustible!'),
  ('combustible_correo_subtitulo', 'Comunícate con Oficina Central para ver el estado de tu solicitud'),
  ('combustible_correo_footer_texto', 'Cualquier duda o consulta puedes enviar un correo a control_combustible@cruzverdesv.org o llama/whatsapp al 7695-7911'),
  ('combustible_pdf_titulo', 'CRUZ VERDE SALVADOREÑA'),
  ('combustible_pdf_subtitulo', 'SOLICITUD DE COMBUSTIBLE'),
  ('combustible_pdf_font_family', 'sans'),
  ('combustible_pdf_font_size', 'normal'),
  ('combustible_pdf_codigo_formulario', 'CVSCOMBUS/FORM001'),
  ('combustible_pdf_watermark', 'true'),
  ('combustible_pdf_watermark_text', 'CRUZ VERDE SALVADOREÑA - COMBUSTIBLE'),
  ('combustible_pdf_watermark_opacity', '0.08'),
  ('combustible_pdf_label_solicitante', 'Nombre del solicitante'),
  ('combustible_pdf_label_seccional', 'Seccional'),
  ('combustible_pdf_label_director', 'Director de la seccional'),
  ('combustible_pdf_label_actividad', 'Actividad o Eventualidad'),
  ('combustible_pdf_label_correo', 'Correo Electronico'),
  ('combustible_pdf_label_contacto', 'Contacto'),
  ('combustible_pdf_label_liquidacion', 'A entregado liquidación de combustible del mes anterior?'),
  ('combustible_pdf_label_motivo', 'En caso de responder NO, favor especifique'),
  ('combustible_pdf_label_observaciones', 'Observaciones:'),
  ('combustible_pdf_label_firma_solicitante', 'Llenado por solicitante'),
  ('combustible_pdf_label_firma_admin', 'Llenado por Area Administrativa'),
  ('combustible_pdf_label_dui', 'Nombre segun DUI:'),
  ('combustible_pdf_label_fecha', 'Fecha:'),
  ('combustible_pdf_label_firma_sello', 'Firma y Sello'),
  ('combustible_pdf_label_autoriza', 'Nombre quién autoriza:'),
  ('combustible_pdf_label_fecha_auto', 'Fecha de autorización:')
ON CONFLICT (clave) DO NOTHING;

-- 5. Recargar esquema en PostgREST
NOTIFY pgrst, 'reload schema';
