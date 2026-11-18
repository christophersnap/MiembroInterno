-- =========================================================================================
-- MIGRACIÓN 47: OPTIMIZACIÓN DE IMÁGENES (SOPORTE WEBP) Y ESTADÍSTICAS REALES DE STORAGE
-- =========================================================================================
-- 1. Asegura que todos los buckets del sistema acepten imágenes optimizadas (image/webp, etc.)
-- 2. Crea tabla public.imagenes_optimizacion_log con RLS para registrar ahorro real de espacio
-- 3. Crea función protegida public.get_storage_images_stats() (SECURITY DEFINER + RBAC)
--    para consultar conteo exacto de imágenes, espacio usado por bucket/carpeta/formato
--    y métricas de ahorro sin exponer vistas públicas.
-- =========================================================================================

-- 1. Asegurar soporte completo de MIME types (incluyendo image/webp) en los buckets existentes
UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id IN ('socorristas', 'assets', 'archivos', 'logos', 'plantillas')
  AND allowed_mime_types IS NOT NULL
  AND NOT ('image/webp' = ANY(allowed_mime_types));

-- 2. Tabla de bitácora de ahorro por optimización de imágenes
CREATE TABLE IF NOT EXISTS public.imagenes_optimizacion_log (
  id BIGSERIAL PRIMARY KEY,
  modulo TEXT NOT NULL DEFAULT 'general',
  bucket_id TEXT,
  ruta_objeto TEXT,
  nombre_original TEXT,
  formato_original TEXT,
  formato_final TEXT,
  bytes_original BIGINT NOT NULL CHECK (bytes_original >= 0),
  bytes_final BIGINT NOT NULL CHECK (bytes_final >= 0),
  bytes_ahorrados BIGINT NOT NULL DEFAULT 0,
  ancho_original INTEGER,
  alto_original INTEGER,
  ancho_final INTEGER,
  alto_final INTEGER,
  fue_optimizada BOOLEAN NOT NULL DEFAULT true,
  subido_por UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imagenes_opt_log_created_at
  ON public.imagenes_optimizacion_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_imagenes_opt_log_modulo
  ON public.imagenes_optimizacion_log (modulo);

ALTER TABLE public.imagenes_optimizacion_log ENABLE ROW LEVEL SECURITY;

-- Función auxiliar interna para validar acceso a Configuración / Administración
CREATE OR REPLACE FUNCTION public.can_view_storage_stats()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := lower(COALESCE(auth.jwt() ->> 'email', ''));
  v_role TEXT;
  v_custom JSONB;
  v_role_perms JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_email = 'christopher.snap@gmail.com' THEN
    RETURN TRUE;
  END IF;

  SELECT ur.role, COALESCE(ur.custom_permissions, '{}'::jsonb)
  INTO v_role, v_custom
  FROM public.user_roles ur
  WHERE ur.id = v_uid
    AND COALESCE(ur.activo, true) = true
  LIMIT 1;

  IF v_role IN ('admin', 'superadmin') THEN
    RETURN TRUE;
  END IF;

  IF (v_custom ->> 'view_configuracion') = 'true'
     OR (v_custom ->> 'perm_configuracion') = 'true'
     OR (v_custom ->> 'view_accesos') = 'true'
     OR (v_custom ->> 'perm_accesos') = 'true' THEN
    RETURN TRUE;
  END IF;

  IF v_role IS NOT NULL THEN
    SELECT COALESCE(rp.permissions, '{}'::jsonb)
    INTO v_role_perms
    FROM public.role_permissions rp
    WHERE rp.role = v_role
    LIMIT 1;

    IF (v_role_perms ->> 'view_configuracion') = 'true'
       OR (v_role_perms ->> 'view_accesos') = 'true' THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.can_view_storage_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_storage_stats() TO authenticated;

-- Políticas RLS sobre imagenes_optimizacion_log
DROP POLICY IF EXISTS "Permitir registrar metricas de optimizacion" ON public.imagenes_optimizacion_log;
CREATE POLICY "Permitir registrar metricas de optimizacion"
  ON public.imagenes_optimizacion_log
  FOR INSERT
  WITH CHECK (bytes_original >= 0 AND bytes_final >= 0);

DROP POLICY IF EXISTS "Admins consultan metricas de optimizacion" ON public.imagenes_optimizacion_log;
CREATE POLICY "Admins consultan metricas de optimizacion"
  ON public.imagenes_optimizacion_log
  FOR SELECT
  TO authenticated
  USING (public.can_view_storage_stats());

GRANT INSERT ON public.imagenes_optimizacion_log TO anon, authenticated;
GRANT SELECT ON public.imagenes_optimizacion_log TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.imagenes_optimizacion_log_id_seq TO anon, authenticated;

-- 3. Configuración inicial por defecto en tabla public.configuracion (si no existe)
INSERT INTO public.configuracion (clave, valor)
SELECT
  'optimizacion_imagenes_config',
  '{"enabled":true,"preset":"visually_lossless","preferWebp":true,"stripMetadata":true,"carnetQuality":0.94,"carnetMaxDim":1600,"templateQuality":0.95,"templateMaxDim":2600,"bannerQuality":0.90,"bannerMaxDim":2200,"generalQuality":0.90,"generalMaxDim":2000,"logoQuality":0.94,"logoMaxDim":1200}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.configuracion WHERE clave = 'optimizacion_imagenes_config'
);

