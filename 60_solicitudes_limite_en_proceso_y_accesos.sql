-- =========================================================================================
-- MIGRACIÓN 60: CONTROL DE SOLICITUDES EN PROCESO POR SECCIONAL Y CUPO ADICIONAL EN ACCESOS
-- Cruz Verde Salvadoreña - Sistema Institucional
-- =========================================================================================
-- Qué garantiza esta migración (100% idempotente, NO borra ni modifica registros previos):
-- 1. Asegura que public.user_roles.custom_permissions (JSONB) exista para guardar el cupo
--    de solicitudes adicionales en proceso por usuario (_extra_solicitudes_en_proceso).
-- 2. Asegura que las columnas `estado` de `solicitudes_combustible` y `solicitudes_compra`
--    acepten los estados institucionales incluyendo 'Finalizada' y 'Entregada'.
-- 3. Crea índices ligeros sobre (seccional_id, estado) y (lower(seccional_nombre), estado)
--    para verificar al instante si una seccional tiene solicitudes en proceso.
-- 4. Crea la función RPC SECURITY DEFINER `public.obtener_solicitudes_activas_seccional`
--    que consulta las solicitudes en proceso de una seccional (sin quedar ciega por RLS
--    cuando otro usuario de la misma seccional registró la solicitud anterior).
-- =========================================================================================

-- -----------------------------------------------------------------------------------------
-- 1. ASEGURAR COLUMNA custom_permissions EN public.user_roles
-- -----------------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_roles'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_roles'
        AND column_name = 'custom_permissions'
    ) THEN
      ALTER TABLE public.user_roles
        ADD COLUMN custom_permissions JSONB DEFAULT '{}'::jsonb;
    END IF;
  END IF;
END $$;

-- -----------------------------------------------------------------------------------------
-- 2. VERIFICAR RESTRICCIONES DE ESTADO (PERMITIR 'Finalizada' Y 'Entregada')
-- -----------------------------------------------------------------------------------------
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  -- solicitudes_combustible
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'solicitudes_combustible'
  ) THEN
    FOR v_constraint IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = 'solicitudes_combustible'
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) ILIKE '%estado%'
    LOOP
      EXECUTE format('ALTER TABLE public.solicitudes_combustible DROP CONSTRAINT IF EXISTS %I', v_constraint);
    END LOOP;

    ALTER TABLE public.solicitudes_combustible
      ADD CONSTRAINT solicitudes_combustible_estado_check
      CHECK (
        estado IN (
          'Pendiente',
          'En Proceso',
          'Aprobada',
          'Entregada',
          'Finalizada',
          'Rechazada',
          'Cancelada'
        )
      );
  END IF;

  -- solicitudes_compra
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'solicitudes_compra'
  ) THEN
    FOR v_constraint IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = 'solicitudes_compra'
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) ILIKE '%estado%'
    LOOP
      EXECUTE format('ALTER TABLE public.solicitudes_compra DROP CONSTRAINT IF EXISTS %I', v_constraint);
    END LOOP;

    ALTER TABLE public.solicitudes_compra
      ADD CONSTRAINT solicitudes_compra_estado_check
      CHECK (
        estado IN (
          'Pendiente',
          'En Proceso',
          'En Proceso de Compra',
          'Aprobada',
          'Entregada',
          'Finalizada',
          'Rechazada',
          'Cancelada'
        )
      );
  END IF;
END $$;

-- -----------------------------------------------------------------------------------------
-- 3. ÍNDICES PARA VALIDACIÓN RÁPIDA DE SOLICITUDES ACTIVAS POR SECCIONAL
-- -----------------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'solicitudes_combustible'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_sol_combustible_seccional_estado
      ON public.solicitudes_combustible (seccional_id, estado);

    CREATE INDEX IF NOT EXISTS idx_sol_combustible_secnombre_estado
      ON public.solicitudes_combustible (lower(seccional_nombre), estado);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'solicitudes_compra'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_sol_compra_seccional_estado
      ON public.solicitudes_compra (seccional_id, estado);

    CREATE INDEX IF NOT EXISTS idx_sol_compra_secnombre_estado
      ON public.solicitudes_compra (lower(seccional_nombre), estado);
  END IF;
