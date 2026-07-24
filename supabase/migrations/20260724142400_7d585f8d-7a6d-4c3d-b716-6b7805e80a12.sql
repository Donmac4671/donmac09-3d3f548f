
CREATE OR REPLACE FUNCTION public.promote_mtn_pending_to_processing()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  WITH updated AS (
    UPDATE public.orders
       SET status = 'processing'
     WHERE status = 'pending'
       AND lower(network) = 'mtn'
       AND gh_reference IS NOT NULL
       AND created_at <= now() - interval '1 minute'
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.promote_mtn_pending_to_processing() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_mtn_pending_to_processing() TO service_role;
