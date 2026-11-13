-- =========================================================================================
-- MIGRACIÓN 34: JERARQUÍA DE CARGOS (PRINCIPAL + SECUNDARIOS), CATÁLOGOS EN AJUSTES
-- Y DETECCIÓN / PREVENCIÓN DE DUPLICADOS POR DUI Y NOMBRES ENTRE SECCIONALES
-- =========================================================================================
-- Ejecutar este script en el SQL Editor de Supabase para:
-- 1. Agregar la columna `cargos_secundarios` (JSONB) a `public.socorristas`.
-- 2. Inicializar los catálogos configurables de Cargos Institucionales y Administrativos.
-- 3. Crear índices de búsqueda rápida para detectar duplicados de nombres y DUI.
-- 4. Crear índice único seguro en DUI normalizado (solo si no existen duplicados previos).
-- =========================================================================================

-- -----------------------------------------------------------------------------------------
-- 1. COLUMNA: public.socorristas.cargos_secundarios (Orden jerárquico para carnets)
-- -----------------------------------------------------------------------------------------
ALTER TABLE public.socorristas
  ADD COLUMN IF NOT EXISTS cargos_secundarios JSONB DEFAULT '[]'::jsonb;

-- Asegurar valor por defecto limpio en registros existentes NULL
UPDATE public.socorristas
SET cargos_secundarios = '[]'::jsonb
WHERE cargos_secundarios IS NULL;

-- -----------------------------------------------------------------------------------------
-- 2. CATÁLOGOS EN AJUSTES: public.configuracion
-- -----------------------------------------------------------------------------------------
INSERT INTO public.configuracion (clave, valor)
VALUES (
  'cargos_institucionales_catalog',
  '["Aspirante a Socorrista","Socorrista","APAA","Rescatista Vertical","Rescatista Acuático","Rescatista Vehicular","Técnico en Urgencias Médicas (TUM)","Motorista de Ambulancia","Instructor","Paramédico"]'
)
ON CONFLICT (clave) DO NOTHING;

INSERT INTO public.configuracion (clave, valor)
VALUES (
  'cargos_administrativos_catalog',
  '["Director Seccional","Subdirector Seccional","Jefe de Brigada","Subjefe de Brigada","Coordinador de Juventud","Coordinador de Capacitación","Coordinador Operativo","Encargado de Logística","Secretario Seccional","Tesorero Seccional","Sin cargo administrativo"]'
)
ON CONFLICT (clave) DO NOTHING;

-- -----------------------------------------------------------------------------------------
-- 3. ÍNDICES PARA BÚSQUEDA Y DETECCIÓN DE DUPLICADOS ENTRE TODAS LAS SECCIONALES
-- -----------------------------------------------------------------------------------------
-- Índice por nombre + apellido en minúsculas para alertas rápidas de posibles homónimos
CREATE INDEX IF NOT EXISTS idx_socorristas_nombre_apellido_lower
  ON public.socorristas (
    LOWER(TRIM(COALESCE(primer_nombre, ''))),
    LOWER(TRIM(COALESCE(primer_apellido, '')))
  );

-- Índice por DUI limpio (solo dígitos/letras) para validación instantánea cross-seccional
CREATE INDEX IF NOT EXISTS idx_socorristas_dui_clean
  ON public.socorristas (
    REGEXP_REPLACE(UPPER(TRIM(COALESCE(dui, ''))), '[^A-Z0-9]', '', 'g')
  );

-- Índice único condicional en DUI normalizado:
-- Excluye menores de edad, vacíos y solo se crea si no hay duplicados históricos que bloqueen la migración.
DO $$
DECLARE
  has_duplicates BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.socorristas
    WHERE dui IS NOT NULL
      AND TRIM(dui) <> ''
      AND UPPER(REGEXP_REPLACE(TRIM(dui), '[^A-Z0-9]', '', 'g')) NOT IN ('', 'MENORDEEDAD', 'NA')
    GROUP BY UPPER(REGEXP_REPLACE(TRIM(dui), '[^A-Z0-9]', '', 'g'))
    HAVING COUNT(*) > 1
  ) INTO has_duplicates;

  IF NOT has_duplicates THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_socorristas_dui_normalizado
      ON public.socorristas (UPPER(REGEXP_REPLACE(TRIM(dui), '[^A-Z0-9]', '', 'g')))
      WHERE dui IS NOT NULL
        AND TRIM(dui) <> ''
        AND UPPER(REGEXP_REPLACE(TRIM(dui), '[^A-Z0-9]', '', 'g')) NOT IN ('', 'MENORDEEDAD', 'NA');
  ELSE
    RAISE NOTICE 'Existen DUI duplicados históricos en socorristas; la validación se aplicará desde la interfaz hasta depurar los registros.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------------------
-- 4. RECARGAR CACHÉ DE ESQUEMA DE POSTGREST
-- -----------------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
