
CREATE OR REPLACE FUNCTION public.api_place_order_for_user(
  p_user_id uuid,
  p_network text,
  p_phone text,
  p_bundle text,
  p_amount numeric
)
RETURNS TABLE(order_id uuid, order_ref text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance numeric;
  new_order_id uuid;
  new_ref text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  SELECT wallet_balance INTO current_balance FROM public.profiles WHERE user_id = p_user_id;
  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  IF current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE user_id = p_user_id;

  new_ref := public.next_order_ref();

  INSERT INTO public.orders (user_id, order_ref, network, phone_number, bundle_size, amount, status, payment_method)
  VALUES (p_user_id, new_ref, p_network, p_phone, p_bundle, p_amount, 'processing', 'api')
  RETURNING id INTO new_order_id;

  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (p_user_id, 'purchase', 'API: ' || p_network || ' ' || p_bundle || ' to ' || p_phone, -p_amount, 'completed');

  RETURN QUERY SELECT new_order_id, new_ref;
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_place_order_for_user(uuid,text,text,text,numeric) TO service_role;
