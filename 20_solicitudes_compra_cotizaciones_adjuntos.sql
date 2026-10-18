-- ==============================================================================
-- 20_solicitudes_compra_cotizaciones_adjuntos.sql
-- Módulo de Solicitudes de Compra y Mantenimiento - Cruz Verde Salvadoreña
-- Soporte para fotos y documentos de cotizaciones adjuntas
-- ==============================================================================

-- 1. Agregar columna JSONB para almacenar fotos y documentos de cotizaciones adjuntas
ALTER TABLE public.solicitudes_compra 
ADD COLUMN IF NOT EXISTS cotizaciones_archivos JSONB DEFAULT '[]'::jsonb;

-- 2. Asegurar que las columnas de motorista y cargo existan con valores consistentes
ALTER TABLE public.solicitudes_compra 
ADD COLUMN IF NOT EXISTS solicitado_por TEXT,
ADD COLUMN IF NOT EXISTS cargo TEXT DEFAULT 'Motorista';

-- 3. Comentarios informativos de la estructura
COMMENT ON COLUMN public.solicitudes_compra.cotizaciones_archivos IS 'Almacena arreglo de fotos y documentos de cotizaciones en formato JSON [{nombre, tipo, tamano, url}]';
COMMENT ON COLUMN public.solicitudes_compra.solicitado_por IS 'Nombre completo del motorista o solicitante de la seccional';
COMMENT ON COLUMN public.solicitudes_compra.cargo IS 'Cargo del solicitante (por defecto Motorista según normativa institucional)';
