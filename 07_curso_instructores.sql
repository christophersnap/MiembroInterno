-- Table for instructors of a course
CREATE TABLE IF NOT EXISTS public.curso_instructores (
  id SERIAL PRIMARY KEY,
  curso_id INTEGER REFERENCES public.cursos(id) ON DELETE CASCADE,
  socorrista_id INTEGER REFERENCES public.socorristas(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.curso_instructores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read curso_instructores" ON public.curso_instructores;
CREATE POLICY "Authenticated users can read curso_instructores" ON public.curso_instructores FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins and Instructors can manage curso_instructores" ON public.curso_instructores;
CREATE POLICY "Admins and Instructors can manage curso_instructores" ON public.curso_instructores FOR ALL USING (public.can_manage_cursos() OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com');
