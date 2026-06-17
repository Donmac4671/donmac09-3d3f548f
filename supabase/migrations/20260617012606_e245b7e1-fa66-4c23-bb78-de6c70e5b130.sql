
-- Recreate view with security_invoker so it does not bypass RLS
DROP VIEW IF EXISTS public.public_reseller_stores;
CREATE VIEW public.public_reseller_stores
WITH (security_invoker = true) AS
SELECT id, user_id, slug, full_name, whatsapp, store_message, is_active, created_at, updated_at
FROM public.reseller_stores
WHERE is_active = true;
GRANT SELECT ON public.public_reseller_stores TO anon, authenticated;

-- Restore the public read policy on reseller_stores (still needed for the view + storefront access),
-- but hide the financial columns from anonymous visitors via column-level grants.
DROP POLICY IF EXISTS "Public can view active stores" ON public.reseller_stores;
CREATE POLICY "Public can view active stores" ON public.reseller_stores
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

REVOKE SELECT ON public.reseller_stores FROM anon;
GRANT SELECT (id, user_id, slug, full_name, whatsapp, store_message, is_active, created_at, updated_at)
  ON public.reseller_stores TO anon;
-- authenticated keeps full SELECT (owners + admins still need profit columns)
