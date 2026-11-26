-- =========================================================================================
-- MIGRACIÓN 58: CAMPOS OPCIONALES Y PLANTILLA OFICIAL DE SOLICITUDES DE COMBUSTIBLE
-- Cruz Verde Salvadoreña - Sistema Institucional
-- =========================================================================================
-- Qué asegura esta migración (100% idempotente, NO borra ni altera datos existentes):
-- 1. Agrega columnas opcionales (vehiculo_marca, vehiculo_modelo, vehiculo_placa,
--    tipo_combustible, galones_solicitados, cantidad_dinero) a public.solicitudes_combustible
--    para cuando la plantilla habilite solicitarlos/mostrarlos.
-- 2. Asegura que fecha_solicitud use por defecto la fecha calendario de El Salvador
--    ((timezone('America/El_Salvador', now()))::date).
-- 3. Inserta las claves de configuración por defecto en public.configuracion (con
--    ON CONFLICT DO NOTHING) para subtítulo "Documento Oficial Administrativo",
--    Jefatura de Operaciones editable, sello institucional sutil y toggles de campos
--    opcionales (desactivados por defecto).
-- =========================================================================================

-- 1. Columnas opcionales en public.solicitudes_combustible
DO $$
BEGIN
  IF to_regclass('public.solicitudes_combustible') IS NOT NULL THEN
    ALTER TABLE public.solicitudes_combustible
      ADD COLUMN IF NOT EXISTS vehiculo_marca TEXT,
      ADD COLUMN IF NOT EXISTS vehiculo_modelo TEXT,
      ADD COLUMN IF NOT EXISTS vehiculo_placa TEXT,
      ADD COLUMN IF NOT EXISTS tipo_combustible TEXT,
      ADD COLUMN IF NOT EXISTS galones_solicitados TEXT,
      ADD COLUMN IF NOT EXISTS cantidad_dinero NUMERIC(12, 2);

    ALTER TABLE public.solicitudes_combustible
      ALTER COLUMN fecha_solicitud SET DEFAULT (timezone('America/El_Salvador', now()))::date;
  END IF;
END $$;

-- 2. Parámetros por defecto en public.configuracion
DO $$
BEGIN
  IF to_regclass('public.configuracion') IS NOT NULL THEN
    INSERT INTO public.configuracion (clave, valor)
    VALUES
      ('combustible_pdf_subtitulo_secundario', 'Documento Oficial Administrativo'),
      ('combustible_pdf_label_firma_solicitante', 'Firma del Solicitante'),
      ('combustible_pdf_label_firma_admin', 'Jefatura de Operaciones'),
      ('combustible_pdf_nombre_jefatura_operaciones', ''),
      ('combustible_pdf_texto_sello_institucional', 'Sello Institucional Oficial'),
      ('combustible_solicitar_vehiculo', 'false'),
      ('combustible_mostrar_vehiculo', 'false'),
      ('combustible_solicitar_placa', 'false'),
      ('combustible_mostrar_placa', 'false'),
      ('combustible_solicitar_galones', 'false'),
      ('combustible_mostrar_galones', 'false'),
      ('combustible_solicitar_tipo_gasolina', 'false'),
      ('combustible_mostrar_tipo_gasolina', 'false'),
      ('combustible_solicitar_cantidad_dinero', 'false'),
      ('combustible_mostrar_cantidad_dinero', 'false')
    ON CONFLICT (clave) DO NOTHING;
  END IF;
END $$;

-- 3. Recargar esquema en PostgREST
NOTIFY pgrst, 'reload schema';
