
CREATE OR REPLACE FUNCTION public.dispatch_order_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_url text := 'https://fogipgoxvvlmymuhuazp.supabase.co/functions/v1/order-webhook-dispatch';
  v_anon text := 'sb_publishable_kLmdH-q4-1NdsWIZuA-s6w_tPTl49kL';
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
      'apikey', v_anon
    ),
    body := v_payload,
    timeout_milliseconds := 15000
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE WARNING 'dispatch_order_webhook failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_order_webhook ON public.orders;
CREATE TRIGGER trg_dispatch_order_webhook
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.dispatch_order_webhook();
