
-- Remove auto-admin grant based on email in handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tier text;
BEGIN
  v_tier := COALESCE(
    NEW.raw_user_meta_data->>'tier',
    NEW.raw_user_meta_data->>'user_type',
    'customer'
  );

  INSERT INTO public.profiles (id, user_id, full_name, email, phone, tier)
  VALUES (
    NEW.id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_tier
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    tier = EXCLUDED.tier,
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- Block reserved names/emails on profiles insert/update
CREATE OR REPLACE FUNCTION public.block_reserved_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name_lower text := lower(coalesce(NEW.full_name, ''));
  v_email_lower text := lower(coalesce(NEW.email, ''));
  v_is_admin boolean := false;
BEGIN
  -- Allow admins (and existing admin rows) through
  IF NEW.user_id IS NOT NULL THEN
    SELECT public.has_role(NEW.user_id, 'admin'::public.app_role) INTO v_is_admin;
  END IF;
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Block "admin" appearing as a word in full name (e.g. "Admin", "Admin John", "Site Admin")
  IF v_name_lower ~ '(^|[^a-z])admin([^a-z]|$)' THEN
    RAISE EXCEPTION 'The name "Admin" is reserved and cannot be used.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Block emails containing "admin" or "donmacdatahub"
  IF v_email_lower LIKE '%admin%' OR v_email_lower LIKE '%donmacdatahub%' THEN
    RAISE EXCEPTION 'This email address is reserved and cannot be used to register.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS block_reserved_identity_trigger ON public.profiles;
CREATE TRIGGER block_reserved_identity_trigger
BEFORE INSERT OR UPDATE OF full_name, email ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.block_reserved_identity();
