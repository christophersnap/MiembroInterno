-- =========================================================================================
-- MIGRACIÓN 55: ZONA HORARIA OFICIAL DE EL SALVADOR Y VALIDACIÓN DE NOMBRES EN CARNET
-- Cruz Verde Salvadoreña - Sistema Institucional
-- =========================================================================================
-- Qué asegura esta migración (100% idempotente, NO borra ni altera registros existentes):
-- 1. Crea funciones SQL utilitarias en zona horaria oficial de El Salvador
--    ('America/El_Salvador', UTC-06:00 sin cambio de horario):
--      - public.now_el_salvador()
--      - public.today_el_salvador()
--      - public.format_fecha_hora_el_salvador(TIMESTAMPTZ)
-- 2. Configura de forma segura la zona horaria por defecto en roles de conexión si los
--    permisos de Supabase lo permiten (sin lanzar error si el rol está restringido).
-- 3. Ajusta el DEFAULT de columnas DATE institucionales para usar la fecha calendario
--    de El Salvador ((timezone('America/El_Salvador', now()))::date), evitando cambios
--    de fecha anticipados a partir de las 6:00 PM hora local.
-- 4. Crea funciones de validación de nombres sin símbolos inválidos:
--      - public.validar_nombre_socorrista(TEXT)
--      - public.extraer_simbolos_invalidos_nombre(TEXT)
-- 5. Agrega un trigger en public.solicitudes_carnet que valida, al CREAR o REENVIAR
--    una solicitud de carnet, que el nombre completo del socorrista no contenga símbolos
--    o números que no correspondan a un nombre (nunca bloquea la aprobación/revisión de
--    solicitudes históricas ya registradas).
-- 6. Crea la vista de solo lectura public.v_socorristas_nombre_con_simbolos para auditar
--    y corregir fácilmente elementos cuyos nombres actuales contengan símbolos inválidos.
-- =========================================================================================

-- -----------------------------------------------------------------------------------------
-- 1. FUNCIONES DE FECHA Y HORA OFICIAL DE EL SALVADOR (America/El_Salvador / UTC-06:00)
-- -----------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.now_el_salvador()
RETURNS TIMESTAMP
LANGUAGE sql
STABLE
AS $$
  SELECT timezone('America/El_Salvador', now());
$$;

CREATE OR REPLACE FUNCTION public.today_el_salvador()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
  SELECT (timezone('America/El_Salvador', now()))::date;
$$;

