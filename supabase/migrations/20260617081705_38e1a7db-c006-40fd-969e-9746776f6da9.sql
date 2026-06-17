
-- Revert view to security invoker (Supabase recommendation)
ALTER VIEW public.public_reseller_stores SET (security_invoker = true);

-- Re-allow authenticated users to browse active storefronts at the row level,
-- but lock down profit columns via column-level GRANTs below.
DROP POLICY IF EXISTS "Anon can view active stores" ON public.reseller_stores;
CREATE POLICY "Public can view active stores"
  ON public.reseller_stores FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Column-level lockdown: nobody but the table owner / service_role / definer functions
-- can SELECT the profit columns directly.
REVOKE SELECT (available_profit, lifetime_profit) ON public.reseller_stores FROM anon, authenticated;

-- Helper for the store owner to read their own profit numbers.
CREATE OR REPLACE FUNCTION public.get_my_store_profit()
RETURNS TABLE(available_profit numeric, lifetime_profit numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT available_profit, lifetime_profit
  FROM public.reseller_stores
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_my_store_profit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_store_profit() TO authenticated;

-- Helper for admins to read all store profits.
CREATE OR REPLACE FUNCTION public.admin_get_store_profits()
RETURNS TABLE(user_id uuid, store_id uuid, available_profit numeric, lifetime_profit numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY
    SELECT rs.user_id, rs.id AS store_id, rs.available_profit, rs.lifetime_profit
    FROM public.reseller_stores rs;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_store_profits() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_store_profits() TO authenticated;
