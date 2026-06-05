
-- Enable unauthenticated users to register push subscriptions (since user_id is now nullable)
-- and allow authenticated users to claim subscriptions.

DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Users can view own push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id OR (user_id IS NULL AND auth.uid() IS NULL));

CREATE POLICY "Anyone can insert push subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own push subscriptions"
  ON public.push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id OR (user_id IS NULL AND auth.uid() IS NULL));

CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id OR (user_id IS NULL AND auth.uid() IS NULL));

CREATE POLICY "Admins can manage all push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
