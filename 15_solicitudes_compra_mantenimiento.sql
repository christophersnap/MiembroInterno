-- ==============================================================================
-- 15_solicitudes_compra_mantenimiento.sql
-- Módulo de Solicitudes de Compra, Reparaciones y Mantenimiento de Seccionales
-- Cruz Verde Salvadoreña - Departamento Administrativo
-- ==============================================================================

-- 1. Si la tabla existía con esquema previo incompleto o sin columnas de folios/firmas, recrearla limpiamente
DROP TABLE IF EXISTS public.solicitudes_compra CASCADE;

CREATE TABLE public.solicitudes_compra (
  id BIGSERIAL PRIMARY KEY,
  folio TEXT NOT NULL UNIQUE,
  seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL,
  seccional_nombre TEXT NOT NULL,
  solicitado_por TEXT NOT NULL,
  cargo TEXT NOT NULL DEFAULT 'Director',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  tipo_solicitud TEXT NOT NULL DEFAULT 'Repuestos para Vehículo',
  es_para_vehiculo BOOLEAN DEFAULT FALSE,
  vehiculo_id BIGINT REFERENCES public.vehiculos(id) ON DELETE SET NULL,
  vehiculo_placa TEXT,
  vehiculo_descripcion TEXT,
  descripcion TEXT NOT NULL,
  monto_estimado NUMERIC(12, 2),
  proveedor_sugerido TEXT,
  prioridad TEXT NOT NULL DEFAULT 'Normal', -- 'Normal', 'Urgente', 'Emergencia'
  lugar_fecha TEXT NOT NULL,
  fecha_solicitud DATE DEFAULT CURRENT_DATE,
  hora_solicitud TEXT,
  estado TEXT NOT NULL DEFAULT 'Pendiente', -- 'Pendiente', 'Aprobada', 'En Proceso de Compra', 'Rechazada', 'Finalizada'
  autorizado_por TEXT,
  fecha_autorizacion TIMESTAMPTZ,
  motivo_rechazo TEXT,
  correo_enviado BOOLEAN DEFAULT FALSE,
  correos_notificados TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de búsqueda y filtrado
CREATE INDEX IF NOT EXISTS idx_solicitudes_seccional ON public.solicitudes_compra(seccional_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_vehiculo ON public.solicitudes_compra(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON public.solicitudes_compra(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_fecha ON public.solicitudes_compra(fecha_solicitud);
CREATE INDEX IF NOT EXISTS idx_solicitudes_folio ON public.solicitudes_compra(folio);

-- 2. Habilitar RLS
ALTER TABLE public.solicitudes_compra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura solicitudes_compra" ON public.solicitudes_compra;
CREATE POLICY "Permitir lectura solicitudes_compra" ON public.solicitudes_compra
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion solicitudes_compra" ON public.solicitudes_compra;
CREATE POLICY "Permitir insercion solicitudes_compra" ON public.solicitudes_compra
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion solicitudes_compra" ON public.solicitudes_compra;
CREATE POLICY "Permitir actualizacion solicitudes_compra" ON public.solicitudes_compra
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir eliminacion solicitudes_compra" ON public.solicitudes_compra;
CREATE POLICY "Permitir eliminacion solicitudes_compra" ON public.solicitudes_compra
  FOR DELETE USING (true);

-- 3. Parámetros de configuración por defecto para solicitudes, notificaciones y formato de impresión PDF
INSERT INTO public.configuracion (clave, valor)
VALUES 
  ('allow_seccional_edit_vehiculos', 'false'),
  ('solicitudes_correo_destino', 'administracion@cruzverde.org.sv'),
  ('solicitudes_correo_remitente', 'notificaciones@cruzverde.org.sv'),
  ('solicitudes_correo_cc', 'presidencia@cruzverde.org.sv'),
  ('solicitudes_asunto_plantilla', 'Solicitud de Compra/Mantenimiento - [DIRECTOR] - Seccional [SECCIONAL] - [FECHA]'),
  ('solicitudes_enviar_copia_solicitante', 'true'),
  ('solicitudes_pdf_titulo', 'CRUZ VERDE SALVADOREÑA'),
  ('solicitudes_pdf_departamento', 'DEPARTAMENTO ADMINISTRATIVO.'),
  ('solicitudes_pdf_subtitulo', 'HOJA DE SOLICITUD DE COMPRA.'),
  ('solicitudes_pdf_watermark', 'true'),
  ('solicitudes_pdf_watermark_text', 'CRUZ VERDE SALVADOREÑA - DOCUMENTO OFICIAL'),
  ('solicitudes_pdf_watermark_opacity', '0.08'),
  ('solicitudes_pdf_mostrar_urgencia', 'true'),
  ('solicitudes_pdf_mostrar_vehiculo', 'true'),
  ('solicitudes_pdf_mostrar_costos', 'true'),
  ('solicitudes_pdf_mostrar_proveedor', 'true'),
  ('solicitudes_pdf_mostrar_fechahora', 'true'),
  ('solicitudes_pdf_firma1_titulo', 'Firma: SOLICITANTE'),
  ('solicitudes_pdf_firma1_subtitulo', 'Director de Seccional'),
  ('solicitudes_pdf_firma2_titulo', 'Vo.Bo. Jefatura Administrativa'),
  ('solicitudes_pdf_firma2_subtitulo', 'Administración Central'),
  ('solicitudes_pdf_firma3_titulo', 'Autorizado Presidencia'),
  ('solicitudes_pdf_firma3_subtitulo', 'Dirección General'),
  ('solicitudes_pdf_pie_pagina', 'Este documento es de carácter oficial e institucional de Cruz Verde Salvadoreña.')
ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;

-- 4. Recargar esquema PostgREST
NOTIFY pgrst, 'reload schema';

