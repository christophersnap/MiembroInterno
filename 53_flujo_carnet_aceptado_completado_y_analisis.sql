-- ============================================================================
-- MIGRACIÓN 53: FLUJO DE SOLICITUDES DE CARNET (ACEPTADA -> GENERAR -> COMPLETADO)
-- Y METADATOS DE ANÁLISIS / RECORTE DE FOTOGRAFÍA
-- Cruz Verde Salvadoreña - Sistema Institucional
-- ============================================================================
-- Qué resuelve esta migración:
-- 1. Actualiza la restricción CHECK de public.solicitudes_carnet(estado_solicitud)
--    para permitir los estados 'Completado' y 'Aceptada' junto a todos los
--    estados previos ('Pendiente', 'En revisión', 'Observada', 'Aprobada',
--    'En impresión', 'Lista para entrega', 'Completada', 'Finalizada', 'Rechazada').
-- 2. Agrega columnas opcionales de trazabilidad para la generación del carnet y
--    el análisis/recorte local de fotografía:
--      - fecha_completado TIMESTAMPTZ
--      - completado_por TEXT
--      - foto_analisis JSONB
--      - foto_fondo_reemplazado BOOLEAN DEFAULT FALSE
-- 3. Crea un índice parcial para que la pantalla Generar Carnet consulte solo
--    solicitudes aceptadas ('Aprobada', 'Aceptada') de forma instantánea y sin
--    saturar la base de datos.
-- 4. Asegura políticas RLS de actualización para usuarios autenticados en
--    public.solicitudes_carnet (aceptar, recortar foto y marcar como Completado).
-- ============================================================================

-- 1. Ampliar CHECK constraint de estado_solicitud en public.solicitudes_carnet
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  FOR v_constraint IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'solicitudes_carnet'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%estado_solicitud%'
  LOOP
    EXECUTE format('ALTER TABLE public.solicitudes_carnet DROP CONSTRAINT IF EXISTS %I', v_constraint);
  END LOOP;
END $$;

ALTER TABLE public.solicitudes_carnet
  ADD CONSTRAINT solicitudes_carnet_estado_check
  CHECK (
    estado_solicitud IN (
      'Pendiente',
      'En revisión',
      'Observada',
      'Aprobada',
      'Aceptada',
      'En impresión',
      'Lista para entrega',
      'Completado',
      'Completada',
      'Finalizada',
      'Rechazada'
    )
  );

-- 2. Columnas opcionales de trazabilidad de completado y análisis local de foto
ALTER TABLE public.solicitudes_carnet
  ADD COLUMN IF NOT EXISTS fecha_completado TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completado_por TEXT,
  ADD COLUMN IF NOT EXISTS foto_analisis JSONB,
  ADD COLUMN IF NOT EXISTS foto_fondo_reemplazado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- 3. Índice parcial optimizado para la cola de Generar Carnet (solo aceptadas)
CREATE INDEX IF NOT EXISTS idx_solicitudes_carnet_aprobadas_generar
  ON public.solicitudes_carnet (socorrista_id, fecha_solicitud DESC)
  WHERE estado_solicitud IN ('Aprobada', 'Aceptada');

-- Índice auxiliar para historial de completados
CREATE INDEX IF NOT EXISTS idx_solicitudes_carnet_completado_fecha
  ON public.solicitudes_carnet (fecha_completado DESC)
  WHERE estado_solicitud IN ('Completado', 'Completada');

-- 4. Verificar políticas RLS de UPDATE para personal autenticado
ALTER TABLE public.solicitudes_carnet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can update solicitudes_carnet" ON public.solicitudes_carnet;
CREATE POLICY "Authenticated can update solicitudes_carnet"
  ON public.solicitudes_carnet
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Refrescar estadísticas y caché de esquema de PostgREST
ANALYZE public.solicitudes_carnet;
NOTIFY pgrst, 'reload schema';
