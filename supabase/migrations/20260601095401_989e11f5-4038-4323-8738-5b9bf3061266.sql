
-- 1) Ensure admin role for donmacdatahub@gmail.com if user already exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'donmacdatahub@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Migrate all profile tiers to 'reseller'
UPDATE public.profiles SET tier = 'reseller' WHERE tier <> 'reseller';
ALTER TABLE public.profiles ALTER COLUMN tier SET DEFAULT 'reseller';

-- 3) Update handle_new_user to assign reseller tier and 'user' role (admin still auto-assigned for owner email)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, phone, agent_code, tier)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    '',
    'reseller'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  IF NEW.email = 'donmacdatahub@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- 4) Update tier-aware functions to use a single ₵10 minimum topup
CREATE OR REPLACE FUNCTION public.complete_paystack_topup(p_amount numeric, p_reference text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Paystack is disabled. Use Mobile Money top-up.';
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_paystack_topup_for_user(p_user_id uuid, p_amount numeric, p_reference text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Paystack is disabled. Use Mobile Money top-up.';
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_order_with_paystack(p_network text, p_phone text, p_bundle text, p_amount numeric, p_reference text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Paystack is disabled. Use wallet payment.';
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_order_with_paystack_for_user(p_user_id uuid, p_network text, p_phone text, p_bundle text, p_amount numeric, p_reference text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Paystack is disabled. Use wallet payment.';
END;
$$;

-- 5) Update agent-referral trigger to fire on 'reseller' (no behavioural change since everyone is reseller now; harmless)
CREATE OR REPLACE FUNCTION public.process_agent_referral_reward()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- No-op since tier consolidation; kept for compatibility
  RETURN NEW;
END;
$$;

-- 6) Add store_id to orders for storefront attribution (Phase 2 will create reseller_stores)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS store_id uuid;
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON public.orders(store_id);
