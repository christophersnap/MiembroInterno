-- =========================================================================================
-- MIGRACIÓN 57: PERMISOS DE ASIGNACIÓN POR CARGO Y JUNTA DIRECTIVA NACIONAL (JDN 2026 - 2028)
-- Cruz Verde Salvadoreña - Sistema Institucional
-- =========================================================================================
-- Qué implementa esta migración (100% idempotente, NO borra ni altera datos existentes):
-- 1. Agrega las columnas `cargo_jdn` y `periodo_jdn` a `public.socorristas` para almacenar
--    los 11 cargos oficiales de la Junta Directiva Nacional (Período 2026 - 2028).
-- 2. Restringe `cargo_jdn` (cuando no es nulo) a la lista oficial de 11 cargos JDN:
--    Presidente, Vice presidente, Tesorero, Pro tesorero, Secretario, Pro secretario,
--    Síndico, 1er Vocal, 2do Vocal, 3er Vocal, 4to Vocal.
-- 3. Crea un ÍNDICE ÚNICO PARCIAL a nivel nacional (`idx_socorristas_cargo_jdn_unico_nacional`)
--    que garantiza a nivel de base de datos que SOLO UNA PERSONA en todo el país pueda
--    ocupar cada cargo de la Junta Directiva Nacional simultáneamente.
-- 4. Agrega la clave de permiso `assign_jdn_cargos` en `public.role_permissions`
--    (true para `admin`, false por defecto para otros roles salvo configuración previa).
-- 5. Inicializa de forma segura las claves en `public.configuracion`:
--    - `cargos_asignacion_reglas` (reglas individuales de asignación por cargo/rango)
--    - `cargos_jdn_periodo` ('2026 - 2028')
-- 6. Crea la función RPC segura `public.asignar_cargo_jdn(...)` que valida permisos
--    (`admin`/`superadmin` o `assign_jdn_cargos = true` en rol o permisos individuales),
--    respeta unicidad nacional y ejecuta la asignación o liberación de forma atómica.
-- 7. Crea la vista de consulta rápida `public.v_junta_directiva_nacional` ordenada por
--    jerarquía oficial (1 al 11) para Dashboard y reportes.
-- =========================================================================================

-- -----------------------------------------------------------------------------------------
-- 1. COLUMNAS JDN EN public.socorristas + RESTRICCIÓN DE VALORES + UNICIDAD NACIONAL
-- -----------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.socorristas') IS NOT NULL THEN
    ALTER TABLE public.socorristas
      ADD COLUMN IF NOT EXISTS cargo_jdn TEXT,
      ADD COLUMN IF NOT EXISTS periodo_jdn TEXT DEFAULT '2026 - 2028';

    -- Restricción CHECK idempotente con los 11 cargos oficiales de la JDN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'chk_socorristas_cargo_jdn_oficial'
        AND conrelid = 'public.socorristas'::regclass
    ) THEN
      ALTER TABLE public.socorristas
        ADD CONSTRAINT chk_socorristas_cargo_jdn_oficial
        CHECK (
          cargo_jdn IS NULL
          OR btrim(cargo_jdn) = ''
          OR cargo_jdn IN (
            'Presidente',
            'Vice presidente',
            'Tesorero',
            'Pro tesorero',
            'Secretario',
            'Pro secretario',
            'Síndico',
            '1er Vocal',
            '2do Vocal',
            '3er Vocal',
            '4to Vocal'
          )
        );
    END IF;

    -- Índice único parcial a nivel nacional: máximo 1 socorrista por cada cargo JDN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_socorristas_cargo_jdn_unico_nacional
      ON public.socorristas (lower(btrim(cargo_jdn)))
      WHERE cargo_jdn IS NOT NULL AND btrim(cargo_jdn) <> '';
  END IF;
END $$;

