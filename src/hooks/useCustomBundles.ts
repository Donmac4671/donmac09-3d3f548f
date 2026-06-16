import { useState, useEffect, useMemo } from "react";
import { networks, Network, DataBundle } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { useHiddenBundles } from "@/hooks/useHiddenBundles";

interface CustomBundle {
  network_id: string;
  bundle_size: string;
  size_gb: number;
  agent_price: number;
  general_price: number;
}

export function useCustomBundles() {
  const [customBundles, setCustomBundles] = useState<CustomBundle[]>([]);
  const { isHidden, isOffline } = useHiddenBundles();

  useEffect(() => {
    const fetchBundles = async () => {
      // Try the privileged table first (admins/agents). Falls back to the
      // public view (which hides agent_price) for general users.
      const { data, error } = await supabase.from("custom_bundles").select("*");
      if (!error && data && data.length > 0) {
        setCustomBundles(data as any);
        return;
      }
      const { data: pub } = await supabase.from("custom_bundles_public").select("*");
      if (pub) setCustomBundles(pub as any);
    };
    fetchBundles();
  }, []);

  const mergedNetworks = useMemo(() => {
    return networks.map((network) => {
      const customs = customBundles.filter((c) => c.network_id === network.id);
      const bundleMap = new Map<string, DataBundle>();

      // Start with hardcoded bundles
      for (const b of network.bundles) {
        bundleMap.set(b.size, { ...b });
      }

      // Override/add custom bundles
      for (const c of customs) {
        bundleMap.set(c.bundle_size, {
          size: c.bundle_size,
          sizeGB: c.size_gb,
          price: c.agent_price,
          generalPrice: c.general_price,
        });
      }

      // Sort by sizeGB, filter hidden, flag offline
      const bundles = Array.from(bundleMap.values())
        .filter((b) => !isHidden(network.id, b.size))
        .map((b) => ({ ...b, isOffline: isOffline(network.id, b.size) }))
        .sort((a, b) => a.sizeGB - b.sizeGB);

      return { ...network, bundles };
    });
  }, [customBundles, isHidden, isOffline]);

  return { networks: mergedNetworks, customBundles, refetch: async () => {
    const { data, error } = await supabase.from("custom_bundles").select("*");
    if (!error && data && data.length > 0) {
      setCustomBundles(data as any);
      return;
    }
    const { data: pub } = await supabase.from("custom_bundles_public").select("*");
    if (pub) setCustomBundles(pub as any);
  }};
}
