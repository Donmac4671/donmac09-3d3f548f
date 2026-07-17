-- 1. Drop legacy stores table (superseded by reseller_stores)
DROP TABLE IF EXISTS public.stores CASCADE;

-- 2. Restrict payment-screenshots upload policy to authenticated role
DROP POLICY IF EXISTS "Users can upload screenshots" ON storage.objects;
CREATE POLICY "Users can upload screenshots"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-screenshots'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 3. Update trigger functions to send shared secret header so only DB can invoke dispatchers
CREATE OR REPLACE FUNCTION public.notify_dispatcher()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_url text := 'https://fogipgoxvvlmymuhuazp.supabase.co/functions/v1/notifications-dispatcher';
  v_anon_key text := 'sb_publishable_kLmdH-q4-1NdsWIZuA-s6w_tPTl49kL';
  v_secret text := 'fc3b865249d86f46403219f68d3b3e0e91f3742e1f08e43d5ddc32efa8e560d3';
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END,
    'old_record', CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END
  );

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key,
      'apikey', v_anon_key,
      'x-trigger-secret', v_secret
    ),
    body := v_payload,
    timeout_milliseconds := 30000
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN others THEN
  RAISE WARNING 'notify_dispatcher failed: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.dispatch_order_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_url text := 'https://fogipgoxvvlmymuhuazp.supabase.co/functions/v1/order-webhook-dispatch';
  v_anon text := 'sb_publishable_kLmdH-q4-1NdsWIZuA-s6w_tPTl49kL';
  v_secret text := 'fc3b865249d86f46403219f68d3b3e0e91f3742e1f08e43d5ddc32efa8e560d3';
  v_payload jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.api_webhooks WHERE user_id = NEW.user_id AND is_active = true) THEN
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'type', TG_OP,
    'record', to_jsonb(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END
  );

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon,
      'apikey', v_anon,
      'x-trigger-secret', v_secret
    ),
    body := v_payload,
    timeout_milliseconds := 15000
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE WARNING 'dispatch_order_webhook failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;