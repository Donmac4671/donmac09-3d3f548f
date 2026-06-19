import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const STOREFRONT_KEY = "donmac_store_slug";

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
  const checkRef = useRef(false);

  useEffect(() => {
    // Don't run if still loading, no user, or no profile
    if (loading || !user || !profile) return;
    
    // Prevent multiple executions
    if (actedRef.current) return;

    const tier = (profile.tier || "").toLowerCase();
    const isPrivileged = isAdmin || isReseller || tier === "reseller" || tier === "agent" || tier === "admin";

    // FIXED: Check for referral in order of priority
    // 1. Check if user has a referral from AuthContext (already loaded)
    if (referredStoreSlug) {
      // User has a referral, let them stay
      return;
    }

    // 2. Check if privileged user
    if (isPrivileged) {
      return;
    }

    // 3. Check if there's a cached store slug (mid-attribution)
    try {
      if (typeof window !== "undefined" && window.localStorage.getItem(STOREFRONT_KEY)) {
        return;
      }
    } catch { /* ignore */ }

    // 4. If we get here, the user has no referral. But before signing them out,
    // let's do a final check directly in the database (in case AuthContext didn't load it yet)
    const finalCheck = async () => {
      if (checkRef.current) return;
      checkRef.current = true;

      try {
        // Check if the user has a referral in the database
        const { data: referralData, error: referralError } = await supabase
          .from("store_referrals")
          .select("store_id, reseller_stores!inner(slug)")
          .eq("user_id", user.id)
          .maybeSingle();

        // If we found a referral, don't sign them out
        if (referralData && !referralError) {
          // The referral exists but wasn't loaded by AuthContext yet
          // Refresh the profile to load it
          return;
        }

        // Also check if the user has a pending referral in localStorage
        const localSlug = localStorage.getItem(STOREFRONT_KEY);
        if (localSlug) {
          return;
        }

        // No referral found, sign them out
        actedRef.current = true;
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
      } catch (error) {
        console.error("CustomerLockout check error:", error);
      } finally {
        checkRef.current = false;
      }
    };

    // Wait a moment for AuthContext to finish loading the referral
    const timeoutId = setTimeout(() => {
      finalCheck();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [user, profile, loading, isAdmin, isReseller, referredStoreSlug, navigate, toast]);

  return null;
}