-- -----------------------------------------------------------------------------------------
-- 2. PERMISO `assign_jdn_cargos` EN public.role_permissions
-- -----------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.role_permissions') IS NOT NULL THEN
    -- Admin siempre tiene habilitado assign_jdn_cargos
    UPDATE public.role_permissions
    SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_build_object('assign_jdn_cargos', true)
    WHERE lower(role) IN ('admin', 'superadmin')
      AND NOT (COALESCE(permissions, '{}'::jsonb) ? 'assign_jdn_cargos');

    -- Otros roles inician en false si aún no tienen la clave definida
    UPDATE public.role_permissions
    SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_build_object('assign_jdn_cargos', false)
    WHERE lower(role) NOT IN ('admin', 'superadmin')
      AND NOT (COALESCE(permissions, '{}'::jsonb) ? 'assign_jdn_cargos');
  END IF;
END $$;

-- -----------------------------------------------------------------------------------------
-- 3. CLAVES INICIALES EN public.configuracion (REGLAS POR CARGO Y PERÍODO JDN)
-- -----------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.configuracion') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'cargos_asignacion_reglas') THEN
      INSERT INTO public.configuracion (clave, valor)
      VALUES ('cargos_asignacion_reglas', '{}');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'cargos_jdn_periodo') THEN
      INSERT INTO public.configuracion (clave, valor)
      VALUES ('cargos_jdn_periodo', '2026 - 2028');
    END IF;
  END IF;
END $$;