-- 4. Función RPC protegida para obtener inventario y espacio exacto de imágenes en Supabase Storage
CREATE OR REPLACE FUNCTION public.get_storage_images_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, auth
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.can_view_storage_stats() THEN
    RAISE EXCEPTION 'Acceso denegado: no cuenta con permisos para consultar estadísticas de almacenamiento.';
  END IF;

  WITH parsed_objects AS (
    SELECT
      o.id,
      o.bucket_id::text AS bucket_id,
      o.name::text AS name,
      COALESCE(
        NULLIF(o.metadata ->> 'mimetype', ''),
        NULLIF(o.metadata ->> 'contentType', ''),
        CASE
          WHEN lower(o.name) ~ '\.(webp)$' THEN 'image/webp'
          WHEN lower(o.name) ~ '\.(jpg|jpeg)$' THEN 'image/jpeg'
          WHEN lower(o.name) ~ '\.(png)$' THEN 'image/png'
          WHEN lower(o.name) ~ '\.(svg)$' THEN 'image/svg+xml'
          WHEN lower(o.name) ~ '\.(gif)$' THEN 'image/gif'
          WHEN lower(o.name) ~ '\.(avif)$' THEN 'image/avif'
          WHEN lower(o.name) ~ '\.(heic|heif)$' THEN 'image/heic'
          WHEN lower(o.name) ~ '\.(pdf)$' THEN 'application/pdf'
          ELSE 'application/octet-stream'
        END
      ) AS mimetype,
      COALESCE(
        NULLIF(regexp_replace(COALESCE(o.metadata ->> 'size', '0'), '[^0-9]', '', 'g'), '')::bigint,
        0
      ) AS size_bytes,
      CASE
        WHEN position('/' IN o.name) > 0 THEN split_part(o.name, '/', 1)
        ELSE 'carnets_y_perfiles'
      END AS folder_key,
      o.created_at,
      o.updated_at
    FROM storage.objects o
    WHERE o.name IS NOT NULL
      AND o.name NOT LIKE '%/.emptyFolderPlaceholder'
      AND o.name <> '.emptyFolderPlaceholder'
  ),
  classified AS (
    SELECT
      p.*,
      (
        p.mimetype LIKE 'image/%'
        OR lower(p.name) ~ '\.(webp|jpg|jpeg|png|svg|gif|avif|bmp|heic|heif)$'
      ) AS is_image,
      CASE
        WHEN p.mimetype = 'image/webp' OR lower(p.name) ~ '\.webp$' THEN 'WebP'
        WHEN p.mimetype = 'image/jpeg' OR lower(p.name) ~ '\.(jpg|jpeg)$' THEN 'JPEG'
        WHEN p.mimetype = 'image/png' OR lower(p.name) ~ '\.png$' THEN 'PNG'
        WHEN p.mimetype = 'image/svg+xml' OR lower(p.name) ~ '\.svg$' THEN 'SVG'
        WHEN p.mimetype LIKE 'image/%' THEN 'Otros (GIF/HEIC)'
        ELSE 'Otros archivos'
      END AS format_label
    FROM parsed_objects p
  ),
  totals AS (
    SELECT
      COUNT(*) FILTER (WHERE is_image)::bigint AS total_images,
      COALESCE(SUM(size_bytes) FILTER (WHERE is_image), 0)::bigint AS total_image_bytes,
      COUNT(*) FILTER (WHERE NOT is_image)::bigint AS other_files_count,
      COALESCE(SUM(size_bytes) FILTER (WHERE NOT is_image), 0)::bigint AS other_files_bytes,
      COALESCE(AVG(size_bytes) FILTER (WHERE is_image), 0)::bigint AS avg_image_bytes
    FROM classified
  ),
  by_bucket AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'bucket_id', bucket_id,
          'image_count', image_count,
          'image_bytes', image_bytes,
          'other_count', other_count,
          'other_bytes', other_bytes
        )
        ORDER BY image_bytes DESC
      ),
      '[]'::jsonb
    ) AS items
    FROM (
      SELECT
        bucket_id,
        COUNT(*) FILTER (WHERE is_image)::bigint AS image_count,
        COALESCE(SUM(size_bytes) FILTER (WHERE is_image), 0)::bigint AS image_bytes,
        COUNT(*) FILTER (WHERE NOT is_image)::bigint AS other_count,
        COALESCE(SUM(size_bytes) FILTER (WHERE NOT is_image), 0)::bigint AS other_bytes
      FROM classified
      GROUP BY bucket_id
    ) b
  ),
  by_folder AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'folder', folder_key,
          'image_count', image_count,
          'image_bytes', image_bytes
        )
        ORDER BY image_bytes DESC
      ),
      '[]'::jsonb
    ) AS items
    FROM (
      SELECT
        folder_key,
        COUNT(*)::bigint AS image_count,
        COALESCE(SUM(size_bytes), 0)::bigint AS image_bytes
      FROM classified
      WHERE is_image
      GROUP BY folder_key
    ) f
  ),
  by_format AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'format', format_label,
          'count', cnt,
          'bytes', total_b,
          'avg_bytes', avg_b
        )
        ORDER BY total_b DESC
      ),
      '[]'::jsonb
    ) AS items
    FROM (
      SELECT
        format_label,
        COUNT(*)::bigint AS cnt,
        COALESCE(SUM(size_bytes), 0)::bigint AS total_b,
        COALESCE(AVG(size_bytes), 0)::bigint AS avg_b
      FROM classified
      WHERE is_image
      GROUP BY format_label
    ) fmt
  ),
  largest_imgs AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'bucket_id', bucket_id,
          'name', name,
          'folder', folder_key,
          'format', format_label,
          'mimetype', mimetype,
          'size_bytes', size_bytes,
          'created_at', created_at
        )
      ),
      '[]'::jsonb
    ) AS items
    FROM (
      SELECT bucket_id, name, folder_key, format_label, mimetype, size_bytes, created_at
      FROM classified
      WHERE is_image
      ORDER BY size_bytes DESC, created_at DESC
      LIMIT 20
    ) l
  ),
  recent_imgs AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'bucket_id', bucket_id,
          'name', name,
          'folder', folder_key,
          'format', format_label,
          'mimetype', mimetype,
          'size_bytes', size_bytes,
          'created_at', created_at
        )
      ),
      '[]'::jsonb
    ) AS items
    FROM (
      SELECT bucket_id, name, folder_key, format_label, mimetype, size_bytes, created_at
      FROM classified
      WHERE is_image
      ORDER BY created_at DESC NULLS LAST
      LIMIT 20
    ) r
  ),
  opt_stats AS (
    SELECT
      COUNT(*)::bigint AS total_processed,
      COUNT(*) FILTER (WHERE fue_optimizada)::bigint AS optimized_count,
      COALESCE(SUM(bytes_original), 0)::bigint AS total_original_bytes,
      COALESCE(SUM(bytes_final), 0)::bigint AS total_final_bytes,
      COALESCE(SUM(bytes_ahorrados), 0)::bigint AS total_saved_bytes
    FROM public.imagenes_optimizacion_log
  )
  SELECT jsonb_build_object(
    'source', 'sql_rpc',
    'total_images', t.total_images,
    'total_image_bytes', t.total_image_bytes,
    'avg_image_bytes', t.avg_image_bytes,
    'other_files_count', t.other_files_count,
    'other_files_bytes', t.other_files_bytes,
    'by_bucket', bb.items,
    'by_folder', bf.items,
    'by_format', bfmt.items,
    'largest_images', li.items,
    'recent_images', ri.items,
    'optimization_log', jsonb_build_object(
      'total_processed', os.total_processed,
      'optimized_count', os.optimized_count,
      'total_original_bytes', os.total_original_bytes,
      'total_final_bytes', os.total_final_bytes,
      'total_saved_bytes', os.total_saved_bytes
    )
  )
  INTO v_result
  FROM totals t
  CROSS JOIN by_bucket bb
  CROSS JOIN by_folder bf
  CROSS JOIN by_format bfmt
  CROSS JOIN largest_imgs li
  CROSS JOIN recent_imgs ri
  CROSS JOIN opt_stats os;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_storage_images_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_storage_images_stats() TO authenticated;

NOTIFY pgrst, 'reload schema';
