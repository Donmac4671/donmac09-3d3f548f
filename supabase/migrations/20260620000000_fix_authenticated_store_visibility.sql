-- Fix 1: Ensure the public storefront view is accessible to all users.
DROP VIEW IF EXISTS public.public_reseller_stores;
CREATE VIEW public.public_reseller_stores
WITH (security_invoker = false) AS
SELECT id, user_id, slug, full_name, whatsapp, store_message, is_active, created_at, updated_at
FROM public.reseller_stores
WHERE is_active = true;
GRANT SELECT ON public.public_reseller_stores TO anon, authenticated;

-- Fix 2: Allow authenticated users to see active stores (critical for pricing subqueries).
DROP POLICY IF EXISTS "Anon can view active stores" ON public.reseller_stores;
DROP POLICY IF EXISTS "Public can view active stores" ON public.reseller_stores;
CREATE POLICY "Public can view active stores"
  ON public.reseller_stores FOR SELECT TO anon, authenticated
  USING (is_active = true);

REVOKE SELECT ON public.reseller_stores FROM anon, authenticated, PUBLIC;
GRANT SELECT (id, user_id, slug, full_name, whatsapp, store_message, is_active, created_at, updated_at)
  ON public.reseller_stores TO anon, authenticated;

-- Fix 3: Robust handle_new_user to prevent registration errors.
-- We use ON CONFLICT (user_id) to handle race conditions with Edge Functions.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, phone, tier)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'tier', NEW.raw_user_meta_data->>'user_type', 'customer')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    tier = EXCLUDED.tier;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  IF NEW.email = 'donmacdatahub@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Fix 4: Robust phone duplication check.
-- Ensures that registration and admin user creation don't clash on phone numbers improperly.
CREATE OR REPLACE FUNCTION public.prevent_duplicate_phone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.phone IS NULL OR length(trim(NEW.phone)) = 0 THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE phone = NEW.phone
      AND user_id <> NEW.user_id
  ) THEN
    RAISE EXCEPTION 'This phone number is already registered to another account.'
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;
