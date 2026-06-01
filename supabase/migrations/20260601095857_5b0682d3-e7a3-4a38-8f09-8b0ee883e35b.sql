
-- ============ Reseller Stores ============
CREATE TABLE public.reseller_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  store_message text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  available_profit numeric NOT NULL DEFAULT 0,
  lifetime_profit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reseller_stores_slug_format CHECK (slug ~ '^[a-z0-9-]{3,30}$')
);

GRANT SELECT ON public.reseller_stores TO anon;
GRANT SELECT, INSERT, UPDATE ON public.reseller_stores TO authenticated;
GRANT ALL ON public.reseller_stores TO service_role;

ALTER TABLE public.reseller_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active stores" ON public.reseller_stores FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Owner can view own store" ON public.reseller_stores FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin can view all stores" ON public.reseller_stores FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner can update own store profile" ON public.reseller_stores FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND available_profit = (SELECT available_profit FROM public.reseller_stores WHERE user_id = auth.uid())
    AND lifetime_profit = (SELECT lifetime_profit FROM public.reseller_stores WHERE user_id = auth.uid())
    AND slug = (SELECT slug FROM public.reseller_stores WHERE user_id = auth.uid())
  );
CREATE POLICY "Admin can update all stores" ON public.reseller_stores FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can insert stores" ON public.reseller_stores FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete stores" ON public.reseller_stores FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER reseller_stores_updated_at BEFORE UPDATE ON public.reseller_stores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Reseller Bundle Prices (per-store overrides) ============
CREATE TABLE public.reseller_bundle_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.reseller_stores(id) ON DELETE CASCADE,
  network_id text NOT NULL,
  bundle_size text NOT NULL,
  price numeric NOT NULL CHECK (price >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, network_id, bundle_size)
);

GRANT SELECT ON public.reseller_bundle_prices TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reseller_bundle_prices TO authenticated;
GRANT ALL ON public.reseller_bundle_prices TO service_role;

ALTER TABLE public.reseller_bundle_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view store prices" ON public.reseller_bundle_prices FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owner can manage own store prices" ON public.reseller_bundle_prices FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reseller_stores s WHERE s.id = store_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.reseller_stores s WHERE s.id = store_id AND s.user_id = auth.uid()));
CREATE POLICY "Admin manage all store prices" ON public.reseller_bundle_prices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER reseller_bundle_prices_updated_at BEFORE UPDATE ON public.reseller_bundle_prices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Reseller Markups (airtime / mashup / vs only) ============
CREATE TABLE public.reseller_markups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.reseller_stores(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('airtime','mashup','vs')),
  percent numeric NOT NULL DEFAULT 0 CHECK (percent >= 0 AND percent <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, kind)
);

GRANT SELECT ON public.reseller_markups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reseller_markups TO authenticated;
GRANT ALL ON public.reseller_markups TO service_role;

ALTER TABLE public.reseller_markups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view markups" ON public.reseller_markups FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owner can manage own markups" ON public.reseller_markups FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reseller_stores s WHERE s.id = store_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.reseller_stores s WHERE s.id = store_id AND s.user_id = auth.uid()));
CREATE POLICY "Admin manage all markups" ON public.reseller_markups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER reseller_markups_updated_at BEFORE UPDATE ON public.reseller_markups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Withdrawal Requests ============
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.reseller_stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 30),
  momo_number text NOT NULL,
  momo_name text NOT NULL DEFAULT '',
  network text NOT NULL DEFAULT 'MTN',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid')),
  admin_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view own requests" ON public.withdrawal_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin can view all requests" ON public.withdrawal_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update requests" ON public.withdrawal_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner can insert via RPC" ON public.withdrawal_requests FOR INSERT TO authenticated WITH CHECK (false);

CREATE TRIGGER withdrawal_requests_updated_at BEFORE UPDATE ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Store referrals (users who register under a reseller link) ============
CREATE TABLE public.store_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  store_id uuid NOT NULL REFERENCES public.reseller_stores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.store_referrals TO authenticated;
GRANT ALL ON public.store_referrals TO service_role;

