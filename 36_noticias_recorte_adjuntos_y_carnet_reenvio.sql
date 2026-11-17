-- =========================================================================================
-- MIGRACIÓN 36: ENCUADRE Y ADJUNTOS EN NOTICIAS BANNER + REENVÍO DE SOLICITUDES DE CARNET
-- =========================================================================================
-- Ejecutar este script en el SQL Editor de Supabase:
-- 1. Agrega soporte para imagen panorámica encuadrada (imagen_banner_url) separada de la
--    imagen completa (imagen_url) y documentos adjuntos de Archivos (archivos_adjuntos)
--    en la tabla public.noticias_banner.
-- 2. Habilita que solicitudes de carnet en estado 'Observada' o 'Rechazada' puedan ser
--    modificadas y reenviadas a 'Pendiente' por el usuario o elemento solicitante.
-- =========================================================================================

-- 1. Noticias Banner: recorte panorámico independiente + archivos adjuntos
ALTER TABLE IF EXISTS public.noticias_banner
  ADD COLUMN IF NOT EXISTS imagen_banner_url TEXT,
  ADD COLUMN IF NOT EXISTS archivos_adjuntos JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.noticias_banner.imagen_banner_url IS
  'URL de la porción encuadrada/recortada (24:8) para mostrar en el carrusel del Dashboard. imagen_url conserva la imagen completa para la Landing Page.';

COMMENT ON COLUMN public.noticias_banner.archivos_adjuntos IS
  'Lista JSON de archivos del módulo Archivos adjuntados a la noticia.';

-- 2. Solicitudes de Carnet: asegurar columnas de lote y permitir actualización de reenvío cuando estaba Observada o Rechazada
ALTER TABLE IF EXISTS public.solicitudes_carnet
  ADD COLUMN IF NOT EXISTS lote_id TEXT,
  ADD COLUMN IF NOT EXISTS es_lote BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP POLICY IF EXISTS "Permitir reenvio de solicitudes observadas o rechazadas" ON public.solicitudes_carnet;
CREATE POLICY "Permitir reenvio de solicitudes observadas o rechazadas"
  ON public.solicitudes_carnet
  FOR UPDATE
  TO public, anon, authenticated
  USING (estado_solicitud IN ('Observada', 'Rechazada'))
  WITH CHECK (estado_solicitud = 'Pendiente');

-- Recargar caché de esquema de PostgREST
NOTIFY pgrst, 'reload schema';
