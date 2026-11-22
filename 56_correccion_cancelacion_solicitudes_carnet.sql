-- =========================================================================================
-- MIGRACIÓN 56: CORRECCIÓN Y CANCELACIÓN DE SOLICITUDES DE CARNET OBSERVADAS
-- Cruz Verde Salvadoreña - Sistema Institucional
-- =========================================================================================
-- Qué asegura esta migración (100% idempotente, NO borra ni altera registros existentes):
-- 1. Actualiza la restricción CHECK de estado_solicitud en public.solicitudes_carnet para
--    admitir oficialmente los estados 'Cancelada' y 'Cancelado' además de los existentes.
-- 2. Agrega columnas de trazabilidad de corrección y cancelación en public.solicitudes_carnet:
--      - nota_correccion TEXT
--      - fecha_correccion TIMESTAMPTZ
--      - motivo_cancelacion TEXT
--      - cancelado_por TEXT
--      - fecha_cancelacion TIMESTAMPTZ
-- 3. Actualiza las políticas RLS para que los usuarios solicitantes autenticados puedan
--    reenviar o cancelar solicitudes que fueron marcadas como 'Observada'.
-- 4. Crea las funciones RPC seguras (SECURITY DEFINER):
--      - public.corregir_solicitud_carnet(...): permite al solicitante corregir el nombre
--        estructurado del socorrista (primer/segundo nombre y apellidos en mayúsculas,
--        validando ausencia de símbolos impropios) y/o su fotografía sin requerir permiso
--        global de edición del catálogo de socorristas, devolviendo la solicitud a 'Pendiente'.
--      - public.cancelar_solicitud_carnet(...): marca una solicitud no completada como
--        'Cancelada' registrando motivo, usuario y sello de tiempo oficial.
-- 5. Crea un índice liviano para estados cerrados (Completado/Completada/Finalizada/Cancelada)
--    y recarga el esquema de PostgREST.
-- =========================================================================================

-- 1. Columnas y restricción CHECK en public.solicitudes_carnet
DO $$
DECLARE
  v_conname TEXT;
BEGIN
  IF to_regclass('public.solicitudes_carnet') IS NOT NULL THEN
    ALTER TABLE public.solicitudes_carnet
      ADD COLUMN IF NOT EXISTS nota_correccion TEXT,
      ADD COLUMN IF NOT EXISTS fecha_correccion TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT,
      ADD COLUMN IF NOT EXISTS cancelado_por TEXT,
      ADD COLUMN IF NOT EXISTS fecha_cancelacion TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS foto_analisis JSONB,
      ADD COLUMN IF NOT EXISTS foto_fondo_reemplazado BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

    -- Eliminar restricciones CHECK previas sobre estado_solicitud para evitar conflictos
    FOR v_conname IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = 'solicitudes_carnet'
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) ILIKE '%estado_solicitud%'
    LOOP
      EXECUTE format('ALTER TABLE public.solicitudes_carnet DROP CONSTRAINT IF EXISTS %I', v_conname);
    END LOOP;

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
          'Rechazada',
          'Cancelada',
          'Cancelado'
        )
      );

    CREATE INDEX IF NOT EXISTS idx_solicitudes_carnet_cerradas
      ON public.solicitudes_carnet (estado_solicitud, fecha_solicitud DESC)
      WHERE estado_solicitud IN ('Completado', 'Completada', 'Finalizada', 'Cancelada', 'Cancelado');
  END IF;
END $$;

-- 2. Políticas RLS para permitir reenvío o cancelación de solicitudes Observadas/Rechazadas
DO $$
BEGIN
  IF to_regclass('public.solicitudes_carnet') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Permitir reenvio de solicitudes observadas o rechazadas" ON public.solicitudes_carnet;
    CREATE POLICY "Permitir reenvio de solicitudes observadas o rechazadas"
      ON public.solicitudes_carnet
      FOR UPDATE
      TO authenticated
      USING (estado_solicitud IN ('Observada', 'Rechazada'))
      WITH CHECK (estado_solicitud IN ('Pendiente', 'Cancelada'));
  END IF;
END $$;

