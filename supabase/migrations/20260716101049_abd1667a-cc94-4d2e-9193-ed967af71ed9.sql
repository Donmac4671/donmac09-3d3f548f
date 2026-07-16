
-- 1. reseller_prices: gate by active store
DROP POLICY IF EXISTS "Anyone can view reseller prices" ON public.reseller_prices;
CREATE POLICY "Anyone can view active reseller prices"
ON public.reseller_prices
FOR SELECT
USING (EXISTS (SELECT 1 FROM public.reseller_stores s WHERE s.id = reseller_prices.store_id AND s.is_active = true));

-- 2. app_settings: restrict to admin only
DROP POLICY IF EXISTS "Authenticated can view settings" ON public.app_settings;

-- 3. Views: set security_invoker so RLS uses the querying user's permissions
ALTER VIEW public.public_reseller_stores SET (security_invoker = true);
ALTER VIEW public.custom_bundles_public SET (security_invoker = true);

-- 4. Functions: pin search_path
ALTER FUNCTION public.set_reseller_id() SET search_path = public;
ALTER FUNCTION public.kill_idle_connections() SET search_path = public;
ALTER FUNCTION public.register_store_referral(text) SET search_path = public;