-- -----------------------------------------------------------------------------------------
-- 4. FUNCIÓN AUXILIAR: VERIFICAR SI EL USUARIO AUTENTICADO PUEDE ASIGNAR CARGOS JDN
-- -----------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.usuario_puede_asignar_jdn(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_custom_perms JSONB;
  v_role_perms JSONB;
  v_custom_flag TEXT;
  v_role_flag TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT ur.role, COALESCE(ur.custom_permissions, '{}'::jsonb)
  INTO v_role, v_custom_perms
  FROM public.user_roles ur
  WHERE ur.id = p_user_id
  LIMIT 1;

  IF lower(COALESCE(v_role, '')) IN ('admin', 'superadmin') THEN
    RETURN TRUE;
  END IF;

  -- Si existe override individual explícito en user_roles.custom_permissions
  IF v_custom_perms ? 'assign_jdn_cargos' THEN
    v_custom_flag := lower(COALESCE(v_custom_perms->>'assign_jdn_cargos', 'false'));
    RETURN v_custom_flag = 'true';
  END IF;

  -- Caso contrario, hereda del rol en role_permissions
  IF v_role IS NOT NULL AND to_regclass('public.role_permissions') IS NOT NULL THEN
    SELECT COALESCE(rp.permissions, '{}'::jsonb)
    INTO v_role_perms
    FROM public.role_permissions rp
    WHERE lower(rp.role) = lower(v_role)
    LIMIT 1;

    v_role_flag := lower(COALESCE(v_role_perms->>'assign_jdn_cargos', 'false'));
    RETURN v_role_flag = 'true';
  END IF;

  RETURN FALSE;
END;
$$;

-- -----------------------------------------------------------------------------------------
-- 5. RPC ATÓMICA: ASIGNAR / CAMBIAR / LIBERAR CARGO DE JUNTA DIRECTIVA NACIONAL
-- -----------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.asignar_cargo_jdn(
  p_socorrista_id BIGINT,
  p_cargo_jdn TEXT,
  p_periodo TEXT DEFAULT '2026 - 2028',
  p_reemplazar BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_clean_cargo TEXT := NULLIF(btrim(COALESCE(p_cargo_jdn, '')), '');
  v_clean_periodo TEXT := COALESCE(NULLIF(btrim(COALESCE(p_periodo, '')), ''), '2026 - 2028');
  v_existing_holder_id BIGINT;
  v_existing_holder_name TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sesión no autenticada.');
  END IF;

  IF NOT public.usuario_puede_asignar_jdn(v_uid) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'No tienes permiso autorizado en Accesos para asignar o modificar cargos de la Junta Directiva Nacional (JDN).'
    );
  END IF;

  IF p_socorrista_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Debe indicar un socorrista válido.');
  END IF;

  -- Liberar cargo JDN del socorrista si p_cargo_jdn es NULL/vacío
  IF v_clean_cargo IS NULL THEN
    UPDATE public.socorristas
    SET cargo_jdn = NULL,
        periodo_jdn = NULL
    WHERE id = p_socorrista_id;

    RETURN jsonb_build_object('ok', true, 'action', 'released', 'socorrista_id', p_socorrista_id);
  END IF;

  -- Validar que el cargo pertenezca a la lista oficial de 11 cargos JDN
  IF v_clean_cargo NOT IN (
    'Presidente',
    'Vice presidente',
    'Tesorero',
    'Pro tesorero',
    'Secretario',
    'Pro secretario',
    'Síndico',
    '1er Vocal',
    '2do Vocal',
    '3er Vocal',
    '4to Vocal'
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', format('El cargo "%s" no es un cargo oficial de la Junta Directiva Nacional.', v_clean_cargo)
    );
  END IF;

  -- Verificar si otra persona ya ocupa ese cargo a nivel nacional
  SELECT s.id,
         trim(concat_ws(' ', s.primer_nombre, s.segundo_nombre, s.primer_apellido, s.segundo_apellido))
  INTO v_existing_holder_id, v_existing_holder_name
  FROM public.socorristas s
  WHERE lower(btrim(s.cargo_jdn)) = lower(v_clean_cargo)
    AND s.id <> p_socorrista_id
  LIMIT 1;

  IF v_existing_holder_id IS NOT NULL THEN
    IF NOT COALESCE(p_reemplazar, FALSE) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', format('El cargo %s ya está ocupado a nivel nacional por %s.', v_clean_cargo, v_existing_holder_name)
      );
    END IF;

    -- Liberar titular anterior antes de asignar al nuevo (evita conflicto del índice único)
    UPDATE public.socorristas
    SET cargo_jdn = NULL,
        periodo_jdn = NULL
    WHERE id = v_existing_holder_id;
  END IF;

  -- Asignar el cargo al socorrista seleccionado
  UPDATE public.socorristas
  SET cargo_jdn = v_clean_cargo,
      periodo_jdn = v_clean_periodo
  WHERE id = p_socorrista_id;

  RETURN jsonb_build_object(
    'ok', true,
    'action', 'assigned',
    'socorrista_id', p_socorrista_id,
    'cargo_jdn', v_clean_cargo,
    'periodo_jdn', v_clean_periodo,
    'replaced_socorrista_id', v_existing_holder_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.usuario_puede_asignar_jdn(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.usuario_puede_asignar_jdn(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.asignar_cargo_jdn(BIGINT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.asignar_cargo_jdn(BIGINT, TEXT, TEXT, BOOLEAN) TO authenticated;

-- -----------------------------------------------------------------------------------------
-- 6. VISTA ORDENADA DE LA JUNTA DIRECTIVA NACIONAL (PERÍODO 2026 - 2028)
-- -----------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_junta_directiva_nacional AS
WITH orden_jdn(orden, cargo) AS (
  VALUES
    (1,  'Presidente'),
    (2,  'Vice presidente'),
    (3,  'Tesorero'),
    (4,  'Pro tesorero'),
    (5,  'Secretario'),
    (6,  'Pro secretario'),
    (7,  'Síndico'),
    (8,  '1er Vocal'),
    (9,  '2do Vocal'),
    (10, '3er Vocal'),
    (11, '4to Vocal')
)
SELECT
  o.orden,
  o.cargo AS cargo_jdn,
  COALESCE(s.periodo_jdn, '2026 - 2028') AS periodo_jdn,
  s.id AS socorrista_id,
  trim(concat_ws(' ', s.primer_nombre, s.segundo_nombre, s.primer_apellido, s.segundo_apellido)) AS nombre_completo,
  s.carnet,
  s.foto_url,
  s.seccional_id,
  sec.nombre AS seccional_nombre,
  s.cargo_institucional
FROM orden_jdn o
LEFT JOIN public.socorristas s
  ON lower(btrim(s.cargo_jdn)) = lower(o.cargo)
LEFT JOIN public.seccionales sec
  ON sec.id = s.seccional_id
ORDER BY o.orden ASC;

GRANT SELECT ON public.v_junta_directiva_nacional TO authenticated;

-- -----------------------------------------------------------------------------------------
-- 7. REFRESCAR ESTADÍSTICAS Y CACHÉ DE POSTGREST
-- -----------------------------------------------------------------------------------------
ANALYZE public.socorristas;
ANALYZE public.configuracion;
NOTIFY pgrst, 'reload schema';
