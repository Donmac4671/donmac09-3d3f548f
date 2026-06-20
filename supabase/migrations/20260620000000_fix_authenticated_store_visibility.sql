-- Fix: Ensure the public storefront view is accessible to all users.
-- We use security_invoker = false (default) so the view bypasses RLS on the underlying table.
-- This ensures that both guests and logged-in customers can always find the store.
-- The view itself is safe because it only selects non-sensitive columns and filters for is_active = true.

DROP VIEW IF EXISTS public.public_reseller_stores;

CREATE VIEW public.public_reseller_stores
WITH (security_invoker = false) AS
SELECT
  id,
  user_id,
  slug,
  full_name,
  whatsapp,
  store_message,
  is_active,
  created_at,
  updated_at
FROM public.reseller_stores
WHERE is_active = true;

-- Grant select access to everyone
GRANT SELECT ON public.public_reseller_stores TO anon, authenticated;

-- Also fix the underlying table RLS for 'authenticated' users.
-- This is critical for dependent policies (like prices and markups) that use
-- EXISTS(SELECT 1 FROM reseller_stores ...) in their USING clauses.
DROP POLICY IF EXISTS "Anon can view active stores" ON public.reseller_stores;
DROP POLICY IF EXISTS "Public can view active stores" ON public.reseller_stores;

CREATE POLICY "Public can view active stores"
  ON public.reseller_stores
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Re-verify column-level security on the underlying table.
-- Profit columns are kept private, while public columns are granted to everyone.
REVOKE SELECT ON public.reseller_stores FROM anon, authenticated, PUBLIC;
GRANT SELECT (id, user_id, slug, full_name, whatsapp, store_message, is_active, created_at, updated_at)
  ON public.reseller_stores TO anon, authenticated;
