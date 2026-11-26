-- =========================================================================================
-- MIGRACIÓN 59: MARCA DE AGUA CONFIGURABLE PARA PDF DE SOLICITUDES DE COMBUSTIBLE Y COMPRA
-- Cruz Verde Salvadoreña - Sistema Institucional
-- =========================================================================================
-- Qué asegura esta migración (100% idempotente, NO borra ni sobreescribe datos existentes):
-- 1. Registra las claves por defecto en public.configuracion para la marca de agua de PDF
--    con imagen, opacidad, escala y ubicación (9 posiciones) tanto para Solicitudes de
--    Combustible como para Solicitudes de Compra.
-- 2. Verifica de forma segura que el bucket 'socorristas' (usado para logos y marcas de agua
--    de plantillas en plantillas/watermarks/) permita lectura pública/autenticada y carga
--    autenticada para usuarios del sistema.
-- 3. Recarga la caché de esquema de PostgREST.
-- =========================================================================================

-- 1. Claves de marca de agua PDF en public.configuracion (Combustible y Compra)
DO $$
BEGIN
  IF to_regclass('public.configuracion') IS NOT NULL THEN
    INSERT INTO public.configuracion (clave, valor)
    VALUES
      -- Solicitudes de Combustible
      ('combustible_pdf_watermark', 'true'),
      ('combustible_pdf_watermark_img_url', ''),
      ('combustible_pdf_watermark_text', 'CRUZ VERDE SALVADOREÑA - COMBUSTIBLE'),
      ('combustible_pdf_watermark_opacity', '0.08'),
      ('combustible_pdf_watermark_scale', '45'),
      ('combustible_pdf_watermark_position', 'center'),

      -- Solicitudes de Compra
      ('solicitudes_pdf_watermark', 'false'),
      ('solicitudes_pdf_watermark_img_url', ''),
      ('solicitudes_pdf_watermark_text', 'CRUZ VERDE SALVADOREÑA'),
      ('solicitudes_pdf_watermark_opacity', '0.12'),
      ('solicitudes_pdf_watermark_scale', '45'),
      ('solicitudes_pdf_watermark_position', 'center')
    ON CONFLICT (clave) DO NOTHING;
  END IF;
END $$;

-- 2. Verificar políticas seguras de Storage para marcas de agua de plantillas
--    Se envuelve en manejo de privilegios para no fallar si el rol SQL no es dueño de storage.objects.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('socorristas', 'socorristas', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF to_regclass('storage.objects') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'plantillas_watermarks_public_read'
    ) THEN
      CREATE POLICY "plantillas_watermarks_public_read"
        ON storage.objects
        FOR SELECT
        USING (
          bucket_id = 'socorristas'
          AND (
            name LIKE 'plantillas/watermarks/%'
            OR name LIKE 'logos/%'
          )
        );
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'plantillas_watermarks_auth_insert'
    ) THEN
      CREATE POLICY "plantillas_watermarks_auth_insert"
        ON storage.objects
        FOR INSERT
        TO authenticated
        WITH CHECK (
          bucket_id = 'socorristas'
          AND (
            name LIKE 'plantillas/watermarks/%'
            OR name LIKE 'logos/%'
          )
        );
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'plantillas_watermarks_auth_update'
    ) THEN
      CREATE POLICY "plantillas_watermarks_auth_update"
        ON storage.objects
        FOR UPDATE
        TO authenticated
        USING (
          bucket_id = 'socorristas'
          AND (
            name LIKE 'plantillas/watermarks/%'
            OR name LIKE 'logos/%'
          )
        )
        WITH CHECK (
          bucket_id = 'socorristas'
          AND (
            name LIKE 'plantillas/watermarks/%'
            OR name LIKE 'logos/%'
          )
        );
    END IF;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Storage policies omitidas por permisos del rol SQL; los permisos existentes del bucket socorristas permanecen activos.';
END $$;

-- 3. Recargar esquema de PostgREST
NOTIFY pgrst, 'reload schema';
