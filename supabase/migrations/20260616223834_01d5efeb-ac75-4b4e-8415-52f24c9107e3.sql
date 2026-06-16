
-- 1. API tokens
CREATE TABLE IF NOT EXISTS public.api_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'API token',
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_tokens TO authenticated;
GRANT ALL ON public.api_tokens TO service_role;
ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own tokens"
  ON public.api_tokens FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users create their own tokens"
  ON public.api_tokens FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own tokens"
  ON public.api_tokens FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete their own tokens"
  ON public.api_tokens FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS api_tokens_user_id_idx ON public.api_tokens(user_id);

-- 2. Webhooks (one per user)
CREATE TABLE IF NOT EXISTS public.api_webhooks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_webhooks TO authenticated;
GRANT ALL ON public.api_webhooks TO service_role;
ALTER TABLE public.api_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own webhook"
  ON public.api_webhooks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. API request logs
CREATE TABLE IF NOT EXISTS public.api_order_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code int,
  request_body jsonb,
  response_body jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.api_order_logs TO authenticated;
GRANT ALL ON public.api_order_logs TO service_role;
ALTER TABLE public.api_order_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own API logs"
  ON public.api_order_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS api_order_logs_user_id_idx ON public.api_order_logs(user_id, created_at DESC);
