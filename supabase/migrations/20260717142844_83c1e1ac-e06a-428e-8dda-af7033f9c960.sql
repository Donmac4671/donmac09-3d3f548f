
DO $$
DECLARE
  v_secret text;
  v_anon text := 'sb_publishable_kLmdH-q4-1NdsWIZuA-s6w_tPTl49kL';
  v_url text := 'https://fogipgoxvvlmymuhuazp.supabase.co/functions/v1/telegram-momo';
  v_cmd text;
  r RECORD;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'TRIGGER_SHARED_SECRET' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_secret := NULL;
  END;

  IF v_secret IS NULL THEN
    RAISE NOTICE 'TRIGGER_SHARED_SECRET not in vault; cron cannot be rewritten here. Set it in vault or update cron manually.';
    RETURN;
  END IF;

  v_cmd := format($cmd$SELECT net.http_post(
    url := %L,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s','apikey','%s','x-trigger-secret', %L),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );$cmd$, v_url, v_anon, v_anon, v_secret);

  FOR r IN SELECT jobid, jobname FROM cron.job WHERE command ILIKE '%telegram-momo%' LOOP
    PERFORM cron.alter_job(job_id := r.jobid, command := v_cmd);
  END LOOP;
END $$;
