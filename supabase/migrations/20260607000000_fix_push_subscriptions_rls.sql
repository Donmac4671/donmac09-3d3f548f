
-- Enable unauthenticated users to register push subscriptions (since user_id is now nullable)
-- and allow authenticated users to claim subscriptions.

DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Enable all for anon" ON public.push_subscriptions
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for authenticated" ON public.push_subscriptions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
