-- Fix: Allow authenticated users (customers) to view active reseller stores.
-- Without this, customers see "Store not found" after logging in via a reseller storefront.
DROP POLICY IF EXISTS "Anon can view active stores" ON public.reseller_stores;
DROP POLICY IF EXISTS "Public can view active stores" ON public.reseller_stores;

CREATE POLICY "Public can view active stores"
  ON public.reseller_stores
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Re-confirm grants (though they should already be correct from previous migrations)
GRANT SELECT (id, user_id, slug, full_name, whatsapp, store_message, is_active, created_at, updated_at)
  ON public.reseller_stores TO anon, authenticated;
