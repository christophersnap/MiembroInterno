-- =========================================================================================
-- MIGRACIÓN 49: DEPENDIENTES CON PARENTESCO (CVSSOCC/FORM001) Y ESTABILIDAD DE SCHEMA CACHE
-- =========================================================================================
-- 1. Asegura todas las columnas de la ficha "Conoce a tu Socorrista" incluyendo
--    dependientes_detalle (JSONB) para guardar lista estructurada de { nombre, parentesco }.
-- 2. Refuerza permisos de esquema para authenticator, anon y authenticated para evitar
--    errores transitorios "Could not query the database for the schema cache" en PostgREST.
-- =========================================================================================

-- 1. Asegurar permisos base sobre el esquema public para PostgREST
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- 2. Asegurar columnas completas de CVSSOCC/FORM001 + detalle estructurado de dependientes
ALTER TABLE public.socorristas
  ADD COLUMN IF NOT EXISTS nit TEXT,
  ADD COLUMN IF NOT EXISTS estado_civil TEXT,
  ADD COLUMN IF NOT EXISTS nombre_conyuge TEXT,
  ADD COLUMN IF NOT EXISTS nombre_dependientes TEXT,
  ADD COLUMN IF NOT EXISTS dependientes_detalle JSONB DEFAULT '[]'::jsonb,
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

-- 3. Asegurar permisos de tabla para lecturas/escrituras autenticadas y verificación QR
GRANT SELECT ON TABLE public.socorristas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.socorristas TO authenticated;
GRANT SELECT ON TABLE public.seccionales TO anon, authenticated;

-- 4. Recargar caché de esquema de PostgREST limpiamente
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
