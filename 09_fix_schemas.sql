-- Add missing columns to user_roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS requires_password_reset BOOLEAN DEFAULT false;

-- Add missing columns to seccionales
ALTER TABLE public.seccionales ADD COLUMN IF NOT EXISTS departamento TEXT;
ALTER TABLE public.seccionales ADD COLUMN IF NOT EXISTS zona TEXT;
ALTER TABLE public.seccionales ADD COLUMN IF NOT EXISTS google_maps_url TEXT;
ALTER TABLE public.seccionales ADD COLUMN IF NOT EXISTS waze_url TEXT;
ALTER TABLE public.seccionales ADD COLUMN IF NOT EXISTS director_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Notifying PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
