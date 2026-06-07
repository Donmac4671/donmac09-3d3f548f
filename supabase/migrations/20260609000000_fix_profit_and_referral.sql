
-- Fix register_store_referral to allow updating the referral (switching resellers)
-- and prevent self-referral.
CREATE OR REPLACE FUNCTION public.register_store_referral(p_slug text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_slug IS NULL OR length(trim(p_slug)) = 0 THEN RETURN; END IF;

  SELECT id INTO v_store_id FROM public.reseller_stores WHERE slug = lower(trim(p_slug)) AND is_active = true;
  IF v_store_id IS NULL THEN RETURN; END IF;

  -- Don't allow self-referral (reseller visiting their own store)
  IF EXISTS (SELECT 1 FROM public.reseller_stores WHERE id = v_store_id AND user_id = auth.uid()) THEN
    RETURN;
  END IF;

  INSERT INTO public.store_referrals (user_id, store_id) VALUES (auth.uid(), v_store_id)
  ON CONFLICT (user_id) DO UPDATE SET store_id = EXCLUDED.store_id;
END;
$$;

-- Correctly handle reseller profit refund on failed order
CREATE OR REPLACE FUNCTION public.refund_failed_order(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Only refund wallet payments and only once
  IF v_order.payment_method <> 'wallet' THEN RETURN; END IF;

  -- Check if refund already issued
  IF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE user_id = v_order.user_id
      AND type = 'refund'
      AND description LIKE '%' || v_order.order_ref || '%'
  ) THEN
    RETURN;
  END IF;

  -- Refund user wallet
  UPDATE public.profiles
    SET wallet_balance = wallet_balance + v_order.amount
    WHERE user_id = v_order.user_id;

  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (
    v_order.user_id,
    'refund',
    'Refund for failed order ' || v_order.order_ref || ' (' || v_order.network || ' ' || v_order.bundle_size || ')',
    v_order.amount,
    'completed'
  );

  -- Claw back reseller profit if applicable
  IF v_order.store_id IS NOT NULL AND v_order.reseller_profit > 0 THEN
    UPDATE public.reseller_stores
      SET available_profit = available_profit - v_order.reseller_profit,
          lifetime_profit = lifetime_profit - v_order.reseller_profit
      WHERE id = v_order.store_id;

    INSERT INTO public.transactions (user_id, type, description, amount, status)
    SELECT s.user_id, 'purchase',
           'Profit clawback for failed order ' || v_order.order_ref,
           -v_order.reseller_profit, 'completed'
    FROM public.reseller_stores s WHERE s.id = v_order.store_id;
  END IF;
END;
$$;
