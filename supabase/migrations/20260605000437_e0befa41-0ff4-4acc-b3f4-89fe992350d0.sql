
-- 1) Broadcasts: let authenticated users read broadcasts targeted at them
CREATE POLICY "Users can view broadcasts for their audience"
  ON public.broadcasts
  FOR SELECT
  TO authenticated
  USING (
    audience = 'all'
    OR audience = 'reseller'
    OR (audience = 'admin' AND public.has_role(auth.uid(), 'admin'::app_role))
  );

-- 2) Push subscriptions: drop the policy that lets anon update any anonymous record
DROP POLICY IF EXISTS "Anyone can update anonymous push subscriptions" ON public.push_subscriptions;

-- 3) Harden claim_verified_topup against race conditions
CREATE OR REPLACE FUNCTION public.claim_verified_topup(p_transaction_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topup RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock the row to serialize concurrent claim attempts
  SELECT * INTO v_topup
  FROM public.verified_topups
  WHERE transaction_id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction ID not found. Please check and try again.';
  END IF;

  IF v_topup.is_claimed THEN
    RAISE EXCEPTION 'This transaction has already been claimed.';
  END IF;

  UPDATE public.verified_topups
    SET is_claimed = true, claimed_by = auth.uid(), claimed_at = now()
    WHERE id = v_topup.id;

  UPDATE public.profiles
    SET wallet_balance = wallet_balance + v_topup.amount
    WHERE user_id = auth.uid();

  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (auth.uid(), 'topup',
          'MoMo top-up claimed (' || v_topup.network || ' ID: ' || p_transaction_id || ')',
          v_topup.amount, 'completed');

  INSERT INTO public.wallet_topups (user_id, amount, method, status, paystack_reference)
  VALUES (auth.uid(), v_topup.amount, 'momo', 'completed', p_transaction_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_verified_topup(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_verified_topup(text) TO authenticated;