ALTER TABLE public.store_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own store referral" ON public.store_referrals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own store referral" ON public.store_referrals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Store owner can view referrals" ON public.store_referrals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.reseller_stores s WHERE s.id = store_id AND s.user_id = auth.uid()));
CREATE POLICY "Admin can view referrals" ON public.store_referrals FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ Add reseller_profit + storefront_slug to orders ============
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reseller_profit numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS storefront_slug text;

-- ============ Augment pay_with_wallet to accept optional store_id ============
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
BEGIN
  SELECT wallet_balance INTO current_balance FROM public.profiles WHERE user_id = auth.uid();
  IF current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE user_id = auth.uid();

  new_ref := public.next_order_ref();

  IF p_store_id IS NOT NULL THEN
    SELECT slug INTO v_slug FROM public.reseller_stores WHERE id = p_store_id;
  END IF;

  INSERT INTO public.orders (user_id, order_ref, network, phone_number, bundle_size, amount, status, payment_method, store_id, storefront_slug, reseller_profit)
  VALUES (auth.uid(), new_ref, p_network, p_phone, p_bundle, p_amount, 'processing', 'wallet', p_store_id, v_slug, COALESCE(p_profit, 0))
  RETURNING id INTO new_order_id;

  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (auth.uid(), 'purchase', p_network || ' ' || p_bundle || ' to ' || p_phone, -p_amount, 'completed');

  -- Credit reseller profit on order placement
  IF p_store_id IS NOT NULL AND COALESCE(p_profit, 0) > 0 THEN
    UPDATE public.reseller_stores
      SET available_profit = available_profit + p_profit,
          lifetime_profit = lifetime_profit + p_profit
      WHERE id = p_store_id;

    INSERT INTO public.transactions (user_id, type, description, amount, status)
    SELECT s.user_id, 'commission',
           'Storefront commission for order ' || new_ref,
           p_profit, 'completed'
    FROM public.reseller_stores s WHERE s.id = p_store_id;
  END IF;

  RETURN new_order_id;
END;
$$;

-- ============ Request withdrawal RPC ============
CREATE OR REPLACE FUNCTION public.request_withdrawal(p_amount numeric, p_momo_number text, p_momo_name text, p_network text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_store RECORD;
  v_id uuid;
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

  -- Hold the funds immediately
  UPDATE public.reseller_stores SET available_profit = available_profit - p_amount WHERE id = v_store.id;

  INSERT INTO public.withdrawal_requests (store_id, user_id, amount, momo_number, momo_name, network)
  VALUES (v_store.id, auth.uid(), p_amount, p_momo_number, p_momo_name, p_network)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============ Admin withdrawal actions ============
CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(p_id uuid, p_notes text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT * INTO v_req FROM public.withdrawal_requests WHERE id = p_id FOR UPDATE;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Only pending requests can be rejected'; END IF;
  -- Refund held funds
  UPDATE public.reseller_stores SET available_profit = available_profit + v_req.amount WHERE id = v_req.store_id;
  UPDATE public.withdrawal_requests SET status = 'rejected', admin_notes = p_notes WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_withdrawal(p_id uuid, p_notes text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.withdrawal_requests SET status = 'approved', admin_notes = p_notes WHERE id = p_id AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mark_withdrawal_paid(p_id uuid, p_notes text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.withdrawal_requests SET status = 'paid', admin_notes = p_notes
    WHERE id = p_id AND status IN ('pending','approved');
END;
$$;

-- ============ Admin create reseller store ============
CREATE OR REPLACE FUNCTION public.admin_create_store(p_user_id uuid, p_slug text, p_full_name text, p_whatsapp text, p_store_message text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO public.reseller_stores (user_id, slug, full_name, whatsapp, store_message)
  VALUES (p_user_id, lower(trim(p_slug)), p_full_name, p_whatsapp, p_store_message)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ============ Register store referral on signup ============
CREATE OR REPLACE FUNCTION public.register_store_referral(p_slug text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_slug IS NULL OR length(trim(p_slug)) = 0 THEN RETURN; END IF;
  SELECT id INTO v_store_id FROM public.reseller_stores WHERE slug = lower(trim(p_slug)) AND is_active = true;
  IF v_store_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.store_referrals (user_id, store_id) VALUES (auth.uid(), v_store_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;
