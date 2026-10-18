-- 1. Ensure foreign keys for socorrista_cursos cascade so that deleting a course cleans up related records automatically
ALTER TABLE public.socorrista_cursos DROP CONSTRAINT IF EXISTS socorrista_cursos_curso_id_fkey;
ALTER TABLE public.socorrista_cursos ADD CONSTRAINT socorrista_cursos_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE CASCADE;

ALTER TABLE public.socorrista_cursos DROP CONSTRAINT IF EXISTS socorrista_cursos_socorrista_id_fkey;
ALTER TABLE public.socorrista_cursos ADD CONSTRAINT socorrista_cursos_socorrista_id_fkey FOREIGN KEY (socorrista_id) REFERENCES public.socorristas(id) ON DELETE CASCADE;

-- 2. Update is_admin function to avoid recursion and be robust
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Consider as admin if explicitly marked in user_roles
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- 3. We allow admins or instructors to manage courses
CREATE OR REPLACE FUNCTION public.can_manage_cursos()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role IN ('admin', 'instructor', 'director')
  );
END;
$$;

-- 4. Apply policies using the new function
DROP POLICY IF EXISTS "Admins can manage cursos" ON public.cursos;
DROP POLICY IF EXISTS "Admins and Instructors can manage cursos" ON public.cursos;
CREATE POLICY "Admins and Instructors can manage cursos" ON public.cursos FOR ALL USING (public.can_manage_cursos() OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com');

DROP POLICY IF EXISTS "Admins can manage socorrista_cursos" ON public.socorrista_cursos;
DROP POLICY IF EXISTS "Admins and Instructors can manage socorrista_cursos" ON public.socorrista_cursos;
CREATE POLICY "Admins and Instructors can manage socorrista_cursos" ON public.socorrista_cursos FOR ALL USING (public.can_manage_cursos() OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com');

-- 5. Fix user_roles so that we can insert the superadmin via frontend if needed
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
CREATE POLICY "Admins can manage user roles" ON public.user_roles FOR ALL USING (public.is_admin() OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com');

-- 6. Insert superadmin role explicitly to prevent blocked policies
INSERT INTO public.user_roles (id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'christopher.snap@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';
