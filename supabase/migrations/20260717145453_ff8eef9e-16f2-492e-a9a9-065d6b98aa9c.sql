
-- 1) anon_promo_window: tighten anon SELECT policy on promotions to match window
DROP POLICY IF EXISTS "Public can view active promotions" ON public.promotions;
CREATE POLICY "Public can view active promotions"
  ON public.promotions
  FOR SELECT
  TO anon
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (expires_at IS NULL OR expires_at > now())
  );

-- 2) cost_price_agent_leak: restrict base table SELECT to admin only; agents use custom_bundles_public view
DROP POLICY IF EXISTS "Admin and agents can view custom bundles" ON public.custom_bundles;
CREATE POLICY "Admins can view custom bundles"
  ON public.custom_bundles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) SUPA_anon_security_definer_function_executable: revoke anon EXECUTE on pay_with_wallet
REVOKE EXECUTE ON FUNCTION public.pay_with_wallet(text, text, text, numeric, uuid, numeric) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pay_with_wallet(text, text, text, numeric, uuid, numeric, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_with_wallet(text, text, text, numeric, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_with_wallet(text, text, text, numeric, uuid, numeric, text) TO authenticated;
