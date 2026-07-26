CREATE OR REPLACE FUNCTION public.auto_refund_on_failed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'failed' AND COALESCE(OLD.status,'') <> 'failed' THEN
    PERFORM public.refund_failed_order(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_refund_on_failed() FROM anon, PUBLIC;

DROP TRIGGER IF EXISTS trg_auto_refund_on_failed ON public.orders;
CREATE TRIGGER trg_auto_refund_on_failed
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_refund_on_failed();