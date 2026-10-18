-- =========================================================================
-- MIGRACIÓN 22: PERMISOS INDIVIDUALES POR USUARIO Y VERIFICACIÓN DE CARNET
-- Cruz Verde Salvadoreña - Sistema Institucional
-- =========================================================================

-- 1. Agregar columna custom_permissions a user_roles si no existe
ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS custom_permissions JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.user_roles.custom_permissions IS 'Permisos y excepciones individuales para cada usuario del sistema, que sobreescriben la configuración de su rol';

-- 2. Asegurar que la columna carnet_generado_url exista en socorristas
ALTER TABLE public.socorristas
  ADD COLUMN IF NOT EXISTS carnet_generado_url TEXT;

COMMENT ON COLUMN public.socorristas.carnet_generado_url IS 'URL pública del carnet digital generado en Supabase Storage';

-- 3. Asegurar que las políticas RLS permitan a los administradores actualizar user_roles
-- y a los usuarios autenticados consultar sus propios permisos individuales
DO $$
BEGIN
  -- Política para permitir que administradores actualicen user_roles (incluyendo custom_permissions)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_roles' AND policyname = 'Admins can update user_roles custom_permissions'
  ) THEN
    CREATE POLICY "Admins can update user_roles custom_permissions" 
      ON public.user_roles 
      FOR UPDATE 
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur 
          WHERE ur.id = auth.uid() AND ur.role = 'admin'
        ) 
        OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
      );
  END IF;

  -- Política para permitir que cada usuario autenticado consulte su propio rol y custom_permissions
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_roles' AND policyname = 'Users can view their own role and permissions'
  ) THEN
    CREATE POLICY "Users can view their own role and permissions"
      ON public.user_roles
      FOR SELECT
      USING (
        auth.uid() = id
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur 
          WHERE ur.id = auth.uid() AND ur.role = 'admin'
        )
        OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
      );
  END IF;
END $$;
