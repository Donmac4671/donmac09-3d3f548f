DO $$
BEGIN
  -- Remove any previous schedule so we don't double-run
  PERFORM cron.unschedule(jobid)
    FROM cron.job
   WHERE jobname IN ('run-auto-deliver', 'auto-deliver-orders');
END $$;

SELECT cron.schedule(
  'run-auto-deliver',
  '* * * * *',
  $$SELECT public.run_auto_deliver();$$
);