-- =========================================================================
-- MIGRACIÓN 26: PERMISOS DISTINTIVOS DE ANUNCIOS, FORMULARIOS Y COLORES
-- Cruz Verde Salvadoreña - Sistema Institucional
-- =========================================================================

-- 1. Actualizar permisos para el rol Administrador (Acceso total)
UPDATE public.role_permissions
SET permissions = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(permissions, '{}'::jsonb),
          '{view_anuncios}', 'true'::jsonb, true
        ),
        '{crear_anuncios}', 'true'::jsonb, true
      ),
      '{view_formularios}', 'true'::jsonb, true
    ),
    '{crear_formularios}', 'true'::jsonb, true
  ),
  '{personalizar_colores}', 'true'::jsonb, true
)
WHERE role = 'admin';

-- 2. Actualizar permisos para roles operativos (Socorrista, Director, Instructor, Administrativo)
-- Por defecto: Pueden VER anuncios y formularios, pero CREAR anuncios/formularios y personalizar colores requiere permiso administrativo o excepción individual
UPDATE public.role_permissions
SET permissions = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(permissions, '{}'::jsonb),
          '{view_anuncios}', 'true'::jsonb, true
        ),
        '{crear_anuncios}', 'false'::jsonb, true
      ),
      '{view_formularios}', 'true'::jsonb, true
    ),
    '{crear_formularios}', 'false'::jsonb, true
  ),
  '{personalizar_colores}', 'false'::jsonb, true
)
WHERE role IN ('socorrista', 'director', 'instructor', 'administrativo');

-- 3. Si no existían registros en role_permissions, crearlos
INSERT INTO public.role_permissions (role, permissions)
VALUES 
  ('admin', '{"view_anuncios": true, "crear_anuncios": true, "view_formularios": true, "crear_formularios": true, "personalizar_colores": true}'::jsonb),
  ('director', '{"view_anuncios": true, "crear_anuncios": false, "view_formularios": true, "crear_formularios": false, "personalizar_colores": false}'::jsonb),
  ('instructor', '{"view_anuncios": true, "crear_anuncios": false, "view_formularios": true, "crear_formularios": false, "personalizar_colores": false}'::jsonb),
  ('socorrista', '{"view_anuncios": true, "crear_anuncios": false, "view_formularios": true, "crear_formularios": false, "personalizar_colores": false}'::jsonb)
ON CONFLICT (role) DO NOTHING;
