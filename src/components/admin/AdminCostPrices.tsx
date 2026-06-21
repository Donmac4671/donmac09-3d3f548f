import { useState, useEffect } from "react";
import { networks, formatCurrency } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

interface CustomBundle {
  id: string;
  network_id: string;
  bundle_size: string;
  size_gb: number;
  agent_price: number;
  general_price: number;
  cost_price: number | null;
}

interface Row {
  networkId: string;
  size: string;
  sizeGB: number;
  agentPrice: number;
  generalPrice: number;
  costPrice: number | null;
  isCustom: boolean;
}

export default function AdminCostPrices() {
  const { toast } = useToast();
  const [customBundles, setCustomBundles] = useState<CustomBundle[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const keyOf = (n: string, s: string) => `${n}::${s}`;

  const fetchData = async () => {
    const { data } = await supabase.from("custom_bundles").select("*");
    if (data) setCustomBundles(data as any);
  };

  useEffect(() => { fetchData(); }, []);

  const getRows = (networkId: string): Row[] => {
    const network = networks.find((n) => n.id === networkId);
    if (!network) return [];
    const map = new Map<string, Row>();
    for (const b of network.bundles) {
      map.set(b.size, {
        networkId,
        size: b.size,
        sizeGB: b.sizeGB,
        agentPrice: b.price,
        generalPrice: b.generalPrice,
        costPrice: null,
        isCustom: false,
      });
    }
    for (const c of customBundles.filter((cb) => cb.network_id === networkId)) {
      map.set(c.bundle_size, {
        networkId,
        size: c.bundle_size,
        sizeGB: c.size_gb,
        agentPrice: c.agent_price,
        generalPrice: c.general_price,
        costPrice: c.cost_price,
        isCustom: true,
      });
    }
    return Array.from(map.values()).sort((a, b) => a.sizeGB - b.sizeGB);
  };

  const saveCost = async (row: Row) => {
    const k = keyOf(row.networkId, row.size);
    const raw = drafts[k];
    if (raw === undefined) return;
    const parsed = raw === "" ? null : parseFloat(raw);
    if (raw !== "" && (parsed === null || Number.isNaN(parsed) || parsed < 0)) {
      toast({ title: "Invalid", description: "Enter a valid cost price", variant: "destructive" });
      return;
    }
    setSaving(k);
    const payload = {
      network_id: row.networkId,
      bundle_size: row.size,
      size_gb: row.sizeGB,
      agent_price: row.agentPrice,
      general_price: row.generalPrice,
      cost_price: parsed,
    };
    const { error } = await supabase.from("custom_bundles").upsert(payload, { onConflict: "network_id,bundle_size" });
    setSaving(null);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Cost price saved", description: `${row.networkId.toUpperCase()} ${row.size}` });
    setDrafts((d) => { const n = { ...d }; delete n[k]; return n; });
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="font-semibold text-foreground">Cost Prices (from supplier / GHData)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          What you actually pay the supplier per bundle. Used by Analytics to compute admin profit.
          This is separate from the customer-facing Agent/General selling prices (manage those in the Bundles tab).
        </p>
      </div>

      {networks.map((network) => {
        const rows = getRows(network.id);
        return (
          <div key={network.id} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className={`${network.gradient} py-3 px-4`}>
              <h3 className="text-lg font-bold text-white">{network.name}</h3>
            </div>
            <div className="divide-y divide-border">
              {rows.map((row) => {
                const k = keyOf(row.networkId, row.size);
                const draft = drafts[k];
                const currentVal = draft !== undefined ? draft : (row.costPrice != null ? String(row.costPrice) : "");
                const dirty = draft !== undefined && draft !== (row.costPrice != null ? String(row.costPrice) : "");
                return (
                  <div key={row.size} className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap min-w-0">
                      <span className="font-semibold text-foreground w-16">{row.size}</span>
                      <span className="text-xs text-muted-foreground">
                        Selling — Agent: {formatCurrency(row.agentPrice)} · General: {formatCurrency(row.generalPrice)}
                      </span>
                      {row.costPrice == null && (
                        <Badge variant="outline" className="text-xs">No cost set</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground">₵</span>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="cost"
                          className="h-9 w-24"
                          value={currentVal}
                          onChange={(e) => setDrafts((d) => ({ ...d, [k]: e.target.value }))}
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={() => saveCost(row)}
                        disabled={!dirty || saving === k}
                        className="gap-1"
                      >
                        <Save className="w-4 h-4" /> Save
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
