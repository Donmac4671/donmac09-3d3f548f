import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface StoreBrand {
  slug: string;
  full_name: string;
  whatsapp: string;
}

/** For logged-in users: only the referredStoreId on their profile brands the app.
 *  For anonymous visitors: fall back to the localStorage slug (set when visiting /<slug>). */
export function useStoreBranding(): StoreBrand | null {
  const [store, setStore] = useState<StoreBrand | null>(null);
  const { user, referredStoreId, isAdmin, isReseller } = useAuth();

  useEffect(() => {
    let cancelled = false;

    const fetchStore = async () => {
      // Logged-in user: brand strictly from their profile's referredStoreId.
      // Admins and resellers must NEVER be branded as another store's customer.
      if (user) {
        if (referredStoreId && !isAdmin && !isReseller) {
          const { data } = await (supabase as any)
            .from("public_reseller_stores")
            .select("slug, full_name, whatsapp")
            .eq("id", referredStoreId)
            .eq("is_active", true)
            .maybeSingle();
          if (!cancelled) setStore((data as StoreBrand) || null);
          return;
        }
        if (!cancelled) setStore(null);
        return;
      }

      // Anonymous visitor: use localStorage slug captured from /<slug> storefront.
      const slug = typeof window !== "undefined" ? window.localStorage.getItem("donmac_store_slug") : null;
      if (slug) {
        const { data } = await (supabase as any)
          .from("public_reseller_stores")
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
  }, [user, referredStoreId]);

  return store;
}
