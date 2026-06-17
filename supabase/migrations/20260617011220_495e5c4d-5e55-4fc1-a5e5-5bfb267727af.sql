ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount NUMERIC NOT NULL DEFAULT 0;

-- Backfill existing rows: no fee on historical requests
UPDATE public.withdrawal_requests
  SET fee_amount = 0, net_amount = amount
  WHERE fee_amount IS NULL OR net_amount IS NULL;

-- Update request_withdrawal to calculate 1% fee and store net amount
CREATE OR REPLACE FUNCTION public.request_withdrawal(p_amount numeric, p_momo_number text, p_momo_name text, p_network text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_store RECORD;
  v_id uuid;
  v_fee numeric;
  v_net numeric;
BEGIN
  SELECT * INTO v_store FROM public.reseller_stores WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'You do not own a store';
  END IF;
  IF p_amount < 30 THEN
    RAISE EXCEPTION 'Minimum withdrawal is ₵30';
  END IF;
  IF p_amount > v_store.available_profit THEN
    RAISE EXCEPTION 'Insufficient available profit';
  END IF;

  v_fee := round(p_amount * 0.01, 2);
  v_net := p_amount - v_fee;

  -- Hold the full gross amount immediately
  UPDATE public.reseller_stores SET available_profit = available_profit - p_amount WHERE id = v_store.id;

  INSERT INTO public.withdrawal_requests (store_id, user_id, amount, fee_amount, net_amount, momo_number, momo_name, network)
  VALUES (v_store.id, auth.uid(), p_amount, v_fee, v_net, p_momo_number, p_momo_name, p_network)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;