END $$;

-- -----------------------------------------------------------------------------------------
-- 4. FUNCIÓN RPC PARA CONSULTAR SOLICITUDES EN PROCESO DE UNA SECCIONAL
--    (Solo devuelve metadatos mínimos: folio, estado, fecha y solicitante)
-- -----------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.obtener_solicitudes_activas_seccional(
  p_tipo TEXT,
  p_seccional_id BIGINT DEFAULT NULL,
  p_seccional_nombre TEXT DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  folio TEXT,
  estado TEXT,
  fecha_solicitud TEXT,
  solicitante TEXT,
  seccional_id BIGINT,
  seccional_nombre TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo TEXT := lower(trim(coalesce(p_tipo, '')));
  v_nombre TEXT := lower(trim(coalesce(p_seccional_nombre, '')));
BEGIN
  -- Requiere sesión autenticada
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF p_seccional_id IS NULL AND v_nombre = '' THEN
    RETURN;
  END IF;

  IF v_tipo = 'combustible' THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'solicitudes_combustible'
    ) THEN
      RETURN QUERY
      SELECT
        sc.id::text AS id,
        coalesce(sc.folio, '#' || sc.id::text) AS folio,
        coalesce(sc.estado, 'Pendiente')::text AS estado,
        coalesce(sc.fecha_solicitud::text, sc.created_at::text, '') AS fecha_solicitud,
        coalesce(sc.nombre_solicitante, 'Solicitante')::text AS solicitante,
        sc.seccional_id::bigint AS seccional_id,
        coalesce(sc.seccional_nombre, '')::text AS seccional_nombre
      FROM public.solicitudes_combustible sc
      WHERE lower(trim(coalesce(sc.estado, 'Pendiente'))) NOT IN (
          'finalizada', 'entregada', 'rechazada', 'cancelada'
        )
        AND (
          (p_seccional_id IS NOT NULL AND sc.seccional_id = p_seccional_id)
          OR (v_nombre <> '' AND lower(trim(coalesce(sc.seccional_nombre, ''))) = v_nombre)
        )
      ORDER BY sc.created_at DESC NULLS LAST
      LIMIT 50;
    END IF;
  ELSIF v_tipo = 'compra' THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'solicitudes_compra'
    ) THEN
      RETURN QUERY
      SELECT
        sp.id::text AS id,
        coalesce(sp.folio, '#' || sp.id::text) AS folio,
        coalesce(sp.estado, 'Pendiente')::text AS estado,
        coalesce(sp.fecha_solicitud::text, sp.created_at::text, '') AS fecha_solicitud,
        coalesce(sp.solicitado_por, 'Solicitante')::text AS solicitante,
        sp.seccional_id::bigint AS seccional_id,
        coalesce(sp.seccional_nombre, '')::text AS seccional_nombre
      FROM public.solicitudes_compra sp
      WHERE lower(trim(coalesce(sp.estado, 'Pendiente'))) NOT IN (
          'finalizada', 'entregada', 'rechazada', 'cancelada'
        )
        AND (
          (p_seccional_id IS NOT NULL AND sp.seccional_id = p_seccional_id)
          OR (v_nombre <> '' AND lower(trim(coalesce(sp.seccional_nombre, ''))) = v_nombre)
        )
      ORDER BY sp.created_at DESC NULLS LAST
      LIMIT 50;
    END IF;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.obtener_solicitudes_activas_seccional(TEXT, BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obtener_solicitudes_activas_seccional(TEXT, BIGINT, TEXT) TO authenticated;

-- Recargar caché de esquema de PostgREST
NOTIFY pgrst, 'reload schema';
