-- Drop existing constraint if it exists (name might vary, let's find it or use a script to figure it out, but usually it's socorrista_cursos_curso_id_fkey)
ALTER TABLE public.socorrista_cursos DROP CONSTRAINT IF EXISTS socorrista_cursos_curso_id_fkey;
ALTER TABLE public.socorrista_cursos ADD CONSTRAINT socorrista_cursos_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE CASCADE;

ALTER TABLE public.socorrista_cursos DROP CONSTRAINT IF EXISTS socorrista_cursos_socorrista_id_fkey;
ALTER TABLE public.socorrista_cursos ADD CONSTRAINT socorrista_cursos_socorrista_id_fkey FOREIGN KEY (socorrista_id) REFERENCES public.socorristas(id) ON DELETE CASCADE;
