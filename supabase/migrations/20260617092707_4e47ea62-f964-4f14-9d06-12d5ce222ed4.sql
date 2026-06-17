-- Prevent admins and resellers from being attributed as referred customers.
CREATE OR REPLACE FUNCTION public.register_store_referral(p_slug text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store_id uuid; v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_slug IS NULL OR length(trim(p_slug)) = 0 THEN RETURN; END IF;

  -- Skip admins
  IF public.has_role(v_uid, 'admin'::app_role) THEN RETURN; END IF;
  -- Skip resellers (store owners should never be branded as someone else's referred customer)
  IF EXISTS (SELECT 1 FROM public.reseller_stores WHERE user_id = v_uid) THEN RETURN; END IF;

  SELECT id INTO v_store_id FROM public.reseller_stores WHERE slug = lower(trim(p_slug)) AND is_active = true;
  IF v_store_id IS NULL THEN RETURN; END IF;
  -- Don't let a reseller's own store refer themselves
  IF EXISTS (SELECT 1 FROM public.reseller_stores WHERE id = v_store_id AND user_id = v_uid) THEN RETURN; END IF;

  INSERT INTO public.store_referrals (user_id, store_id) VALUES (v_uid, v_store_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- Clean up bad attributions: remove any store_referrals where the user is an admin or owns a reseller store.
DELETE FROM public.store_referrals sr
WHERE public.has_role(sr.user_id, 'admin'::app_role)
   OR EXISTS (SELECT 1 FROM public.reseller_stores rs WHERE rs.user_id = sr.user_id);