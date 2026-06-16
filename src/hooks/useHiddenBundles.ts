import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type Status = "hidden" | "offline";

export function useHiddenBundles() {
  const [map, setMap] = useState<Map<string, Status>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("hidden_bundles").select("network_id, bundle_size, status");
      if (data) {
        const m = new Map<string, Status>();
        for (const r of data as any[]) {
          m.set(`${r.network_id}::${r.bundle_size}`, (r.status ?? "hidden") as Status);
        }
        setMap(m);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const getStatus = (networkId: string, bundleSize: string): Status | null =>
    map.get(`${networkId}::${bundleSize}`) ?? null;

  const isHidden = (networkId: string, bundleSize: string) =>
    getStatus(networkId, bundleSize) === "hidden";

  const isOffline = (networkId: string, bundleSize: string) =>
    getStatus(networkId, bundleSize) === "offline";

  return { isHidden, isOffline, getStatus, loading };
}
