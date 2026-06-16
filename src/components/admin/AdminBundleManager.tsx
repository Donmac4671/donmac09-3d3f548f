import { useState, useEffect, useMemo } from "react";
import { networks, formatCurrency } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2 } from "lucide-react";

interface CustomBundle {
  id: string;
  network_id: string;
  bundle_size: string;
  size_gb: number;
  agent_price: number;
  general_price: number;
}

export default function AdminBundleManager() {
  const { toast } = useToast();
  // Map of bundle key -> "hidden" | "offline" (absent = online)
  const [statusMap, setStatusMap] = useState<Map<string, "hidden" | "offline">>(new Map());
  const [customBundles, setCustomBundles] = useState<CustomBundle[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingBundle, setEditingBundle] = useState<{ networkId: string; size: string } | null>(null);
  const [formNetworkId, setFormNetworkId] = useState("");
  const [formSize, setFormSize] = useState("");
  const [formSizeGB, setFormSizeGB] = useState("");
  const [formAgentPrice, setFormAgentPrice] = useState("");
  const [formGeneralPrice, setFormGeneralPrice] = useState("");

  const makeKey = (networkId: string, bundleSize: string) => `${networkId}::${bundleSize}`;

  const fetchData = async () => {
    const [{ data: hidden }, { data: custom }] = await Promise.all([
      supabase.from("hidden_bundles").select("network_id, bundle_size, status"),
      supabase.from("custom_bundles").select("*"),
    ]);
    if (hidden) {
      const m = new Map<string, "hidden" | "offline">();
      for (const r of hidden as any[]) {
        m.set(makeKey(r.network_id, r.bundle_size), (r.status ?? "hidden") as any);
      }
      setStatusMap(m);
    }
    if (custom) setCustomBundles(custom as any);
  };

  useEffect(() => { fetchData(); }, []);

  const getMergedBundles = (networkId: string) => {
    const network = networks.find((n) => n.id === networkId);
    if (!network) return [];

    const bundleMap = new Map<string, { size: string; sizeGB: number; agentPrice: number; generalPrice: number; isCustom: boolean }>();

    for (const b of network.bundles) {
      bundleMap.set(b.size, { size: b.size, sizeGB: b.sizeGB, agentPrice: b.price, generalPrice: b.generalPrice, isCustom: false });
    }

    for (const c of customBundles.filter((cb) => cb.network_id === networkId)) {
      bundleMap.set(c.bundle_size, { size: c.bundle_size, sizeGB: c.size_gb, agentPrice: c.agent_price, generalPrice: c.general_price, isCustom: true });
    }

    return Array.from(bundleMap.values()).sort((a, b) => a.sizeGB - b.sizeGB);
  };

  const setBundleStatus = async (networkId: string, bundleSize: string, target: "online" | "offline" | "hidden") => {
    const key = makeKey(networkId, bundleSize);
    setLoading(key);
    try {
      if (target === "online") {
        await supabase.from("hidden_bundles").delete().eq("network_id", networkId).eq("bundle_size", bundleSize);
        setStatusMap((prev) => { const n = new Map(prev); n.delete(key); return n; });
      } else {
        // upsert
        const existing = statusMap.has(key);
        if (existing) {
          await supabase.from("hidden_bundles").update({ status: target }).eq("network_id", networkId).eq("bundle_size", bundleSize);
        } else {
          await supabase.from("hidden_bundles").insert({ network_id: networkId, bundle_size: bundleSize, status: target });
        }
        setStatusMap((prev) => { const n = new Map(prev); n.set(key, target); return n; });
      }
      toast({ title: target === "online" ? "Bundle online" : target === "offline" ? "Bundle marked offline" : "Bundle hidden" });
    } finally {
      setLoading(null);
    }
  };

  const openAddDialog = (networkId: string) => {
    setEditingBundle(null);
    setFormNetworkId(networkId);
    setFormSize("");
    setFormSizeGB("");
    setFormAgentPrice("");
    setFormGeneralPrice("");
    setShowDialog(true);
  };

  const openEditDialog = (networkId: string, bundle: { size: string; sizeGB: number; agentPrice: number; generalPrice: number }) => {
    setEditingBundle({ networkId, size: bundle.size });
    setFormNetworkId(networkId);
    setFormSize(bundle.size);
    setFormSizeGB(bundle.sizeGB.toString());
    setFormAgentPrice(bundle.agentPrice.toString());
    setFormGeneralPrice(bundle.generalPrice.toString());
    setShowDialog(true);
  };

  const handleSaveBundle = async () => {
    if (!formSize || !formSizeGB || !formAgentPrice || !formGeneralPrice || !formNetworkId) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" });
      return;
    }

    const payload = {
      network_id: formNetworkId,
      bundle_size: formSize,
      size_gb: parseFloat(formSizeGB),
      agent_price: parseFloat(formAgentPrice),
      general_price: parseFloat(formGeneralPrice),
    };

    if (editingBundle) {
      // Check if a custom bundle exists for this network+size
      const existing = customBundles.find((c) => c.network_id === formNetworkId && c.bundle_size === editingBundle.size);
      if (existing) {
        const { error } = await supabase.from("custom_bundles").update(payload).eq("id", existing.id);
        if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      } else {
        const { error } = await supabase.from("custom_bundles").upsert(payload, { onConflict: "network_id,bundle_size" });
        if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      }
      toast({ title: "Bundle Updated" });
    } else {
      const { error } = await supabase.from("custom_bundles").upsert(payload, { onConflict: "network_id,bundle_size" });
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Bundle Added", description: `${formSize} added to ${formNetworkId.toUpperCase()}` });
    }

    setShowDialog(false);
    fetchData();
  };

  const handleDeleteBundle = async (networkId: string, bundleSize: string) => {
    // Delete custom bundle if exists
    const existing = customBundles.find((c) => c.network_id === networkId && c.bundle_size === bundleSize);
    if (existing) {
      await supabase.from("custom_bundles").delete().eq("id", existing.id);
    }
    // Also hide it
    await supabase.from("hidden_bundles").insert({ network_id: networkId, bundle_size: bundleSize }).select();
    toast({ title: "Bundle Deleted" });
    fetchData();
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Manage bundles: toggle visibility, add new packages, edit prices, or delete bundles.
      </p>
      {networks.map((network) => {
        const bundles = getMergedBundles(network.id);
        return (
          <div key={network.id} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className={`${network.gradient} py-3 px-4 flex items-center justify-between`}>
              <h3 className="text-lg font-bold text-white">{network.name}</h3>
              <Button size="sm" variant="secondary" onClick={() => openAddDialog(network.id)} className="gap-1">
                <Plus className="w-4 h-4" /> Add Bundle
              </Button>
            </div>
            <div className="divide-y divide-border">
              {bundles.map((bundle) => {
                const key = makeKey(network.id, bundle.size);
                const isHidden = hiddenBundles.has(key);
                const isLoading = loading === key;
                return (
                  <div key={bundle.size} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-foreground w-16">{bundle.size}</span>
                      <span className="text-sm text-muted-foreground">
                        Agent: {formatCurrency(bundle.agentPrice)} · General: {formatCurrency(bundle.generalPrice)}
                      </span>
                      {isHidden && <Badge variant="outline" className="bg-destructive/10 text-destructive text-xs">Hidden</Badge>}
                      {bundle.isCustom && <Badge variant="outline" className="bg-primary/10 text-primary text-xs">Custom</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEditDialog(network.id, bundle)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteBundle(network.id, bundle.size)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Switch checked={!isHidden} onCheckedChange={() => toggleBundle(network.id, bundle.size)} disabled={isLoading} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <Dialog open={showDialog} onOpenChange={() => setShowDialog(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBundle ? "Edit" : "Add"} Bundle — {formNetworkId.toUpperCase()}</DialogTitle>
            <DialogDescription className="sr-only">Form to {editingBundle ? "edit existing" : "add a new"} data bundle</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Bundle Size (e.g. "25GB")</label>
              <Input
                placeholder='e.g. 25GB'
                value={formSize}
                onChange={(e) => setFormSize(e.target.value)}
                disabled={!!editingBundle}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Size in GB (number)</label>
              <Input
                type="number"
                placeholder="e.g. 25"
                value={formSizeGB}
                onChange={(e) => setFormSizeGB(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Agent Price (₵)</label>
                <Input
                  type="number"
                  placeholder="e.g. 100"
                  value={formAgentPrice}
                  onChange={(e) => setFormAgentPrice(e.target.value)}
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">General Price (₵)</label>
                <Input
                  type="number"
                  placeholder="e.g. 105"
                  value={formGeneralPrice}
                  onChange={(e) => setFormGeneralPrice(e.target.value)}
                  step="0.01"
                />
              </div>
            </div>
            <Button className="w-full gradient-primary border-0" onClick={handleSaveBundle}>
              {editingBundle ? "Update" : "Add"} Bundle
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
