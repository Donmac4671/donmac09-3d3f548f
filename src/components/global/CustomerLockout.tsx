import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const STOREFRONT_KEY = "donmac_store_slug";

export default function CustomerLockout() {
  const { user, profile, loading, isAdmin, isReseller, referredStoreSlug } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const actedRef = useRef(false);
  const checkRef = useRef(false);

  useEffect(() => {
    if (loading || !user || !profile) return;
    if (actedRef.current) return;

    const tier = (profile.tier || "").toLowerCase();
    const isPrivileged = isAdmin || isReseller || tier === "reseller" || tier === "agent" || tier === "admin";

    // Allow privileged users
    if (isPrivileged) return;

    // If user already has a referral, allow them
    if (referredStoreSlug) {
      return;
    }

    // Check if there's a pending referral in localStorage or sessionStorage
    const pendingSlug = localStorage.getItem(STOREFRONT_KEY) || sessionStorage.getItem("redirect_to_store");
    if (pendingSlug) {
      // Wait a moment for the referral to be processed
      const timeoutId = setTimeout(() => {
        // Check again after delay
        if (!actedRef.current) {
          // If still no referral after waiting, do a direct database check
          verifyReferral();
        }
      }, 3000);
      return () => clearTimeout(timeoutId);
    }

    // No pending referral, check database directly
    verifyReferral();

  }, [user, profile, loading, isAdmin, isReseller, referredStoreSlug, navigate, toast]);

  const verifyReferral = async () => {
    if (checkRef.current) return;
    if (actedRef.current) return;
    
    checkRef.current = true;

    try {
      // Check if user has a referral in the database
      const { data: referralData, error: referralError } = await supabase
        .from("store_referrals")
        .select("store_id")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (referralData && !referralError) {
        // User has a referral, let them stay
        checkRef.current = false;
        return;
      }

      // Also check if user has a profile tier that's not customer
      if (profile?.tier === "reseller" || profile?.tier === "agent" || profile?.tier === "admin") {
        checkRef.current = false;
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
      console.error("CustomerLockout verification error:", error);
    } finally {
      checkRef.current = false;
    }
  };

  return null;
}
