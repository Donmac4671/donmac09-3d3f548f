import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useResellerPrices() {
  const { referredStoreId } = useAuth();
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [markups, setMarkups] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!referredStoreId) {
      setOverrides({});
      setMarkups({});
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      const [pricesRes, markupsRes] = await Promise.all([
        supabase.from("reseller_bundle_prices").select("network_id, bundle_size, price").eq("store_id", referredStoreId),
        supabase.from("reseller_markups").select("kind, percent").eq("store_id", referredStoreId)
      ]);

      if (pricesRes.data) {
        const pMap: Record<string, number> = {};
        pricesRes.data.forEach((r) => {
          pMap[`${r.network_id}|${r.bundle_size}`] = Number(r.price);
        });
        setOverrides(pMap);
      }

      if (markupsRes.data) {
        const mMap: Record<string, number> = {};
        markupsRes.data.forEach((r) => {
          mMap[r.kind] = Number(r.percent);
        });
        setMarkups(mMap);
      }
      setLoading(false);
    };

    void fetchData();
  }, [referredStoreId]);

  const getResellerPrice = (networkId: string, bundleSize: string, basePrice: number) => {
    const key = `${networkId}|${bundleSize}`;
    return overrides[key] ?? basePrice;
  };

  const getMarkupPrice = (kind: "airtime" | "mashup" | "vs", basePrice: number) => {
    const pct = markups[kind] || 0;
    if (pct <= 0) return basePrice;
    return basePrice * (1 + pct / 100);
  };

  return { getResellerPrice, getMarkupPrice, loading };
}
