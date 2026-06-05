
-- Enable unauthenticated users to register push subscriptions (since user_id is now nullable)
-- and allow authenticated users to claim subscriptions.

DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Anyone can view push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert push subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update push subscriptions"
  ON public.push_subscriptions FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete push subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (true);
