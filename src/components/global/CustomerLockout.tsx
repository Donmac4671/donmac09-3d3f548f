import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Customers (tier 'customer' or 'general') are NOT allowed to use the main
 * Donmac Data Hub site directly. They must sign in through their reseller's
 * storefront URL so they see the reseller's pricing.
 *
 * If such a customer ends up signed in without an attached reseller
 * storefront, sign them out immediately and direct them to the landing page.
 */
export default function CustomerLockout() {
  const { user, profile, loading, isAdmin, isReseller, referredStoreSlug } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const actedRef = useRef(false);

  useEffect(() => {
    if (loading || !user || !profile) return;
    if (actedRef.current) return;

    const tier = (profile.tier || "").toLowerCase();
    const isPrivileged = isAdmin || isReseller || tier === "reseller" || tier === "agent" || tier === "admin";

    if (isPrivileged) return;
    if (referredStoreSlug) return; // they have a reseller, handled by routing

    actedRef.current = true;
    void (async () => {
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
      toast({
        title: "Use your reseller's link",
        description: "Customer accounts must sign in through their reseller's storefront link, not the main site.",
        variant: "destructive",
      });
      navigate("/", { replace: true });
    })();
  }, [user, profile, loading, isAdmin, isReseller, referredStoreSlug, navigate, toast]);

  return null;
}
