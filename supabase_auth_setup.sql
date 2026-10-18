-- Supabase Auth Setup and Roles

-- 1. Create the user_roles table to link auth.users with their roles and socorrista profiles
CREATE TABLE public.user_roles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'socorrista')),
  socorrista_id INTEGER REFERENCES public.socorristas(id) ON DELETE SET NULL,
  requires_password_reset BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS) on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Create policies for user_roles
-- Admins can read all roles
CREATE POLICY "Admins can view all user roles"
  ON public.user_roles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can read their own role
CREATE POLICY "Users can view their own role"
  ON public.user_roles
  FOR SELECT
  USING (id = auth.uid());

-- Only admins can insert/update/delete roles
CREATE POLICY "Admins can manage user roles"
  ON public.user_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 4. Update RLS policies on other tables based on roles

-- Example for socorristas table:
-- Admins can do everything
CREATE POLICY "Admins have full access to socorristas"
  ON public.socorristas
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Socorristas can only view their own profile
CREATE POLICY "Socorristas can view their own profile"
  ON public.socorristas
  FOR SELECT
  USING (
    id = (
      SELECT socorrista_id FROM public.user_roles
      WHERE id = auth.uid() AND role = 'socorrista'
    )
  );

-- Socorristas can update their own profile (but we will restrict specific fields in the UI)
CREATE POLICY "Socorristas can update their own profile"
  ON public.socorristas
  FOR UPDATE
  USING (
    id = (
      SELECT socorrista_id FROM public.user_roles
      WHERE id = auth.uid() AND role = 'socorrista'
    )
  );

-- Note: You will need to apply similar policies to other tables (cursos, seccionales, etc.)
-- to restrict access to 'admin' role only.

-- 5. Function to automatically create a user_role when a new user signs up (Optional, but recommended for admins)
-- You might want to manually assign roles or use a trigger.
-- For this app, it's safer to have an admin manually create the user and assign the role in Supabase dashboard.

-- INSTRUCTIONS TO CREATE AN ADMIN USER:
-- 1. Go to Authentication -> Users in Supabase Dashboard.
-- 2. Click "Add user" -> "Create new user".
-- 3. Enter an email and password.
-- 4. Copy the generated User UID.
-- 5. Go to Table Editor -> user_roles.
-- 6. Insert a new row:
--    - id: [Paste the User UID]
--    - role: 'admin'
--    - socorrista_id: NULL
