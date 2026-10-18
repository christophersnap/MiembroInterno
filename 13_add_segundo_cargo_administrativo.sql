-- Migration: Agregar columna segundo_cargo_administrativo en tabla socorristas
-- Permite asignar "Director de Seccional" o "Subdirector de Seccional" con cupo único por seccional

ALTER TABLE public.socorristas
ADD COLUMN IF NOT EXISTS segundo_cargo_administrativo TEXT;

COMMENT ON COLUMN public.socorristas.segundo_cargo_administrativo IS 'Segundo cargo administrativo (Director de Seccional o Subdirector de Seccional, con restricción de un cupo por seccional)';

-- Opcional: Índice único parcial para garantizar a nivel de base de datos que solo exista 1 Director o Subdirector activo por seccional
CREATE UNIQUE INDEX IF NOT EXISTS uq_socorristas_seccional_segundo_cargo 
ON public.socorristas (seccional_id, segundo_cargo_administrativo)
WHERE segundo_cargo_administrativo IS NOT NULL 
  AND segundo_cargo_administrativo <> '' 
  AND estado = 'Activo';

-- Recargar caché de esquema de PostgREST en Supabase (evita error PGRST204)
NOTIFY pgrst, 'reload schema';

