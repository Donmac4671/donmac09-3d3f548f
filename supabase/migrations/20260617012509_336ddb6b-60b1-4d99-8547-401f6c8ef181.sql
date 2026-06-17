
-- 1) Enable RLS on exposed tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view users" ON public.users;
CREATE POLICY "Admins can view users" ON public.users FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
REVOKE SELECT ON public.users FROM anon;

ALTER TABLE public.customer_reseller_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Customers view own links" ON public.customer_reseller_links;
DROP POLICY IF EXISTS "Resellers view their links" ON public.customer_reseller_links;
DROP POLICY IF EXISTS "Admins manage links" ON public.customer_reseller_links;
CREATE POLICY "Customers view own links" ON public.customer_reseller_links FOR SELECT TO authenticated
  USING (auth.uid() = customer_id);
CREATE POLICY "Resellers view their links" ON public.customer_reseller_links FOR SELECT TO authenticated
  USING (auth.uid() = reseller_id);
CREATE POLICY "Admins manage links" ON public.customer_reseller_links FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.customer_reseller_links FROM anon;

-- 2) Remove direct INSERT on orders and wallet_topups (force RPCs)
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own topups" ON public.wallet_topups;

-- 3) Tighten referrals insert policy to prevent reward manipulation
DROP POLICY IF EXISTS "Users can insert referrals" ON public.referrals;
CREATE POLICY "Users can insert referrals" ON public.referrals
  FOR INSERT TO authenticated
  WITH CHECK (
    referred_id = auth.uid()
    AND reward_paid = false
    AND reward_amount = 0
  );

-- 4) Restrict reseller_stores public exposure via a safe view
DROP POLICY IF EXISTS "Public can view active stores" ON public.reseller_stores;

CREATE OR REPLACE VIEW public.public_reseller_stores
WITH (security_invoker = false) AS
SELECT id, user_id, slug, full_name, whatsapp, store_message, is_active, created_at, updated_at
FROM public.reseller_stores
WHERE is_active = true;

GRANT SELECT ON public.public_reseller_stores TO anon, authenticated;

-- 5) Tighten anonymous push subscription insert: require user_id IS NULL (matches code intent)
DROP POLICY IF EXISTS "Anyone can insert anonymous push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Anonymous can insert anonymous push subscriptions"
  ON public.push_subscriptions FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

-- 6) Lock down SECURITY DEFINER functions: revoke EXECUTE from anon/public
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', r.proname, r.args);
  END LOOP;
END $$;

-- Functions that must remain callable by anon (auto-claim via SMS webhook uses service_role; keep anon out)
-- (no exceptions)

-- 7) Set search_path on functions that are missing it
ALTER FUNCTION public.force_update_reseller_profit(uuid, numeric) SET search_path = public;
ALTER FUNCTION public.process_sale_final(text, text, text, integer) SET search_path = public;
ALTER FUNCTION public.safe_update_reseller_profit(uuid, numeric) SET search_path = public;
ALTER FUNCTION public.add_reseller_profit_direct(uuid, numeric) SET search_path = public;
ALTER FUNCTION public.process_reseller_sale_safe(text, text, text, integer) SET search_path = public;
ALTER FUNCTION public.process_reseller_sale(text, text, text, integer) SET search_path = public;
ALTER FUNCTION public.admin_create_store(uuid, text, text, text, text) SET search_path = public;
ALTER FUNCTION public.create_user_profile(uuid, text, text, text, text) SET search_path = public;
ALTER FUNCTION public.process_sale_and_add_profit(text, text, text, text, integer) SET search_path = public;
