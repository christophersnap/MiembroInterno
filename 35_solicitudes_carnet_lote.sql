-- =========================================================================================
-- MIGRACIÓN 35: SOLICITUDES DE CARNET EN LOTE Y BLOQUEO DE DUPLICADOS HASTA FINALIZACIÓN
-- =========================================================================================
-- Ejecutar este script en el SQL Editor de Supabase para habilitar:
-- 1. Columnas `lote_id` y `es_lote` en `public.solicitudes_carnet` para trazabilidad de lotes.
-- 2. Estado `'Finalizada'` en el CHECK constraint de `estado_solicitud`.
-- 3. Índices de consulta rápida por `socorrista_id` y `lote_id`.
-- 4. Políticas RLS para permitir verificación pública de solicitud activa (sin login)
--    y creación individual o en lote para usuarios autenticados.
-- =========================================================================================

-- -----------------------------------------------------------------------------------------
-- 1. COLUMNAS PARA SOLICITUDES EN LOTE
-- -----------------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.solicitudes_carnet
  ADD COLUMN IF NOT EXISTS lote_id TEXT,
  ADD COLUMN IF NOT EXISTS es_lote BOOLEAN DEFAULT false;

UPDATE public.solicitudes_carnet
SET es_lote = false
WHERE es_lote IS NULL;

-- -----------------------------------------------------------------------------------------
-- 2. ACTUALIZAR CHECK CONSTRAINT DE `estado_solicitud` (INCLUYE 'Finalizada')
-- -----------------------------------------------------------------------------------------
DO $$
DECLARE
  constraint_rec RECORD;
BEGIN
  FOR constraint_rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.solicitudes_carnet'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%estado_solicitud%'
  LOOP
    EXECUTE format('ALTER TABLE public.solicitudes_carnet DROP CONSTRAINT IF EXISTS %I', constraint_rec.conname);
  END LOOP;
END $$;

ALTER TABLE public.solicitudes_carnet
  ADD CONSTRAINT solicitudes_carnet_estado_check
  CHECK (estado_solicitud IN (
    'Pendiente',
    'En revisión',
    'Observada',
    'Aprobada',
    'En impresión',
    'Lista para entrega',
    'Completada',
    'Finalizada',
    'Rechazada'
  ));

-- -----------------------------------------------------------------------------------------
-- 3. ÍNDICES DE BÚSQUEDA RÁPIDA (INDIVIDUAL SIN LOGIN Y LOTE CON LOGIN)
-- -----------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_solicitudes_carnet_socorrista_fecha
  ON public.solicitudes_carnet (socorrista_id, fecha_solicitud DESC);

CREATE INDEX IF NOT EXISTS idx_solicitudes_carnet_lote
  ON public.solicitudes_carnet (lote_id)
  WHERE lote_id IS NOT NULL;

-- -----------------------------------------------------------------------------------------
-- 4. POLÍTICAS RLS (LECTURA PÚBLICA DE ESTADO + INSERCIÓN INDIVIDUAL/LOTE + GESTIÓN AUTH)
-- -----------------------------------------------------------------------------------------
ALTER TABLE public.solicitudes_carnet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura solicitudes_carnet" ON public.solicitudes_carnet;
CREATE POLICY "Permitir lectura solicitudes_carnet"
  ON public.solicitudes_carnet
  FOR SELECT
  TO public, anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir crear solicitudes_carnet publico" ON public.solicitudes_carnet;
CREATE POLICY "Permitir crear solicitudes_carnet publico"
  ON public.solicitudes_carnet
  FOR INSERT
  TO public, anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion solicitudes_carnet" ON public.solicitudes_carnet;
CREATE POLICY "Permitir actualizacion solicitudes_carnet"
  ON public.solicitudes_carnet
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Recargar caché de esquema de PostgREST
NOTIFY pgrst, 'reload schema';
