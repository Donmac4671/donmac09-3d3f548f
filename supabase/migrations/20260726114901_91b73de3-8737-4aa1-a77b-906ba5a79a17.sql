CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  actor_is_admin boolean NOT NULL DEFAULT false,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id text,
  target_user_id uuid,
  summary text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;
CREATE POLICY "Admins can read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_table_idx ON public.audit_logs (table_name);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON public.audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_target_idx ON public.audit_logs (target_user_id);

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text;
  v_is_admin boolean := false;
  v_row jsonb;
  v_old jsonb;
  v_action text;
  v_target uuid;
  v_summary text;
  v_record_id text;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_old := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  v_action := lower(TG_OP);

  IF v_actor IS NOT NULL THEN
    SELECT email INTO v_email FROM public.profiles WHERE user_id = v_actor;
    v_is_admin := public.has_role(v_actor, 'admin'::public.app_role);
  END IF;

  v_record_id := COALESCE(v_row->>'id', v_row->>'user_id');
  v_target := NULLIF(v_row->>'user_id','')::uuid;

  IF TG_TABLE_NAME = 'orders' THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        v_summary := 'Order ' || COALESCE(NEW.order_ref,'') || ' status ' || COALESCE(OLD.status,'') || ' -> ' || COALESCE(NEW.status,'');
      ELSE
        RETURN COALESCE(NEW, OLD);
      END IF;
    ELSIF TG_OP = 'INSERT' THEN
      v_summary := 'Order ' || COALESCE(NEW.order_ref,'') || ' created: ' || COALESCE(NEW.network,'') || ' ' || COALESCE(NEW.bundle_size,'') || ' ₵' || COALESCE(NEW.amount,0)::text;
    ELSE
      v_summary := 'Order ' || COALESCE(OLD.order_ref,'') || ' deleted';
    END IF;

  ELSIF TG_TABLE_NAME = 'transactions' THEN
    IF TG_OP <> 'INSERT' THEN RETURN COALESCE(NEW, OLD); END IF;
    v_summary := COALESCE(NEW.type,'') || ' ₵' || COALESCE(NEW.amount,0)::text || ' — ' || COALESCE(NEW.description,'');

  ELSIF TG_TABLE_NAME = 'profiles' THEN
    IF TG_OP = 'UPDATE' THEN
      v_summary := '';
      IF NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance THEN
        v_summary := v_summary || 'wallet ₵' || COALESCE(OLD.wallet_balance,0)::text || ' -> ₵' || COALESCE(NEW.wallet_balance,0)::text || '; ';
      END IF;
      IF NEW.tier IS DISTINCT FROM OLD.tier THEN
        v_summary := v_summary || 'tier ' || COALESCE(OLD.tier,'') || ' -> ' || COALESCE(NEW.tier,'') || '; ';
      END IF;
      IF NEW.is_blocked IS DISTINCT FROM OLD.is_blocked THEN
        v_summary := v_summary || CASE WHEN NEW.is_blocked THEN 'account blocked' ELSE 'account unblocked' END || '; ';
      END IF;
      IF NEW.phone IS DISTINCT FROM OLD.phone THEN
        v_summary := v_summary || 'phone updated; ';
      END IF;
      IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
        v_summary := v_summary || 'name updated; ';
      END IF;
      IF v_summary = '' THEN RETURN NEW; END IF;
      v_summary := COALESCE(NEW.email,'user') || ': ' || v_summary;
    ELSIF TG_OP = 'INSERT' THEN
      v_summary := 'New account ' || COALESCE(NEW.email,'');
    ELSE
      v_summary := 'Account deleted ' || COALESCE(OLD.email,'');
    END IF;

  ELSIF TG_TABLE_NAME = 'withdrawal_requests' THEN
    v_summary := 'Withdrawal ₵' || COALESCE(v_row->>'amount','') || ' status ' || COALESCE(v_row->>'status','');

  ELSIF TG_TABLE_NAME IN ('wallet_topups','verified_topups') THEN
    v_summary := TG_TABLE_NAME || ' ₵' || COALESCE(v_row->>'amount','') || ' ' || COALESCE(v_row->>'status', CASE WHEN (v_row->>'is_claimed')::boolean THEN 'claimed' ELSE 'unclaimed' END, '');
    v_target := COALESCE(v_target, NULLIF(v_row->>'claimed_by','')::uuid);

  ELSIF TG_TABLE_NAME = 'user_roles' THEN
    v_summary := 'Role ' || COALESCE(v_row->>'role','') || ' ' || CASE WHEN TG_OP = 'DELETE' THEN 'removed' ELSE 'granted' END;

  ELSIF TG_TABLE_NAME = 'custom_bundles' THEN
    v_summary := 'Bundle ' || COALESCE(v_row->>'network_id','') || ' ' || COALESCE(v_row->>'bundle_size','') || ' price ₵' || COALESCE(v_row->>'general_price','') || ' cost ₵' || COALESCE(v_row->>'cost_price','');

  ELSIF TG_TABLE_NAME = 'reseller_bundle_prices' THEN
    v_summary := 'Store price ' || COALESCE(v_row->>'network_id','') || ' ' || COALESCE(v_row->>'bundle_size','') || ' -> ₵' || COALESCE(v_row->>'price','');

  ELSIF TG_TABLE_NAME = 'reseller_stores' THEN
    v_summary := 'Store ' || COALESCE(v_row->>'slug','') || ' ' || v_action || ' (available ₵' || COALESCE(v_row->>'available_profit','') || ')';

  ELSE
    v_summary := TG_TABLE_NAME || ' ' || v_action;
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_email, actor_is_admin, action, table_name, record_id, target_user_id, summary, old_data, new_data)
  VALUES (v_actor, v_email, v_is_admin, v_action, TG_TABLE_NAME, v_record_id, v_target, v_summary, v_old,
          CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE v_row END);

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'audit_trigger failed on %: %', TG_TABLE_NAME, SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.audit_trigger() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_orders ON public.orders;
CREATE TRIGGER audit_orders AFTER INSERT OR UPDATE OR DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_transactions ON public.transactions;
CREATE TRIGGER audit_transactions AFTER INSERT ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_withdrawal_requests ON public.withdrawal_requests;
CREATE TRIGGER audit_withdrawal_requests AFTER INSERT OR UPDATE OR DELETE ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_wallet_topups ON public.wallet_topups;
CREATE TRIGGER audit_wallet_topups AFTER INSERT OR UPDATE ON public.wallet_topups FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_verified_topups ON public.verified_topups;
CREATE TRIGGER audit_verified_topups AFTER INSERT OR UPDATE ON public.verified_topups FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles AFTER INSERT OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_custom_bundles ON public.custom_bundles;
CREATE TRIGGER audit_custom_bundles AFTER INSERT OR UPDATE OR DELETE ON public.custom_bundles FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_reseller_bundle_prices ON public.reseller_bundle_prices;
CREATE TRIGGER audit_reseller_bundle_prices AFTER INSERT OR UPDATE OR DELETE ON public.reseller_bundle_prices FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_reseller_stores ON public.reseller_stores;
CREATE TRIGGER audit_reseller_stores AFTER INSERT OR UPDATE OR DELETE ON public.reseller_stores FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();