
-- Idempotency flag
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS profit_credited boolean NOT NULL DEFAULT false;

-- ============ Replace pay_with_wallet: auto-bind + don't credit on placement ============
CREATE OR REPLACE FUNCTION public.pay_with_wallet(
  p_network text,
  p_phone text,
  p_bundle text,
  p_amount numeric,
  p_store_id uuid DEFAULT NULL,
  p_profit numeric DEFAULT 0
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_balance numeric;
  new_order_id uuid;
  new_ref text;
  v_slug text;
  v_store_id uuid := p_store_id;
  v_profit numeric := COALESCE(p_profit, 0);
BEGIN
  SELECT wallet_balance INTO current_balance FROM public.profiles WHERE user_id = auth.uid();
  IF current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE user_id = auth.uid();

  new_ref := public.next_order_ref();

  -- Auto-bind to the customer's referred reseller store when not provided
  IF v_store_id IS NULL THEN
    SELECT sr.store_id INTO v_store_id
    FROM public.store_referrals sr
    JOIN public.reseller_stores rs ON rs.id = sr.store_id AND rs.is_active = true
    WHERE sr.user_id = auth.uid()
      AND rs.user_id <> auth.uid()   -- don't attribute to oneself
    LIMIT 1;
  END IF;

  IF v_store_id IS NOT NULL THEN
    SELECT slug INTO v_slug FROM public.reseller_stores WHERE id = v_store_id;
  END IF;

  -- Guard against negative profit
  IF v_profit < 0 THEN v_profit := 0; END IF;

  INSERT INTO public.orders (
    user_id, order_ref, network, phone_number, bundle_size, amount, status,
    payment_method, store_id, storefront_slug, reseller_profit, profit_credited
  )
  VALUES (
    auth.uid(), new_ref, p_network, p_phone, p_bundle, p_amount, 'processing',
    'wallet', v_store_id, v_slug, v_profit, false
  )
  RETURNING id INTO new_order_id;

  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (auth.uid(), 'purchase', p_network || ' ' || p_bundle || ' to ' || p_phone, -p_amount, 'completed');

  RETURN new_order_id;
END;
$$;

-- ============ Trigger: credit reseller profit only when delivered ============
CREATE OR REPLACE FUNCTION public.credit_reseller_profit_on_delivery()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
BEGIN
  -- Only act when status actually changes
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Nothing to do without a store + profit amount
  IF NEW.store_id IS NULL OR COALESCE(NEW.reseller_profit, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  -- Going TO completed/delivered → credit (idempotent)
  IF NEW.status IN ('completed','delivered') AND NOT COALESCE(OLD.profit_credited, false) THEN
    UPDATE public.reseller_stores
      SET available_profit = available_profit + NEW.reseller_profit,
          lifetime_profit  = lifetime_profit  + NEW.reseller_profit
      WHERE id = NEW.store_id
      RETURNING user_id INTO v_owner;

    IF v_owner IS NOT NULL THEN
      INSERT INTO public.transactions (user_id, type, description, amount, status)
      VALUES (v_owner, 'commission',
              'Storefront commission for order ' || NEW.order_ref,
              NEW.reseller_profit, 'completed');
    END IF;

    NEW.profit_credited := true;
    RETURN NEW;
  END IF;

  -- Reversing away from completed → debit back (only if previously credited)
  IF OLD.status IN ('completed','delivered')
     AND NEW.status NOT IN ('completed','delivered')
     AND COALESCE(OLD.profit_credited, false) THEN
    UPDATE public.reseller_stores
      SET available_profit = GREATEST(0, available_profit - NEW.reseller_profit),
          lifetime_profit  = GREATEST(0, lifetime_profit  - NEW.reseller_profit)
      WHERE id = NEW.store_id
      RETURNING user_id INTO v_owner;

    IF v_owner IS NOT NULL THEN
      INSERT INTO public.transactions (user_id, type, description, amount, status)
      VALUES (v_owner, 'commission_reversal',
              'Reversed commission for order ' || NEW.order_ref,
              -NEW.reseller_profit, 'completed');
    END IF;

    NEW.profit_credited := false;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_credit_reseller_profit ON public.orders;
CREATE TRIGGER trg_orders_credit_reseller_profit
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_reseller_profit_on_delivery();
