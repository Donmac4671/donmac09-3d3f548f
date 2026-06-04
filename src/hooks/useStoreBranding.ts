import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StoreBrand {
  slug: string;
  full_name: string;
  whatsapp: string;
}

/** Reads donmac_store_slug from localStorage and returns the matching active store. */
export function useStoreBranding(): StoreBrand | null {
  const [store, setStore] = useState<StoreBrand | null>(null);

  useEffect(() => {
    let cancelled = false;
    const slug = typeof window !== "undefined" ? window.localStorage.getItem("donmac_store_slug") : null;
    if (!slug) return;
    (async () => {
      const { data } = await supabase
        .from("reseller_stores")
        .select("slug, full_name, whatsapp")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (!cancelled && data) setStore(data as StoreBrand);
    })();
    return () => { cancelled = true; };
  }, []);

  return store;
}
