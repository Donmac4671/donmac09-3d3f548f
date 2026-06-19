CREATE OR REPLACE FUNCTION public.admin_create_store(
  p_user_id uuid,
  p_slug text,
  p_full_name text,
  p_whatsapp text,
  p_store_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_store_id uuid;
  v_clean_slug text;
  v_profile_exists boolean := false;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User is required';
  END IF;

  v_clean_slug := lower(regexp_replace(coalesce(p_slug, ''), '[^a-z0-9-]+', '-', 'g'));
  v_clean_slug := regexp_replace(v_clean_slug, '(^-+|-+$)', '', 'g');

  IF length(v_clean_slug) < 3 OR length(v_clean_slug) > 30 THEN
    RAISE EXCEPTION 'Slug must be 3-30 characters (letters, numbers, hyphens)';
  END IF;

  IF length(trim(coalesce(p_full_name, ''))) = 0 THEN
    RAISE EXCEPTION 'Store name is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.reseller_stores
    WHERE slug = v_clean_slug
      AND user_id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'That slug is taken, pick another';
  END IF;

  UPDATE public.profiles
     SET tier = 'reseller',
         full_name = COALESCE(NULLIF(trim(p_full_name), ''), full_name),
         phone = COALESCE(NULLIF(trim(p_whatsapp), ''), phone),
         updated_at = now()
   WHERE user_id = p_user_id
   RETURNING true INTO v_profile_exists;

  IF NOT COALESCE(v_profile_exists, false) THEN
    RAISE EXCEPTION 'User profile not found. Ask the user to sign in once, then try again.';
  END IF;

  INSERT INTO public.reseller_stores (
    user_id,
    slug,
    full_name,
    whatsapp,
    store_message,
    is_active,
    available_profit,
    lifetime_profit
  ) VALUES (
    p_user_id,
    v_clean_slug,
    trim(p_full_name),
    trim(coalesce(p_whatsapp, '')),
    trim(coalesce(p_store_message, '')),
    true,
    0,
    0
  )
  ON CONFLICT (user_id) DO UPDATE SET
    slug = EXCLUDED.slug,
    full_name = EXCLUDED.full_name,
    whatsapp = EXCLUDED.whatsapp,
    store_message = EXCLUDED.store_message,
    is_active = true,
    updated_at = now()
  RETURNING id INTO v_store_id;

  RETURN jsonb_build_object('success', true, 'store_id', v_store_id, 'slug', v_clean_slug);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_store(uuid,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_store(uuid,text,text,text,text) TO service_role;