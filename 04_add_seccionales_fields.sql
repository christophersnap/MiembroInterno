DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='seccionales' AND column_name='departamento') THEN
        ALTER TABLE public.seccionales ADD COLUMN departamento TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='seccionales' AND column_name='zona') THEN
        ALTER TABLE public.seccionales ADD COLUMN zona TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='seccionales' AND column_name='google_maps_url') THEN
        ALTER TABLE public.seccionales ADD COLUMN google_maps_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='seccionales' AND column_name='waze_url') THEN
        ALTER TABLE public.seccionales ADD COLUMN waze_url TEXT;
    END IF;
END $$;
