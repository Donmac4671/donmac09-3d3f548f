import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface StoreBrand {
  slug: string;
  full_name: string;
  whatsapp: string;
}

/** Reads from referredStoreId (if logged in) or localStorage and returns the matching active store. */
export function useStoreBranding(): StoreBrand | null {
  const [store, setStore] = useState<StoreBrand | null>(null);
  const { referredStoreId } = useAuth();

  useEffect(() => {
    let cancelled = false;

    const fetchStore = async () => {
      // Priority 1: Logged in user's referral store
      if (referredStoreId) {
        const { data } = await supabase
          .from("reseller_stores")
          .select("slug, full_name, whatsapp")
          .eq("id", referredStoreId)
          .eq("is_active", true)
          .maybeSingle();

        if (!cancelled && data) {
          setStore(data as StoreBrand);
          return;
        }
      }

      // Priority 2: localStorage slug
      const slug = typeof window !== "undefined" ? window.localStorage.getItem("donmac_store_slug") : null;
      if (slug) {
        const { data } = await supabase
          .from("reseller_stores")
          .select("slug, full_name, whatsapp")
          .eq("slug", slug)
          .eq("is_active", true)
          .maybeSingle();
        if (!cancelled && data) {
          setStore(data as StoreBrand);
          return;
        }
      }

      if (!cancelled) setStore(null);
    };

    fetchStore();
    return () => { cancelled = true; };
  }, [referredStoreId]);

  return store;
}
