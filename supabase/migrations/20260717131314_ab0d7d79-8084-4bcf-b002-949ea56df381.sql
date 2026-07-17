
DO $$
DECLARE v_uid uuid := '40b17497-6ebb-4437-9b7c-67f8ae5df201';
DECLARE v_email text := 'mosei1342@gmail.com';
BEGIN
  DELETE FROM public.transactions WHERE user_id = v_uid;
  DELETE FROM public.orders WHERE user_id = v_uid;
  DELETE FROM public.complaints WHERE user_id = v_uid;
  DELETE FROM public.chat_messages WHERE user_id = v_uid;
  DELETE FROM public.referrals WHERE referrer_id = v_uid OR referred_id = v_uid;
  DELETE FROM public.store_referrals WHERE user_id = v_uid;
  DELETE FROM public.customer_reseller_links WHERE customer_id = v_uid OR reseller_id = v_uid;
  DELETE FROM public.reseller_bundle_prices WHERE store_id IN (SELECT id FROM public.reseller_stores WHERE user_id = v_uid);
  DELETE FROM public.withdrawal_requests WHERE user_id = v_uid;
  DELETE FROM public.reseller_stores WHERE user_id = v_uid;
  DELETE FROM public.wallet_topups WHERE user_id = v_uid;
  DELETE FROM public.verified_topups WHERE claimed_by = v_uid;
  DELETE FROM public.agent_applications WHERE user_id = v_uid;
  DELETE FROM public.agent_code_assignments WHERE user_id = v_uid;
  DELETE FROM public.api_tokens WHERE user_id = v_uid;
  DELETE FROM public.api_webhooks WHERE user_id = v_uid;
  DELETE FROM public.push_subscriptions WHERE user_id = v_uid;
  DELETE FROM public.email_unsubscribe_tokens WHERE email = v_email;
  DELETE FROM public.suppressed_emails WHERE email = v_email;
  DELETE FROM public.user_roles WHERE user_id = v_uid;
  DELETE FROM public.profiles WHERE user_id = v_uid;
  DELETE FROM auth.users WHERE id = v_uid;
END $$;
