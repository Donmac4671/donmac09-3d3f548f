
-- Provide a callable RPC for clients to ensure their own profile row exists.
-- Used when the auth.users -> profiles trigger silently failed.
CREATE OR REPLACE FUNCTION public.provision_my_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_full_name text;
  v_phone text;
  v_user_type text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email,
         COALESCE(raw_user_meta_data->>'full_name',''),
         COALESCE(raw_user_meta_data->>'phone',''),
         COALESCE(raw_user_meta_data->>'user_type','customer')
    INTO v_email, v_full_name, v_phone, v_user_type
  FROM auth.users
  WHERE id = v_user_id;

  INSERT INTO public.profiles (
    id, user_id, full_name, email, phone, wallet_balance, is_blocked,
    created_at, updated_at, tier, agent_code, referral_code, topup_reference_code
  )
  VALUES (
    v_user_id, v_user_id, v_full_name, v_email, v_phone, 0, false,
    NOW(), NOW(), v_user_type, NULL, NULL, NULL
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'user'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.provision_my_profile() TO authenticated;

-- Backfill any auth.users that are missing a profile row
INSERT INTO public.profiles (
  id, user_id, full_name, email, phone, wallet_balance, is_blocked,
  created_at, updated_at, tier, agent_code, referral_code, topup_reference_code
)
SELECT
  u.id, u.id,
  COALESCE(u.raw_user_meta_data->>'full_name',''),
  u.email,
  COALESCE(u.raw_user_meta_data->>'phone',''),
  0, false, NOW(), NOW(),
  COALESCE(u.raw_user_meta_data->>'user_type','customer'),
  NULL, NULL, NULL
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::app_role
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id AND r.role = 'user'::app_role
WHERE r.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;
