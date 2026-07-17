
-- 1) Fix mutable search_path on email helper functions
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;

-- 2) Revoke anon execute on SECURITY DEFINER dispatchers
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon;

-- 3) reseller_prices: add WITH CHECK to ALL policy
DROP POLICY IF EXISTS "Resellers can manage their own prices" ON public.reseller_prices;
CREATE POLICY "Resellers can manage their own prices"
  ON public.reseller_prices
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (store_id IN (SELECT id FROM public.reseller_stores WHERE user_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM public.reseller_stores WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Anyone can view active reseller prices" ON public.reseller_prices;
CREATE POLICY "Anyone can view active reseller prices"
  ON public.reseller_prices
  FOR SELECT
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.reseller_stores s WHERE s.id = reseller_prices.store_id AND s.is_active = true));

-- 4) hidden_bundles: replace USING(true) with a meaningful predicate
DROP POLICY IF EXISTS "Authenticated can view hidden bundles" ON public.hidden_bundles;
CREATE POLICY "Authenticated can view hidden bundles"
  ON public.hidden_bundles
  FOR SELECT
  TO authenticated
  USING (status IN ('hidden','offline'));

-- 5) promotions: tighten authenticated view to active & in-window rows
DROP POLICY IF EXISTS "Authenticated can view promotions" ON public.promotions;
CREATE POLICY "Authenticated can view promotions"
  ON public.promotions
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (expires_at IS NULL OR expires_at > now())
  );

-- 6) Rescope {public} role policies to {authenticated} on sensitive tables
-- agent_applications
DROP POLICY IF EXISTS "Admin can delete applications" ON public.agent_applications;
CREATE POLICY "Admin can delete applications" ON public.agent_applications
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admin can update all applications" ON public.agent_applications;
CREATE POLICY "Admin can update all applications" ON public.agent_applications
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admin can view all applications" ON public.agent_applications;
CREATE POLICY "Admin can view all applications" ON public.agent_applications
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Users can insert own applications" ON public.agent_applications;
CREATE POLICY "Users can insert own applications" ON public.agent_applications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view own applications" ON public.agent_applications;
CREATE POLICY "Users can view own applications" ON public.agent_applications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- chat_messages
DROP POLICY IF EXISTS "Admin can insert chat messages" ON public.chat_messages;
CREATE POLICY "Admin can insert chat messages" ON public.chat_messages
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admin can update chat messages" ON public.chat_messages;
CREATE POLICY "Admin can update chat messages" ON public.chat_messages
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admin can view all chat messages" ON public.chat_messages;
CREATE POLICY "Admin can view all chat messages" ON public.chat_messages
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Users can insert own chat messages" ON public.chat_messages;
CREATE POLICY "Users can insert own chat messages" ON public.chat_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND sender_role = 'user');
DROP POLICY IF EXISTS "Users can view own chat messages" ON public.chat_messages;
CREATE POLICY "Users can view own chat messages" ON public.chat_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- complaints
DROP POLICY IF EXISTS "Admin can update all complaints" ON public.complaints;
CREATE POLICY "Admin can update all complaints" ON public.complaints
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admin can view all complaints" ON public.complaints;
CREATE POLICY "Admin can view all complaints" ON public.complaints
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Users can insert own complaints" ON public.complaints;
CREATE POLICY "Users can insert own complaints" ON public.complaints
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view own complaints" ON public.complaints;
CREATE POLICY "Users can view own complaints" ON public.complaints
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- orders
DROP POLICY IF EXISTS "Admin can delete orders" ON public.orders;
CREATE POLICY "Admin can delete orders" ON public.orders
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admin can update all orders" ON public.orders;
CREATE POLICY "Admin can update all orders" ON public.orders
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admin can view all orders" ON public.orders;
CREATE POLICY "Admin can view all orders" ON public.orders
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders" ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- profiles
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;
CREATE POLICY "Admin can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
CREATE POLICY "Admin can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND wallet_balance = (SELECT p2.wallet_balance FROM public.profiles p2 WHERE p2.user_id = auth.uid())
    AND tier = (SELECT p2.tier FROM public.profiles p2 WHERE p2.user_id = auth.uid())
    AND is_blocked = (SELECT p2.is_blocked FROM public.profiles p2 WHERE p2.user_id = auth.uid())
    AND agent_code = (SELECT p2.agent_code FROM public.profiles p2 WHERE p2.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- transactions
DROP POLICY IF EXISTS "Admin can insert transactions" ON public.transactions;
CREATE POLICY "Admin can insert transactions" ON public.transactions
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admin can view all transactions" ON public.transactions;
CREATE POLICY "Admin can view all transactions" ON public.transactions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- wallet_topups
DROP POLICY IF EXISTS "Admin can delete topups" ON public.wallet_topups;
CREATE POLICY "Admin can delete topups" ON public.wallet_topups
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admin can update all topups" ON public.wallet_topups;
CREATE POLICY "Admin can update all topups" ON public.wallet_topups
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
