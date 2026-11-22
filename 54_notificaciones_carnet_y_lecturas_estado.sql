-- =========================================================================================
-- MIGRACIÓN 54: NOTIFICACIONES DIFERENCIADAS DE SOLICITUDES DE CARNET Y LECTURAS POR ESTADO
-- Cruz Verde Salvadoreña - Sistema Institucional
-- =========================================================================================
-- Qué asegura esta migración (100% idempotente, no borra datos existentes):
-- 1. Verifica que public.solicitudes_carnet cuente con fecha_revision y updated_at para
--    detectar cambios de estado realizados por usuarios con permiso para solventar.
-- 2. Crea índices compuestos livianos en public.solicitudes_carnet para acelerar las
--    consultas de notificaciones tanto para solventadores como para solicitantes.
-- 3. Verifica la tabla public.solicitudes_lecturas (clave TEXT que soporta lecturas por
--    estado como "<id>:estado:<estado>:<ts>") y sus políticas RLS por usuario.
-- 4. Asegura lectura autenticada de objetos del bucket 'socorristas' para descarga de
--    fotografía en "Conoce a tu Socorrista" (PNG/PDF) en cualquier dispositivo.
-- =========================================================================================

-- 1. Columnas necesarias en public.solicitudes_carnet
DO $$
BEGIN
  IF to_regclass('public.solicitudes_carnet') IS NOT NULL THEN
    ALTER TABLE public.solicitudes_carnet
      ADD COLUMN IF NOT EXISTS fecha_revision TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

    CREATE INDEX IF NOT EXISTS idx_solicitudes_carnet_estado_fecha
      ON public.solicitudes_carnet (estado_solicitud, fecha_solicitud DESC);

    CREATE INDEX IF NOT EXISTS idx_solicitudes_carnet_solicitante_email_estado
      ON public.solicitudes_carnet (lower(solicitado_por_email), estado_solicitud, fecha_solicitud DESC)
      WHERE solicitado_por_email IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_solicitudes_carnet_fecha_revision
      ON public.solicitudes_carnet (fecha_revision DESC)
      WHERE fecha_revision IS NOT NULL;
  END IF;
END $$;

-- 2. Tabla public.solicitudes_lecturas (soporta claves por estado para solicitantes de carnet)
CREATE TABLE IF NOT EXISTS public.solicitudes_lecturas (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modulo TEXT NOT NULL,
  solicitud_key TEXT NOT NULL,
  leido_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, modulo, solicitud_key)
);

-- Asegurar que el CHECK de modulo incluya los 4 módulos vigentes
DO $$
DECLARE
  v_con RECORD;
BEGIN
  FOR v_con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'solicitudes_lecturas'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%modulo%'
  LOOP
    EXECUTE format('ALTER TABLE public.solicitudes_lecturas DROP CONSTRAINT IF EXISTS %I', v_con.conname);
  END LOOP;
END $$;

ALTER TABLE public.solicitudes_lecturas
  ADD CONSTRAINT solicitudes_lecturas_modulo_check
  CHECK (modulo IN ('carnet', 'combustible', 'compra', 'soporte'));

CREATE INDEX IF NOT EXISTS idx_solicitudes_lecturas_user_modulo
  ON public.solicitudes_lecturas (user_id, modulo);

ALTER TABLE public.solicitudes_lecturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "solicitudes_lecturas_select_own" ON public.solicitudes_lecturas;
CREATE POLICY "solicitudes_lecturas_select_own"
  ON public.solicitudes_lecturas FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "solicitudes_lecturas_insert_own" ON public.solicitudes_lecturas;
CREATE POLICY "solicitudes_lecturas_insert_own"
  ON public.solicitudes_lecturas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "solicitudes_lecturas_update_own" ON public.solicitudes_lecturas;
CREATE POLICY "solicitudes_lecturas_update_own"
  ON public.solicitudes_lecturas FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "solicitudes_lecturas_delete_own" ON public.solicitudes_lecturas;
CREATE POLICY "solicitudes_lecturas_delete_own"
  ON public.solicitudes_lecturas FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitudes_lecturas TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'solicitudes_lecturas_id_seq') THEN
    GRANT USAGE, SELECT ON SEQUENCE public.solicitudes_lecturas_id_seq TO authenticated;
  END IF;
END $$;

-- 3. Asegurar lectura de fotografías del bucket 'socorristas' para usuarios autenticados
--    (necesario para que supabase.storage.download() funcione en todos los dispositivos al exportar Conoce a tu Socorrista)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'Authenticated can read socorristas storage photos'
    ) THEN
      CREATE POLICY "Authenticated can read socorristas storage photos"
        ON storage.objects FOR SELECT TO authenticated
        USING (bucket_id = 'socorristas');
    END IF;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Política de storage.objects omitida por privilegios; verificar desde Storage -> Policies en Supabase.';
END $$;

-- 4. Actualizar estadísticas y recargar caché de PostgREST
ANALYZE public.solicitudes_lecturas;
DO $$
BEGIN
  IF to_regclass('public.solicitudes_carnet') IS NOT NULL THEN
    ANALYZE public.solicitudes_carnet;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
