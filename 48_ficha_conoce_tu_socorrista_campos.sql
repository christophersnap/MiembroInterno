-- =========================================================================================
-- MIGRACIÓN 48: CAMPOS ADICIONALES PARA FICHA OFICIAL "CONOCE A TU SOCORRISTA" (CVSSOCC/FORM001)
-- =========================================================================================
-- Agrega a public.socorristas los campos requeridos por el formulario oficial CVSSOCC/FORM001
-- de cumplimiento institucional (UIF / Prevención de Lavado de Dinero y de Activos).
-- Nota: El campo NIT es opcional (homologado con DUI en El Salvador).
-- =========================================================================================

ALTER TABLE public.socorristas
  ADD COLUMN IF NOT EXISTS nit TEXT,
  ADD COLUMN IF NOT EXISTS estado_civil TEXT,
  ADD COLUMN IF NOT EXISTS nombre_conyuge TEXT,
  ADD COLUMN IF NOT EXISTS nombre_dependientes TEXT,
  ADD COLUMN IF NOT EXISTS nacionalidad TEXT,
  ADD COLUMN IF NOT EXISTS profesion_ocupacion TEXT,
  ADD COLUMN IF NOT EXISTS fecha_inicio_relacion_laboral TEXT,
  ADD COLUMN IF NOT EXISTS direccion_domicilio TEXT,
  ADD COLUMN IF NOT EXISTS cargo_publico_ultimos_5_anios BOOLEAN,
  ADD COLUMN IF NOT EXISTS cargo_publico_periodo TEXT,
  ADD COLUMN IF NOT EXISTS cargo_publico_posicion TEXT,
  ADD COLUMN IF NOT EXISTS ficha_kyc_completada BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ficha_kyc_actualizada_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_socorristas_ficha_kyc_completada
  ON public.socorristas (ficha_kyc_completada);

-- Marcar automáticamente como completadas las fichas que ya cuenten con todos los campos requeridos
UPDATE public.socorristas
SET ficha_kyc_completada = (
  COALESCE(btrim(estado_civil), '') <> ''
  AND COALESCE(btrim(nombre_conyuge), '') <> ''
  AND COALESCE(btrim(nombre_dependientes), '') <> ''
  AND COALESCE(btrim(nacionalidad), '') <> ''
  AND COALESCE(btrim(profesion_ocupacion), '') <> ''
  AND COALESCE(btrim(fecha_inicio_relacion_laboral), '') <> ''
  AND COALESCE(btrim(direccion_domicilio), '') <> ''
  AND cargo_publico_ultimos_5_anios IS NOT NULL
  AND (
    cargo_publico_ultimos_5_anios = false
    OR (
      COALESCE(btrim(cargo_publico_periodo), '') <> ''
      AND COALESCE(btrim(cargo_publico_posicion), '') <> ''
    )
  )
);

NOTIFY pgrst, 'reload schema';
