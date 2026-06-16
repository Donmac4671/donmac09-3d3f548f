
-- 1. Add status to hidden_bundles (hidden = removed from view; offline = visible but greyed/disabled)
ALTER TABLE public.hidden_bundles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'hidden'
  CHECK (status IN ('hidden','offline'));

-- 2. Self-service reseller store creation
CREATE OR REPLACE FUNCTION public.create_my_store(
  p_slug text,
  p_full_name text,
  p_whatsapp text,
  p_store_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tier text;
  v_existing uuid;
  v_clean_slug text;
  v_store_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT tier INTO v_tier FROM public.profiles WHERE user_id = v_user_id;
  IF v_tier <> 'reseller' THEN
    RAISE EXCEPTION 'Only resellers can create a store';
  END IF;

  v_clean_slug := lower(regexp_replace(coalesce(p_slug,''), '[^a-z0-9-]+', '-', 'g'));
  v_clean_slug := regexp_replace(v_clean_slug, '(^-+|-+$)', '', 'g');

  IF length(v_clean_slug) < 3 OR length(v_clean_slug) > 40 THEN
    RAISE EXCEPTION 'Slug must be 3-40 characters (letters, numbers, hyphens)';
  END IF;

  IF EXISTS (SELECT 1 FROM public.reseller_stores WHERE slug = v_clean_slug AND user_id <> v_user_id) THEN
    RAISE EXCEPTION 'That slug is taken, pick another';
  END IF;

  SELECT id INTO v_existing FROM public.reseller_stores WHERE user_id = v_user_id;

  IF v_existing IS NULL THEN
    INSERT INTO public.reseller_stores (user_id, slug, full_name, whatsapp, store_message, is_active, available_profit, lifetime_profit)
    VALUES (v_user_id, v_clean_slug, p_full_name, p_whatsapp, p_store_message, true, 0, 0)
    RETURNING id INTO v_store_id;
  ELSE
    UPDATE public.reseller_stores
       SET slug = v_clean_slug,
           full_name = p_full_name,
           whatsapp = p_whatsapp,
           store_message = p_store_message,
           is_active = true,
           updated_at = now()
     WHERE id = v_existing
    RETURNING id INTO v_store_id;
  END IF;

  RETURN v_store_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_my_store(text,text,text,text) TO authenticated;
