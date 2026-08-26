-- ============================================================
-- Migration v2.4 — Pending approval flow for new users
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add 'pending' to the user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'pending';

-- 2. Update trigger: new users get 'pending' role (except first admin)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NULL),
    CASE WHEN (SELECT count(*) FROM public.profiles) = 0
         THEN 'admin'::user_role
         ELSE 'pending'::user_role END
  );
  RETURN NEW;
END;
$$;

-- 3. Admin notification function: inserts a row into a notifications table
--    (used by realtime subscription — no external email needed for the app layer)
--    The app already listens to profiles INSERT via subscribeToProfiles().
--    This migration just ensures the trigger sets 'pending' correctly.

-- 4. (Optional) View: pending users for quick admin query
CREATE OR REPLACE VIEW public.pending_users AS
  SELECT id, email, display_name, created_at
  FROM public.profiles
  WHERE role = 'pending'
  ORDER BY created_at DESC;
