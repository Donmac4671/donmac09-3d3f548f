
-- 1) reseller_stores: stop exposing profit to all authenticated users.
DROP POLICY IF EXISTS "Public can view active stores" ON public.reseller_stores;

-- Anonymous storefront browsers can still see active stores (no auth = no profit columns risk anyway,
-- but we also keep them out via the public view below).
CREATE POLICY "Anon can view active stores"
  ON public.reseller_stores FOR SELECT
  TO anon
  USING (is_active = true);

-- Authenticated users access public store data via the public_reseller_stores view (no profit columns).
-- Convert view to SECURITY DEFINER so authenticated users can browse storefronts without
-- a broad table-level SELECT policy.
ALTER VIEW public.public_reseller_stores SET (security_invoker = false);
GRANT SELECT ON public.public_reseller_stores TO anon, authenticated;

-- 2) broadcasts: only resellers can see reseller-audience broadcasts.
DROP POLICY IF EXISTS "Users can view broadcasts for their audience" ON public.broadcasts;
CREATE POLICY "Users can view broadcasts for their audience"
  ON public.broadcasts FOR SELECT
  TO authenticated
  USING (
    audience = 'all'
    OR (audience = 'reseller' AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.tier = 'reseller'
    ))
    OR (audience = 'admin' AND public.has_role(auth.uid(), 'admin'))
  );

-- 3) reseller_markups: restrict public read to markups belonging to active stores only.
DROP POLICY IF EXISTS "Public can view markups" ON public.reseller_markups;
CREATE POLICY "Public can view markups for active stores"
  ON public.reseller_markups FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.reseller_stores s
    WHERE s.id = reseller_markups.store_id AND s.is_active = true
  ));
