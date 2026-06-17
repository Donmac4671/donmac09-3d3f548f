-- 1) reseller_bundle_prices: gate public SELECT to prices belonging to active stores
DROP POLICY IF EXISTS "Public can view store prices" ON public.reseller_bundle_prices;
CREATE POLICY "Public can view store prices"
  ON public.reseller_bundle_prices
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reseller_stores s
      WHERE s.id = reseller_bundle_prices.store_id
        AND s.is_active = true
    )
  );

-- 2) reseller_stores: restrict the public-active-stores read policy to anon only
--    (authenticated users use "Owner can view own store" / "Admin can view all stores",
--    and admin/owner profit access goes through the dedicated SECURITY DEFINER RPCs).
DROP POLICY IF EXISTS "Public can view active stores" ON public.reseller_stores;
DROP POLICY IF EXISTS "Anon can view active stores" ON public.reseller_stores;
CREATE POLICY "Anon can view active stores"
  ON public.reseller_stores
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Defense-in-depth: ensure profit columns are never SELECTable directly.
REVOKE SELECT (available_profit, lifetime_profit) ON public.reseller_stores FROM anon;
REVOKE SELECT (available_profit, lifetime_profit) ON public.reseller_stores FROM authenticated;
REVOKE SELECT (available_profit, lifetime_profit) ON public.reseller_stores FROM PUBLIC;
-- Re-grant SELECT on the safe (non-profit) columns to keep anon/authenticated reads working.
GRANT SELECT (id, user_id, slug, full_name, whatsapp, store_message, is_active, created_at, updated_at)
  ON public.reseller_stores TO anon, authenticated;

-- 3) users table: add explicit self-read policy and lock down broad table grants.
CREATE POLICY "Users can view own row"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

REVOKE ALL ON public.users FROM anon;
GRANT SELECT ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;