CREATE OR REPLACE FUNCTION public.format_fecha_hora_el_salvador(p_ts TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_ts IS NULL THEN NULL
    ELSE to_char(timezone('America/El_Salvador', p_ts), 'DD/MM/YYYY HH12:MI AM')
  END;
$$;

-- Intentar establecer la zona horaria de sesión a America/El_Salvador de forma segura
DO $$
BEGIN
  BEGIN
    ALTER ROLE authenticated SET timezone = 'America/El_Salvador';
  EXCEPTION WHEN insufficient_privilege OR undefined_object THEN
    NULL;
  END;

  BEGIN
    ALTER ROLE anon SET timezone = 'America/El_Salvador';
  EXCEPTION WHEN insufficient_privilege OR undefined_object THEN
    NULL;
  END;

  BEGIN
    ALTER ROLE service_role SET timezone = 'America/El_Salvador';
  EXCEPTION WHEN insufficient_privilege OR undefined_object THEN
    NULL;
  END;
END $$;

-- -----------------------------------------------------------------------------------------
-- 2. AJUSTAR DEFAULTS DE COLUMNAS TIPO DATE A FECHA CALENDARIO DE EL SALVADOR
--    (Las columnas TIMESTAMPTZ almacenan el instante exacto y ahora reciben offset -06:00)
-- -----------------------------------------------------------------------------------------
DO $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type = 'date'
      AND column_name IN (
        'fecha',
        'fecha_solicitud',
        'fecha_ingreso',
        'fecha_otorgamiento',
        'fecha_emision',
        'fecha_registro'
      )
      AND (
        column_default IS NULL
        OR column_default ILIKE '%CURRENT_DATE%'
        OR column_default ILIKE '%now()%'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT (timezone(''America/El_Salvador'', now()))::date',
      v_rec.table_name,
      v_rec.column_name
    );
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------------------
-- 3. VALIDACIÓN DE NOMBRES SIN SÍMBOLOS INVÁLIDOS PARA SOLICITUDES DE CARNET
-- -----------------------------------------------------------------------------------------
-- Permite únicamente letras latinas/españolas (A-Z, a-z, tildes, diéresis, Ñ/ñ) y espacios.
-- Rechaza dígitos (0-9) y cualquier símbolo (., ; : _ - / \ @ # $ % & * + = ? ! () [] etc.).
CREATE OR REPLACE FUNCTION public.validar_nombre_socorrista(p_texto TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_limpio TEXT;
BEGIN
  IF p_texto IS NULL THEN
    RETURN TRUE;
  END IF;

  v_limpio := btrim(p_texto);
  IF v_limpio = '' THEN
    RETURN TRUE;
  END IF;

  RETURN v_limpio ~ '^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ[:space:]]+$';
END;
$$;

CREATE OR REPLACE FUNCTION public.extraer_simbolos_invalidos_nombre(p_texto TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    (
      SELECT string_agg(DISTINCT m.ch[1], ' ')
      FROM regexp_matches(COALESCE(p_texto, ''), '[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ[:space:]]', 'g') AS m(ch)
    ),
    ''
  );
$$;

-- Trigger en public.solicitudes_carnet:
-- Solo valida en INSERT nuevo o cuando se reenvía a estado 'Pendiente' tras un rechazo.
-- NO bloquea actualizaciones administrativas (Aprobada, Completada, Rechazada, recorte de foto).
CREATE OR REPLACE FUNCTION public.trg_fn_validar_nombre_solicitud_carnet()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_soc RECORD;
  v_simbolos TEXT := '';
  v_campos TEXT[] := ARRAY[]::TEXT[];
  v_check_simbolos TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT (
      NEW.estado_solicitud = 'Pendiente'
      AND OLD.estado_solicitud IS DISTINCT FROM 'Pendiente'
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Si hay socorrista_id vinculado, validar los campos oficiales del expediente
  IF NEW.socorrista_id IS NOT NULL AND to_regclass('public.socorristas') IS NOT NULL THEN
    SELECT primer_nombre, segundo_nombre, primer_apellido, segundo_apellido
    INTO v_soc
    FROM public.socorristas
    WHERE id = NEW.socorrista_id;

    IF FOUND THEN
      IF NULLIF(btrim(COALESCE(v_soc.primer_nombre, '')), '') IS NULL
         OR NULLIF(btrim(COALESCE(v_soc.primer_apellido, '')), '') IS NULL THEN
        RAISE EXCEPTION 'El socorrista debe tener registrados al menos su primer nombre y primer apellido antes de solicitar el carnet.';
      END IF;

      IF NOT public.validar_nombre_socorrista(v_soc.primer_nombre) THEN
        v_campos := array_append(v_campos, 'Primer nombre');
        v_simbolos := v_simbolos || public.extraer_simbolos_invalidos_nombre(v_soc.primer_nombre);
      END IF;
      IF NOT public.validar_nombre_socorrista(v_soc.segundo_nombre) THEN
        v_campos := array_append(v_campos, 'Segundo nombre');
        v_simbolos := v_simbolos || public.extraer_simbolos_invalidos_nombre(v_soc.segundo_nombre);
      END IF;
      IF NOT public.validar_nombre_socorrista(v_soc.primer_apellido) THEN
        v_campos := array_append(v_campos, 'Primer apellido');
        v_simbolos := v_simbolos || public.extraer_simbolos_invalidos_nombre(v_soc.primer_apellido);
      END IF;
      IF NOT public.validar_nombre_socorrista(v_soc.segundo_apellido) THEN
        v_campos := array_append(v_campos, 'Segundo apellido');
        v_simbolos := v_simbolos || public.extraer_simbolos_invalidos_nombre(v_soc.segundo_apellido);
      END IF;

      IF array_length(v_campos, 1) > 0 THEN
        v_check_simbolos := public.extraer_simbolos_invalidos_nombre(v_simbolos);
        RAISE EXCEPTION 'No se puede registrar la solicitud de carnet: el nombre del socorrista contiene símbolos no válidos (%) en %. Corrige el nombre en el perfil del socorrista.',
          v_check_simbolos,
          array_to_string(v_campos, ', ');
      END IF;
    END IF;
  END IF;

  -- Respaldo: validar también el campo socorrista_nombre si viene poblado
  IF NEW.socorrista_nombre IS NOT NULL AND NOT public.validar_nombre_socorrista(NEW.socorrista_nombre) THEN
    v_check_simbolos := public.extraer_simbolos_invalidos_nombre(NEW.socorrista_nombre);
    RAISE EXCEPTION 'No se puede registrar la solicitud de carnet: el nombre "%" contiene símbolos no válidos (%).',
      NEW.socorrista_nombre,
      v_check_simbolos;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.solicitudes_carnet') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_validar_nombre_solicitud_carnet ON public.solicitudes_carnet;
    CREATE TRIGGER trg_validar_nombre_solicitud_carnet
      BEFORE INSERT OR UPDATE ON public.solicitudes_carnet
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_fn_validar_nombre_solicitud_carnet();
  END IF;
END $$;

-- -----------------------------------------------------------------------------------------
-- 4. VISTA DIAGNÓSTICA DE SOLO LECTURA: SOCORRISTAS CON SÍMBOLOS INVÁLIDOS EN EL NOMBRE
-- -----------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.socorristas') IS NOT NULL THEN
    CREATE OR REPLACE VIEW public.v_socorristas_nombre_con_simbolos AS
    SELECT
      s.id,
      s.carnet,
      s.primer_nombre,
      s.segundo_nombre,
      s.primer_apellido,
      s.segundo_apellido,
      s.seccional_id,
      s.estado,
      public.extraer_simbolos_invalidos_nombre(
        concat_ws(' ', s.primer_nombre, s.segundo_nombre, s.primer_apellido, s.segundo_apellido)
      ) AS simbolos_detectados
    FROM public.socorristas s
    WHERE NOT public.validar_nombre_socorrista(s.primer_nombre)
       OR NOT public.validar_nombre_socorrista(s.segundo_nombre)
       OR NOT public.validar_nombre_socorrista(s.primer_apellido)
       OR NOT public.validar_nombre_socorrista(s.segundo_apellido)
       OR NULLIF(btrim(COALESCE(s.primer_nombre, '')), '') IS NULL
       OR NULLIF(btrim(COALESCE(s.primer_apellido, '')), '') IS NULL;

    BEGIN
      ALTER VIEW public.v_socorristas_nombre_con_simbolos SET (security_invoker = true);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.now_el_salvador() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.today_el_salvador() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.format_fecha_hora_el_salvador(TIMESTAMPTZ) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.validar_nombre_socorrista(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.extraer_simbolos_invalidos_nombre(TEXT) TO authenticated, anon;

-- Recargar caché de esquema de PostgREST
NOTIFY pgrst, 'reload schema';
