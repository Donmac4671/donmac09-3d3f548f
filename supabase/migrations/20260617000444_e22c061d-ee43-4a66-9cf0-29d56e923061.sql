
-- 1) Expand transactions.type allowed values so commission credits don't fail
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check
  CHECK (type = ANY (ARRAY['purchase','topup','credit','debit','refund','commission','commission_reversal']));

-- 2) Fix handle_new_user so 'user'::app_role resolves (needs public in search_path),
--    and pick up tier from either user_type or tier metadata keys.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
BEGIN
  v_tier := COALESCE(
    NEW.raw_user_meta_data->>'user_type',
    NEW.raw_user_meta_data->>'tier',
    'customer'
  );

  INSERT INTO public.profiles (
    id, user_id, full_name, email, phone, wallet_balance, is_blocked,
    created_at, updated_at, tier, agent_code, referral_code, topup_reference_code
  )
  VALUES (
    NEW.id, NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone',''),
    0, false, NOW(), NOW(),
    v_tier, NULL, NULL, NULL
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    tier = EXCLUDED.tier,
    updated_at = NOW();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 3) Backfill missing profile + role for the recently-created reseller(s)
INSERT INTO public.profiles (id, user_id, full_name, email, phone, wallet_balance, is_blocked, created_at, updated_at, tier)
SELECT u.id, u.id,
       COALESCE(u.raw_user_meta_data->>'full_name',''),
       u.email,
       COALESCE(u.raw_user_meta_data->>'phone',''),
       0, false, NOW(), NOW(),
       COALESCE(u.raw_user_meta_data->>'user_type', u.raw_user_meta_data->>'tier', 'customer')
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::public.app_role
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id AND r.role = 'user'::public.app_role
WHERE r.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;
