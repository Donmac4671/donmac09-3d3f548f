import { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, networks } from "@/lib/data";
import { Store, TrendingUp, Wallet, Share2, Copy, Save, Percent, ExternalLink, ArrowDownToLine } from "lucide-react";

interface ResellerStore {
  id: string;
  user_id: string;
  slug: string;
  full_name: string;
  whatsapp: string;
  store_message: string;
  available_profit: number;
  lifetime_profit: number;
  is_active: boolean;
}

const MARKUP_KINDS = [
  { key: "airtime", label: "Airtime" },
  { key: "mashup", label: "Mashup" },
  { key: "vs", label: "Telecel V+D+S" },
] as const;

export default function MyStore() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<ResellerStore | null>(null);
  const [profile, setProfile] = useState({ full_name: "", whatsapp: "", store_message: "" });
  const [markups, setMarkups] = useState<Record<string, number>>({ airtime: 0, mashup: 0, vs: 0 });
  const [prices, setPrices] = useState<Record<string, number>>({}); // key: `${networkId}|${bundle}`
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdraw, setWithdraw] = useState({ amount: "", momo_number: "", momo_name: "", network: "MTN" });
  const [requests, setRequests] = useState<any[]>([]);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    const { data: s } = await supabase.from("reseller_stores").select("*").eq("user_id", user.id).maybeSingle();
    if (!s) { setStore(null); setLoading(false); return; }
    setStore(s as any);
    setProfile({ full_name: s.full_name || "", whatsapp: s.whatsapp || "", store_message: s.store_message || "" });

    const { data: mk } = await supabase.from("reseller_markups").select("*").eq("store_id", s.id);
    const mkMap: Record<string, number> = { airtime: 0, mashup: 0, vs: 0 };
    (mk || []).forEach((r: any) => { mkMap[r.kind] = Number(r.percent) || 0; });
    setMarkups(mkMap);

    const { data: pr } = await supabase.from("reseller_bundle_prices").select("*").eq("store_id", s.id);
    const prMap: Record<string, number> = {};
    (pr || []).forEach((r: any) => { prMap[`${r.network_id}|${r.bundle_size}`] = Number(r.price); });
    setPrices(prMap);

    const { data: rq } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setRequests(rq || []);
    setLoading(false);
  };

  useEffect(() => { void loadAll(); /* eslint-disable-next-line */ }, [user?.id]);

  const storeUrl = useMemo(() => {
    if (!store) return "";
    return `${window.location.origin}/${store.slug}`;
  }, [store]);

  const saveProfile = async () => {
    if (!store) return;
    const { error } = await supabase.from("reseller_stores").update({
      full_name: profile.full_name,
      whatsapp: profile.whatsapp,
      store_message: profile.store_message,
    }).eq("id", store.id);
    if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
    toast({ title: "Saved", description: "Store profile updated." });
    void loadAll();
  };

  const saveMarkups = async () => {
    if (!store) return;
    for (const k of MARKUP_KINDS) {
      const pct = Number(markups[k.key]) || 0;
      const { error } = await supabase.from("reseller_markups").upsert(
        { store_id: store.id, kind: k.key, percent: pct },
        { onConflict: "store_id,kind" }
      );
      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
        return;
      }
    }
    toast({ title: "Saved", description: "Markups updated." });
  };

  const savePrice = async (networkId: string, bundleSize: string, price: number) => {
    if (!store) return;
    const { error } = await supabase.from("reseller_bundle_prices").upsert(
      { store_id: store.id, network_id: networkId, bundle_size: bundleSize, price },
      { onConflict: "store_id,network_id,bundle_size" }
    );
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    setPrices((p) => ({ ...p, [`${networkId}|${bundleSize}`]: price }));
    toast({ title: "Price updated" });
  };

  const submitWithdraw = async () => {
    const amt = Number(withdraw.amount);
    if (!amt || amt < 30) return toast({ title: "Minimum ₵30", variant: "destructive" });
    const { error } = await supabase.rpc("request_withdrawal", {
      p_amount: amt,
      p_momo_number: withdraw.momo_number,
      p_momo_name: withdraw.momo_name,
      p_network: withdraw.network,
    });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Request submitted", description: "Awaiting admin approval." });
    setWithdrawOpen(false);
    setWithdraw({ amount: "", momo_number: "", momo_name: "", network: "MTN" });
    void loadAll();
  };

  const copyLink = () => {
    void navigator.clipboard.writeText(storeUrl);
    toast({ title: "Copied", description: "Store link copied to clipboard." });
  };

  if (loading) {
    return (
      <DashboardLayout title="My Store">
        <div className="p-6">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!store) {
    return <CreateStoreOnboarding onCreated={loadAll} />;
  }

  const canWithdraw = Number(store.available_profit) >= 30;

  return (
    <DashboardLayout title="My Store">
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
        {/* Profit cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5 gradient-primary text-primary-foreground">
            <div className="flex items-center gap-2 mb-1 opacity-90"><Wallet className="w-4 h-4" /><span className="text-xs font-semibold">Available Profit</span></div>
            <p className="text-3xl font-extrabold">{formatCurrency(Number(store.available_profit))}</p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3 font-semibold"
              onClick={() => setWithdrawOpen(true)}
            >
              <ArrowDownToLine className="w-4 h-4 mr-1" /> Request Withdrawal
            </Button>
            {!canWithdraw && (
              <p className="text-xs opacity-90 mt-1">Minimum ₵30 required to withdraw.</p>
            )}
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground"><TrendingUp className="w-4 h-4" /><span className="text-xs font-semibold">Lifetime Profit</span></div>
            <p className="text-3xl font-extrabold text-foreground">{formatCurrency(Number(store.lifetime_profit))}</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground"><Share2 className="w-4 h-4" /><span className="text-xs font-semibold">Store Link</span></div>
            <p className="text-sm font-mono break-all text-foreground mb-2">{storeUrl}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyLink}><Copy className="w-4 h-4 mr-1" />Copy</Button>
              <Button size="sm" variant="outline" asChild><a href={storeUrl} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4 mr-1" />Open</a></Button>
            </div>
          </Card>
        </div>

        <Tabs defaultValue="profile">
          <TabsList className="grid w-full grid-cols-3 max-w-2xl">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="prices">Bundle Prices</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          </TabsList>

          {/* Profile */}
          <TabsContent value="profile">
            <Card className="p-5 space-y-4 max-w-2xl">
              <div>
                <label className="text-sm font-semibold">Slug (link)</label>
                <Input value={store.slug} disabled className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Contact admin to change your slug.</p>
              </div>
              <div>
                <label className="text-sm font-semibold">Full Name</label>
                <Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-semibold">WhatsApp Number</label>
                <Input value={profile.whatsapp} onChange={(e) => setProfile({ ...profile, whatsapp: e.target.value })} placeholder="0549358359" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-semibold">Store Message</label>
                <Textarea value={profile.store_message} onChange={(e) => setProfile({ ...profile, store_message: e.target.value })} placeholder="Welcome to my store..." rows={3} className="mt-1" />
              </div>
              <Button onClick={saveProfile} className="gradient-primary border-0"><Save className="w-4 h-4 mr-2" />Save Profile</Button>
            </Card>
          </TabsContent>


          {/* Bundle prices */}
          <TabsContent value="prices">
            <Card className="p-5">
              <p className="text-sm text-muted-foreground mb-4">
                Override prices for data bundles. Your profit per order = (your price − base price).
                Leave blank to use the base price.
              </p>
              <div className="grid gap-6 lg:grid-cols-2">
                {networks.map((net) => (
                  <div key={net.id}>
                    <h3 className="font-bold mb-2">{net.name}</h3>
                    <div className="space-y-2">
                      {net.bundles.map((b) => {
                        const key = `${net.id}|${b.size}`;
                        const current = prices[key];
                        return (
                          <div key={b.size} className="flex items-center gap-2">
                            <span className="text-sm font-medium w-16">{b.size}</span>
                            <span className="text-xs text-muted-foreground w-20">Base {formatCurrency(b.price)}</span>
                            <Input
                              type="number"
                              step="0.01"
                              min={b.price}
                              defaultValue={current ?? ""}
                              placeholder={b.price.toFixed(2)}
                              onBlur={(e) => {
                                const v = Number(e.target.value);
                                if (!v || v === current) return;
                                if (v < b.price) {
                                  toast({ title: "Too low", description: `Min ${formatCurrency(b.price)}`, variant: "destructive" });
                                  e.target.value = String(current ?? "");
                                  return;
                                }
                                void savePrice(net.id, b.size, v);
                              }}
                              className="flex-1"
                            />
                            {current && current > b.price && (
                              <Badge variant="secondary" className="text-xs">+{formatCurrency(current - b.price)}</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Withdrawals */}
          <TabsContent value="withdrawals">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Withdrawal History</h3>
                <Button size="sm" onClick={() => setWithdrawOpen(true)} className="gradient-primary border-0">
                  <ArrowDownToLine className="w-4 h-4 mr-1" />New Request
                </Button>
              </div>
              {requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No withdrawal requests yet.</p>
              ) : (
                <div className="space-y-2">
                  {requests.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                      <div>
                        <p className="font-semibold">{formatCurrency(Number(r.amount))} → {r.network} {r.momo_number}</p>
                        <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                      </div>
                      <Badge variant={r.status === "paid" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                        {r.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Withdraw dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
            <DialogDescription className="sr-only">Submit a request to withdraw your earned profit</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold">Amount (₵)</label>
              <Input type="number" min="30" step="0.01" value={withdraw.amount} onChange={(e) => setWithdraw({ ...withdraw, amount: e.target.value })} placeholder="Min ₵30" />
              <p className="text-xs text-muted-foreground mt-1">Available: {formatCurrency(Number(store.available_profit))}</p>
            </div>
            <div>
              <label className="text-sm font-semibold">Network</label>
              <Select value={withdraw.network} onValueChange={(v) => setWithdraw({ ...withdraw, network: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MTN">MTN</SelectItem>
                  <SelectItem value="Telecel">Telecel</SelectItem>
                  <SelectItem value="AirtelTigo">AirtelTigo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold">MoMo Number</label>
              <Input value={withdraw.momo_number} onChange={(e) => setWithdraw({ ...withdraw, momo_number: e.target.value })} placeholder="0549358359" />
            </div>
            <div>
              <label className="text-sm font-semibold">MoMo Name</label>
              <Input value={withdraw.momo_name} onChange={(e) => setWithdraw({ ...withdraw, momo_name: e.target.value })} placeholder="Account holder name" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button onClick={submitWithdraw} className="gradient-primary border-0">Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function CreateStoreOnboarding({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ slug: "", full_name: "", whatsapp: "", store_message: "" });

  const cleanSlug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/(^-+|-+$)/g, "");

  const submit = async () => {
    const slug = cleanSlug(form.slug);
    if (slug.length < 3) return toast({ title: "Slug too short", description: "Use at least 3 letters/numbers.", variant: "destructive" });
    if (!form.full_name.trim()) return toast({ title: "Add your store name", variant: "destructive" });
    if (!/^\d{10}$/.test(form.whatsapp)) return toast({ title: "WhatsApp must be 10 digits", variant: "destructive" });

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("create_my_store", {
        p_slug: slug,
        p_full_name: form.full_name.trim(),
        p_whatsapp: form.whatsapp.trim(),
        p_store_message: form.store_message.trim(),
      });
      if (error) {
        toast({ title: "Could not create store", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Store created!", description: "Your storefront is live." });
      onCreated();
    } catch (e: any) {
      toast({ title: "Could not create store", description: e?.message || "Unexpected error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const previewUrl = form.slug ? `${window.location.origin}/${cleanSlug(form.slug)}` : "";

  return (
    <DashboardLayout title="Create Your Store">
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <Card className="p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-3">
              <Store className="w-7 h-7 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-bold">Welcome, reseller!</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Set up your storefront in a few seconds. You can update everything later.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold">Store URL slug</label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="e.g. kojo-data"
                className="mt-1"
                style={{ fontSize: 16 }}
              />
              {previewUrl && (
                <p className="text-xs text-muted-foreground mt-1 break-all">Your link: <span className="font-mono">{previewUrl}</span></p>
              )}
            </div>
            <div>
              <label className="text-sm font-semibold">Store / Business Name</label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="e.g. Kojo Data Hub"
                className="mt-1"
                style={{ fontSize: 16 }}
              />
            </div>
            <div>
              <label className="text-sm font-semibold">WhatsApp Number</label>
              <Input
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                placeholder="0549358359"
                inputMode="numeric"
                className="mt-1"
                style={{ fontSize: 16 }}
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Welcome Message <span className="text-xs text-muted-foreground font-normal">(shown on your store)</span></label>
              <Textarea
                value={form.store_message}
                onChange={(e) => setForm({ ...form, store_message: e.target.value })}
                placeholder="Welcome! Order any data bundle — fast delivery, low prices."
                rows={3}
                className="mt-1"
                style={{ fontSize: 16 }}
              />
            </div>
            <Button onClick={submit} disabled={submitting} className="w-full gradient-primary border-0" size="lg">
              {submitting ? "Creating..." : "Create My Store"}
            </Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
