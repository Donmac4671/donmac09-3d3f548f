
DO $$
DECLARE v_uid uuid := '36ca073f-d143-4bac-8311-b96b9cb7561a';
BEGIN
  DELETE FROM public.orders WHERE user_id = v_uid;
  DELETE FROM public.transactions WHERE user_id = v_uid;
  DELETE FROM public.wallet_topups WHERE user_id = v_uid;
  DELETE FROM public.complaints WHERE user_id = v_uid;
  DELETE FROM public.chat_messages WHERE user_id = v_uid;
  DELETE FROM public.agent_applications WHERE user_id = v_uid;
  DELETE FROM public.push_subscriptions WHERE user_id = v_uid;
  DELETE FROM public.referrals WHERE referred_id = v_uid OR referrer_id = v_uid;
  DELETE FROM public.store_referrals WHERE user_id = v_uid;
  DELETE FROM public.verified_topups WHERE claimed_by = v_uid;
  DELETE FROM public.withdrawal_requests WHERE user_id = v_uid;
  DELETE FROM public.reseller_bundle_prices WHERE store_id IN (SELECT id FROM public.reseller_stores WHERE user_id = v_uid);
  DELETE FROM public.reseller_stores WHERE user_id = v_uid;
  DELETE FROM public.api_tokens WHERE user_id = v_uid;
  DELETE FROM public.api_webhooks WHERE user_id = v_uid;
  DELETE FROM public.user_roles WHERE user_id = v_uid;
  DELETE FROM public.profiles WHERE user_id = v_uid;
  DELETE FROM auth.users WHERE id = v_uid;
END $$;
