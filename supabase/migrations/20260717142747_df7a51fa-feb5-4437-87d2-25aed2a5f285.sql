
-- 1) Revoke anon EXECUTE on block_reserved_identity (trigger fn, not for external calls)
REVOKE EXECUTE ON FUNCTION public.block_reserved_identity() FROM anon, PUBLIC;

-- 2) Harden pay_with_wallet: recompute price + profit server-side when a data bundle is identified.
CREATE OR REPLACE FUNCTION public.pay_with_wallet(
  p_network text,
  p_phone text,
  p_bundle text,
  p_amount numeric,
  p_store_id uuid DEFAULT NULL::uuid,
  p_profit numeric DEFAULT 0,
  p_network_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_balance numeric;
  new_order_id uuid;
  new_ref text;
  v_slug text;
  v_store_id uuid := p_store_id;
  v_profit numeric := COALESCE(p_profit, 0);
  v_amount numeric := p_amount;
  v_base numeric;
  v_reseller_price numeric;
BEGIN
  -- Server-side price enforcement for data bundles.
  IF p_network_id IS NOT NULL AND p_network_id NOT IN ('airtime','mashup','vs') THEN
    SELECT general_price INTO v_base
    FROM public.custom_bundles
    WHERE network_id = p_network_id AND bundle_size = p_bundle;

    IF v_base IS NULL THEN
      RAISE EXCEPTION 'Unknown bundle for %/%', p_network_id, p_bundle;
    END IF;

    v_reseller_price := v_base;
    IF v_store_id IS NOT NULL THEN
      SELECT price INTO v_reseller_price
      FROM public.reseller_bundle_prices
      WHERE store_id = v_store_id AND network_id = p_network_id AND bundle_size = p_bundle;
      v_reseller_price := COALESCE(v_reseller_price, v_base);
    END IF;

    v_amount := v_reseller_price;
    v_profit := GREATEST(0, v_reseller_price - v_base);
  ELSE
    -- Airtime/mashup/vs and legacy callers: never trust client-supplied profit for storefront credits.
    v_profit := 0;
  END IF;

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  SELECT wallet_balance INTO current_balance FROM public.profiles WHERE user_id = auth.uid();
  IF current_balance IS NULL OR current_balance < v_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance - v_amount WHERE user_id = auth.uid();

  new_ref := public.next_order_ref();

  -- Auto-bind to referred store when not supplied.
  IF v_store_id IS NULL THEN
    SELECT sr.store_id INTO v_store_id
    FROM public.store_referrals sr
    JOIN public.reseller_stores rs ON rs.id = sr.store_id AND rs.is_active = true
    WHERE sr.user_id = auth.uid()
      AND rs.user_id <> auth.uid()
    LIMIT 1;

    -- Recompute profit if we just discovered a store (data bundle case)
    IF v_store_id IS NOT NULL AND p_network_id IS NOT NULL AND p_network_id NOT IN ('airtime','mashup','vs') THEN
      SELECT price INTO v_reseller_price
      FROM public.reseller_bundle_prices
      WHERE store_id = v_store_id AND network_id = p_network_id AND bundle_size = p_bundle;
      IF v_reseller_price IS NOT NULL THEN
        v_profit := GREATEST(0, v_reseller_price - v_base);
      END IF;
    END IF;
  END IF;

  IF v_store_id IS NOT NULL THEN
    SELECT slug INTO v_slug FROM public.reseller_stores WHERE id = v_store_id;
  END IF;

  INSERT INTO public.orders (
    user_id, order_ref, network, phone_number, bundle_size, amount, status,
    payment_method, store_id, storefront_slug, reseller_profit, profit_credited
  )
  VALUES (
    auth.uid(), new_ref, p_network, p_phone, p_bundle, v_amount, 'processing',
    'wallet', v_store_id, v_slug, v_profit, false
  )
  RETURNING id INTO new_order_id;

  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (auth.uid(), 'purchase', p_network || ' ' || p_bundle || ' to ' || p_phone, -v_amount, 'completed');

  RETURN new_order_id;
END;
$function$;