-- 3. RPC segura para corregir nombre y/o fotografía en una solicitud Observada y reenviarla
CREATE OR REPLACE FUNCTION public.corregir_solicitud_carnet(
  p_solicitud_id BIGINT,
  p_primer_nombre TEXT,
  p_segundo_nombre TEXT DEFAULT NULL,
  p_primer_apellido TEXT DEFAULT NULL,
  p_segundo_apellido TEXT DEFAULT NULL,
  p_foto_url TEXT DEFAULT NULL,
  p_foto_analisis JSONB DEFAULT NULL,
  p_foto_fondo_reemplazado BOOLEAN DEFAULT NULL,
  p_nota_correccion TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sol RECORD;
  v_p1 TEXT;
  v_p2 TEXT;
  v_a1 TEXT;
  v_a2 TEXT;
  v_full_name TEXT;
  v_foto_final TEXT;
  v_nota TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debe iniciar sesión para corregir una solicitud de carnet.';
  END IF;

  SELECT id, socorrista_id, estado_solicitud, foto_url
  INTO v_sol
  FROM public.solicitudes_carnet
  WHERE id = p_solicitud_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud de carnet #% no existe.', p_solicitud_id;
  END IF;

  IF v_sol.estado_solicitud NOT IN ('Observada', 'Rechazada') THEN
    RAISE EXCEPTION 'Solo se pueden corregir solicitudes en estado Observada o Rechazada (estado actual: %).',
      v_sol.estado_solicitud;
  END IF;

  v_p1 := upper(trim(COALESCE(p_primer_nombre, '')));
  v_p2 := NULLIF(upper(trim(COALESCE(p_segundo_nombre, ''))), '');
  v_a1 := upper(trim(COALESCE(p_primer_apellido, '')));
  v_a2 := NULLIF(upper(trim(COALESCE(p_segundo_apellido, ''))), '');

  IF v_p1 = '' OR v_a1 = '' THEN
    RAISE EXCEPTION 'El primer nombre y el primer apellido son obligatorios según DUI.';
  END IF;

  -- Validar ausencia de números o símbolos impropios de un nombre (solo letras y espacios)
  IF v_p1 !~ '^[[:alpha:][:space:]]+$'
     OR (v_p2 IS NOT NULL AND v_p2 !~ '^[[:alpha:][:space:]]+$')
     OR v_a1 !~ '^[[:alpha:][:space:]]+$'
     OR (v_a2 IS NOT NULL AND v_a2 !~ '^[[:alpha:][:space:]]+$') THEN
    RAISE EXCEPTION 'El nombre o apellido contiene símbolos o números no permitidos para emisión de carnet.';
  END IF;

  v_full_name := trim(regexp_replace(
    concat_ws(' ', v_p1, v_p2, v_a1, v_a2),
    '[[:space:]]+',
    ' ',
    'g'
  ));

  v_foto_final := COALESCE(NULLIF(trim(COALESCE(p_foto_url, '')), ''), v_sol.foto_url);
  v_nota := NULLIF(trim(COALESCE(p_nota_correccion, '')), '');

  -- Actualizar el perfil del socorrista con el nombre corregido (y fotografía si se actualizó)
  IF v_sol.socorrista_id IS NOT NULL THEN
    UPDATE public.socorristas
    SET
      primer_nombre = v_p1,
      segundo_nombre = v_p2,
      primer_apellido = v_a1,
      segundo_apellido = v_a2,
      foto_url = COALESCE(v_foto_final, foto_url)
    WHERE id = v_sol.socorrista_id;
  END IF;

  -- Actualizar y reenviar la solicitud de carnet a Pendiente
  UPDATE public.solicitudes_carnet
  SET
    foto_url = v_foto_final,
    foto_analisis = COALESCE(p_foto_analisis, foto_analisis),
    foto_fondo_reemplazado = COALESCE(p_foto_fondo_reemplazado, foto_fondo_reemplazado),
    estado_solicitud = 'Pendiente',
    observaciones = NULL,
    revisado_por = NULL,
    fecha_revision = NULL,
    nota_correccion = v_nota,
    fecha_correccion = v_now,
    fecha_solicitud = v_now,
    updated_at = v_now
  WHERE id = p_solicitud_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_solicitud_id,
    'socorrista_id', v_sol.socorrista_id,
    'nombre_completo', v_full_name,
    'estado_solicitud', 'Pendiente',
    'fecha_correccion_sv', to_char(timezone('America/El_Salvador', v_now), 'DD/MM/YYYY HH12:MI AM')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.corregir_solicitud_carnet(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.corregir_solicitud_carnet(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN, TEXT) TO authenticated;

-- 4. RPC segura para cancelar una solicitud de carnet (especialmente cuando fue Observada)
CREATE OR REPLACE FUNCTION public.cancelar_solicitud_carnet(
  p_solicitud_id BIGINT,
  p_motivo TEXT DEFAULT NULL,
  p_cancelado_por TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sol RECORD;
  v_motivo TEXT;
  v_actor TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debe iniciar sesión para cancelar una solicitud de carnet.';
  END IF;

  SELECT id, estado_solicitud
  INTO v_sol
  FROM public.solicitudes_carnet
  WHERE id = p_solicitud_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud de carnet #% no existe.', p_solicitud_id;
  END IF;

  IF v_sol.estado_solicitud IN ('Completado', 'Completada', 'Finalizada') THEN
    RAISE EXCEPTION 'No se puede cancelar una solicitud que ya fue completada.';
  END IF;

  IF v_sol.estado_solicitud IN ('Cancelada', 'Cancelado') THEN
    RETURN jsonb_build_object(
      'ok', true,
      'id', p_solicitud_id,
      'estado_solicitud', 'Cancelada',
      'already_cancelled', true
    );
  END IF;

  v_motivo := NULLIF(trim(COALESCE(p_motivo, '')), '');
  v_actor := NULLIF(trim(COALESCE(p_cancelado_por, '')), '');

  UPDATE public.solicitudes_carnet
  SET
    estado_solicitud = 'Cancelada',
    motivo_cancelacion = v_motivo,
    cancelado_por = v_actor,
    fecha_cancelacion = v_now,
    updated_at = v_now
  WHERE id = p_solicitud_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_solicitud_id,
    'estado_solicitud', 'Cancelada',
    'fecha_cancelacion_sv', to_char(timezone('America/El_Salvador', v_now), 'DD/MM/YYYY HH12:MI AM')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_solicitud_carnet(BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_solicitud_carnet(BIGINT, TEXT, TEXT) TO authenticated;

-- 5. Refrescar caché de esquema de PostgREST / Supabase API
ANALYZE public.solicitudes_carnet;
NOTIFY pgrst, 'reload schema';
