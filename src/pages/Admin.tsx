import { useState, useEffect, useMemo, useCallback, useDeferredValue } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/data";
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { Users, ShoppingBag, Ban, DollarSign, Trash2, MessageSquare, MessageCircle, Search, CalendarIcon, BarChart3, Crown, Wifi, Percent, Shield, Hash, Megaphone, Copy, RotateCcw, RefreshCw, Store, ArrowDownToLine } from "lucide-react";
import AdminAnalytics from "@/components/admin/AdminAnalytics";
import AdminBundleManager from "@/components/admin/AdminBundleManager";
import AdminPromoManager from "@/components/admin/AdminPromoManager";
import AdminVerifiedTopups from "@/components/admin/AdminVerifiedTopups";
import AdminSiteMessage from "@/components/admin/AdminSiteMessage";
import AdminBroadcast from "@/components/admin/AdminBroadcast";
import AdminLiveChat from "@/components/admin/AdminLiveChat";
import AdminMonthlyRankings from "@/components/admin/AdminMonthlyRankings";
import AdminResellers from "@/components/admin/AdminResellers";
import AdminWithdrawals from "@/components/admin/AdminWithdrawals";
import { Switch } from "@/components/ui/switch";
import { useProductToggles } from "@/hooks/useProductToggles";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export default function Admin() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { mashupEnabled, airtimeEnabled, vsEnabled, refresh: refreshToggles } = useProductToggles();

  const handleToggleProduct = async (key: "mashup_enabled" | "airtime_enabled" | "vs_enabled", value: boolean) => {
    const { error } = await supabase.from("app_settings").upsert({ key, value: value as any }, { onConflict: "key" });
    if (error) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
      return;
    }
    const labels: Record<string, string> = { mashup_enabled: "MashUp", airtime_enabled: "Airtime", vs_enabled: "Telecel V+D+S" };
    toast({ title: "Updated", description: `${labels[key]} ${value ? "enabled" : "disabled"}` });
    refreshToggles();
  };

  const getInitialTab = () => {
    const hash = window.location.hash.replace("#", "");
    const validTabs = ["analytics", "users", "orders", "verified-id", "complaints", "bundles", "promos", "site-message", "broadcast", "live-chat", "rankings", "resellers", "withdrawals"];
    return validTabs.includes(hash) ? hash : "analytics";
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    window.location.hash = value;
  }, []);

  useEffect(() => {
    const onHashChange = () => setActiveTab(getInitialTab());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const [users, setUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [topups, setTopups] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [walletDialog, setWalletDialog] = useState<{ user: any; type: "credit" | "debit" } | null>(null);
  const [walletAmount, setWalletAmount] = useState("");
  const [walletDesc, setWalletDesc] = useState("");
  const [replyDialog, setReplyDialog] = useState<any | null>(null);
  const [replyText, setReplyText] = useState("");
  const [adminUserIds, setAdminUserIds] = useState<Set<string>>(new Set());
  const [autoDeliverMinutes, setAutoDeliverMinutes] = useState<string>("manual");

  // Filters
  const [userSearch, setUserSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderPhoneSearch, setOrderPhoneSearch] = useState("");
  const deferredOrderPhoneSearch = useDeferredValue(orderPhoneSearch);
  const [orderNetworkFilter, setOrderNetworkFilter] = useState("all");
  const today = new Date();
  const [orderDateFrom, setOrderDateFrom] = useState<Date | undefined>(today);
  const [orderDateTo, setOrderDateTo] = useState<Date | undefined>(today);
  const [complaintStatusFilter, setComplaintStatusFilter] = useState("all");
  const [complaintDateFrom, setComplaintDateFrom] = useState<Date | undefined>(today);
  const [complaintDateTo, setComplaintDateTo] = useState<Date | undefined>(today);

  const fetchData = async () => {
    const [{ data: u }, { data: t }, { data: c }, { data: ur }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("wallet_topups").select("*").order("created_at", { ascending: false }),
      supabase.from("complaints").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
    ]);

    // Fetch orders in chunks of 1000 since Supabase has a default limit
    let allOrders: any[] = [];
    let from = 0;
    let to = 999;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error || !data || data.length === 0) {
        hasMore = false;
      } else {
        allOrders = [...allOrders, ...data];
        if (data.length < 1000) {
          hasMore = false;
        } else {
          from += 1000;
          to += 1000;
        }
      }
    }

    setUsers(u || []);
    setOrders(allOrders);
    setTopups(t || []);
    setComplaints(c || []);
    if (ur) {
      const admins = new Set<string>();
      (ur as any[]).forEach((r) => { if (r.role === "admin") admins.add(r.user_id); });
      setAdminUserIds(admins);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchData();
    (async () => {
      const { data } = await supabase.rpc("admin_get_auto_deliver_minutes");
      setAutoDeliverMinutes(data == null ? "manual" : String(data));
    })();

    const ordersChannel = supabase
      .channel('admin-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(ordersChannel); };
  }, [isAdmin]);

  const handleSetAutoDeliver = async (value: string) => {
    setAutoDeliverMinutes(value);
    const minutes = value === "manual" ? null : parseInt(value, 10);
    const { error } = await supabase.rpc("admin_set_auto_deliver_minutes", { p_minutes: minutes as any });
    if (error) { toast({ title: "Update Failed", description: error.message, variant: "destructive" }); return; }
    toast({
      title: "Auto-Deliver Updated",
      description: minutes ? `Orders will auto-deliver after ${minutes} min` : "Auto-deliver disabled (manual only)",
    });
  };

  // Filtered data
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.toLowerCase();
    return users.filter(u =>
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.agent_code?.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const filterByDate = (items: any[], dateFrom?: Date, dateTo?: Date) => {
    return items.filter(item => {
      const d = parseISO(item.created_at);
      if (dateFrom && isBefore(d, startOfDay(dateFrom))) return false;
      if (dateTo && isAfter(d, endOfDay(dateTo))) return false;
      return true;
    });
  };

  const filteredOrders = useMemo(() => {
    let result = orders;
    const phoneQ = deferredOrderPhoneSearch.trim();
    if (phoneQ) {
      return result.filter(o => o.phone_number?.includes(phoneQ));
    }
    if (orderStatusFilter !== "all") result = result.filter(o => o.status === orderStatusFilter);
    if (orderNetworkFilter !== "all") result = result.filter(o => (o.network || "").toLowerCase() === orderNetworkFilter.toLowerCase());
    return filterByDate(result, orderDateFrom, orderDateTo);
  }, [orders, orderStatusFilter, orderNetworkFilter, deferredOrderPhoneSearch, orderDateFrom, orderDateTo]);

  const filteredComplaints = useMemo(() => {
    let result = complaints;
    if (complaintStatusFilter !== "all") result = result.filter(c => c.status === complaintStatusFilter);
    return filterByDate(result, complaintDateFrom, complaintDateTo);
  }, [complaints, complaintStatusFilter, complaintDateFrom, complaintDateTo]);

  if (!isAdmin) {
    return (
      <DashboardLayout title="Admin">
        <div className="text-center py-20 text-muted-foreground">
          <Ban className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Access Denied</p>
        </div>
      </DashboardLayout>
    );
  }

  const handleToggleBlock = async (userId: string, block: boolean) => {
    const { error } = await supabase.rpc("admin_toggle_block", { target_user_id: userId, block_status: block });
    if (error) { toast({ title: "Action Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: block ? "User Blocked" : "User Unblocked" });
    fetchData();
  };

  const handleSetTier = async (userId: string, newTier: string) => {
    const { error } = await supabase.rpc("admin_set_user_tier", { target_user_id: userId, new_tier: newTier });
    if (error) { toast({ title: "Tier Update Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Tier Updated", description: `User set to ${newTier}` });
    fetchData();
  };

  const handleToggleAdmin = async (userId: string, makeAdmin: boolean) => {
    const { error } = await supabase.rpc("admin_toggle_admin_role", { target_user_id: userId, make_admin: makeAdmin });
    if (error) { toast({ title: "Role Update Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: makeAdmin ? "User is now Admin" : "Admin role removed" });
    fetchData();
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (!confirm(`Permanently delete account for ${name}? This removes all their orders, transactions and data. This cannot be undone.`)) return;
    const { data, error } = await supabase.functions.invoke("admin-delete-user", { body: { target_user_id: userId } });
    if (error || (data as any)?.error) {
      toast({ title: "Delete Failed", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "User Deleted", description: `${name}'s account has been removed.` });
    fetchData();
  };

  const handleWalletOp = async () => {
    if (!walletDialog || !walletAmount) return;
    const { error } = await supabase.rpc("admin_wallet_operation", {
      target_user_id: walletDialog.user.user_id,
      operation_amount: parseFloat(walletAmount),
      operation_type: walletDialog.type,
      operation_description: walletDesc || `Admin ${walletDialog.type}`,
    });
    if (error) { toast({ title: "Wallet Action Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Wallet ${walletDialog.type}ed`, description: `${formatCurrency(parseFloat(walletAmount))} ${walletDialog.type}ed` });
    setWalletDialog(null); setWalletAmount(""); setWalletDesc("");
    fetchData();
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.rpc("admin_update_order_status", { order_id: orderId, new_status: status });
    if (error) { toast({ title: "Update Failed", description: error.message, variant: "destructive" }); return; }
    const displayLabel = status === "completed" ? "delivered" : status;
    toast({ title: "Order Updated", description: `Status changed to ${displayLabel}` });
    fetchData();
  };

  const handleResyncOrder = async (orderId: string) => {
    toast({ title: "Re-syncing…", description: "Checking GHData for latest status" });
    const { data, error } = await supabase.functions.invoke("ghconnect-status", { body: { order_id: orderId } });
    if (error || !data?.success) {
      toast({ title: "Re-sync failed", description: error?.message || data?.message || "Provider did not return a status", variant: "destructive" });
      return;
    }
    toast({ title: "Re-synced", description: `Provider status: ${data.provider_status} → ${data.new_status}` });
    fetchData();
  };

  const handleDeleteOrder = async (orderId: string) => {
    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    if (error) { toast({ title: "Delete Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Order Deleted" });
    fetchData();
  };

  const handleReplyComplaint = async () => {
    if (!replyDialog || !replyText.trim()) return;
    const { error } = await supabase.from("complaints").update({ admin_reply: replyText.trim(), status: "resolved" }).eq("id", replyDialog.id);
    if (error) { toast({ title: "Reply Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Complaint replied & resolved" });
    setReplyDialog(null); setReplyText("");
    fetchData();
  };

  const handleRetryOrder = async (order: any) => {
    const bundleSizeGB = parseFloat(order.bundle_size.replace(/[^\d.]/g, ""));
    if (!bundleSizeGB) {
      toast({ title: "Retry Failed", description: "Could not parse bundle size", variant: "destructive" });
      return;
    }
    // Set back to processing first
    await supabase.rpc("admin_update_order_status", { order_id: order.id, new_status: "processing" });
    fetchData();
    toast({ title: "Retrying order...", description: `${order.network} ${order.bundle_size} to ${order.phone_number}` });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        toast({ title: "Retry Failed", description: "No active session. Please sign in again.", variant: "destructive" });
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fulfill-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ order_id: order.id, network_id: order.network, phone: order.phone_number, bundle_size_gb: bundleSizeGB }),
        }
      );

      const result = await res.json();
      console.log("Retry fulfill-order response:", res.status, JSON.stringify(result));

      if (res.status === 202 && result.status === "waiting") {
        toast({ title: "Order Waiting", description: result.message || "Provider rejected this network key; review manually." });
      } else if (!res.ok || !result.success) {
        toast({ title: "Retry Failed", description: result.message || `Error ${res.status}`, variant: "destructive" });
      } else {
        toast({ title: "Order Retried", description: "Order sent to provider successfully" });
      }
      fetchData();
    } catch (err: any) {
      console.error("Retry catch error:", err);
      toast({ title: "Retry Failed", description: err.message || "Unknown error", variant: "destructive" });
      fetchData();
    }
  };

  const handleCloseComplaint = async (id: string) => {
    const { error } = await supabase.from("complaints").update({ status: "closed" }).eq("id", id);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Complaint closed" });
    fetchData();
  };

  return (
    <DashboardLayout title="Admin Panel">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="space-y-2 mb-4">
          <TabsList className="w-full h-auto flex flex-nowrap overflow-x-auto justify-start gap-1">
            <TabsTrigger value="analytics" className="gap-2 justify-center whitespace-nowrap"><BarChart3 className="w-4 h-4" /> Analytics</TabsTrigger>
            <TabsTrigger value="users" className="gap-2 justify-center whitespace-nowrap"><Users className="w-4 h-4" /> Users</TabsTrigger>
            <TabsTrigger value="orders" className="gap-2 justify-center whitespace-nowrap"><ShoppingBag className="w-4 h-4" /> Orders <Badge variant="secondary" className="ml-1 text-xs">{orders.length}</Badge></TabsTrigger>
            <TabsTrigger value="verified-id" className="gap-2 justify-center whitespace-nowrap"><Hash className="w-4 h-4" /> Verified ID</TabsTrigger>
            <TabsTrigger value="complaints" className="gap-2 justify-center whitespace-nowrap"><MessageSquare className="w-4 h-4" /> Complaints</TabsTrigger>
          </TabsList>
          <TabsList className="w-full h-auto flex flex-nowrap overflow-x-auto justify-start gap-1">
            <TabsTrigger value="bundles" className="gap-2 justify-center whitespace-nowrap"><Wifi className="w-4 h-4" /> Bundles</TabsTrigger>
            <TabsTrigger value="promos" className="gap-2 justify-center whitespace-nowrap"><Percent className="w-4 h-4" /> Promos</TabsTrigger>
            <TabsTrigger value="resellers" className="gap-2 justify-center whitespace-nowrap"><Store className="w-4 h-4" /> Resellers</TabsTrigger>
            <TabsTrigger value="withdrawals" className="gap-2 justify-center whitespace-nowrap"><ArrowDownToLine className="w-4 h-4" /> Withdrawals</TabsTrigger>
            <TabsTrigger value="site-message" className="gap-2 justify-center whitespace-nowrap"><Megaphone className="w-4 h-4" /> Message</TabsTrigger>
            <TabsTrigger value="broadcast" className="gap-2 justify-center whitespace-nowrap"><Megaphone className="w-4 h-4" /> Broadcast</TabsTrigger>
            <TabsTrigger value="live-chat" className="gap-2 justify-center whitespace-nowrap"><MessageCircle className="w-4 h-4" /> Live Chat</TabsTrigger>
            <TabsTrigger value="rankings" className="gap-2 justify-center whitespace-nowrap"><Crown className="w-4 h-4" /> Rankings</TabsTrigger>
          </TabsList>
        </div>

        {/* ANALYTICS TAB */}
        <TabsContent value="analytics">
          <AdminAnalytics users={users} orders={orders} topups={topups} complaints={complaints} />
        </TabsContent>

        {/* RANKINGS TAB */}
        <TabsContent value="rankings">
          <AdminMonthlyRankings users={users} orders={orders} />
        </TabsContent>

        {/* USERS TAB */}
        <TabsContent value="users">
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, or agent code..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>
                ) : filteredUsers.map((u) => {
                  const isUserAdmin = adminUserIds.has(u.user_id);
                  return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.agent_code || "—"}</TableCell>
                    <TableCell>{u.full_name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.phone}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(u.wallet_balance)}</TableCell>
                    <TableCell>
                      <Select
                        value={u.tier || "customer"}
                        onValueChange={(val) => handleSetTier(u.user_id, val)}
                      >
                        <SelectTrigger className="w-[110px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="customer" className="text-xs">Customer</SelectItem>
                          <SelectItem value="reseller" className="text-xs text-primary font-semibold">Reseller</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={isUserAdmin ? "bg-amber-500/10 text-amber-600 cursor-pointer" : "bg-muted text-muted-foreground cursor-pointer"}
                        onClick={() => handleToggleAdmin(u.user_id, !isUserAdmin)}
                      >
                        <Shield className="w-3 h-3 mr-1" />
                        {isUserAdmin ? "Admin" : "User"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={u.is_blocked ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}>
                        {u.is_blocked ? "Blocked" : "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setWalletDialog({ user: u, type: "credit" })}>Credit</Button>
                        <Button size="sm" variant="outline" onClick={() => setWalletDialog({ user: u, type: "debit" })}>Debit</Button>
                        <Button size="sm" variant={u.is_blocked ? "default" : "destructive"} onClick={() => handleToggleBlock(u.user_id, !u.is_blocked)}>
                          {u.is_blocked ? "Unblock" : "Block"}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteUser(u.user_id, u.full_name || u.email)} title="Permanently delete account">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ORDERS TAB */}
        <TabsContent value="orders">
          {(() => {
            const startToday = startOfDay(new Date());
            const todayOrders = orders.filter(o => new Date(o.created_at) >= startToday);
            const todayCapacityGB = todayOrders.reduce((sum, o) => {
              const s = String(o.bundle_size || "");
              const m = s.match(/([\d.]+)\s*(GB|MB)/i);
              if (!m) return sum;
              const val = parseFloat(m[1]);
              return sum + (m[2].toUpperCase() === "MB" ? val / 1000 : val);
            }, 0);
            return (
              <div className="mb-4 grid grid-cols-2 gap-3 auto-rows-fr sm:grid-cols-4 xl:grid-cols-8">
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="text-lg font-bold text-foreground">{orders.length}</p>
                  <p className="text-xs text-muted-foreground">Total Orders</p>
                </div>
                <div className="rounded-xl border border-primary/40 bg-card p-3 text-center">
                  <p className="text-lg font-bold text-primary">{todayOrders.length}</p>
                  <p className="text-xs text-muted-foreground">Today's Orders</p>
                </div>
                <div className="rounded-xl border border-primary/40 bg-card p-3 text-center">
                  <p className="text-lg font-bold text-primary">{todayCapacityGB.toFixed(todayCapacityGB % 1 === 0 ? 0 : 2)}GB</p>
                  <p className="text-xs text-muted-foreground">Today's Capacity</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="text-lg font-bold text-warning">{orders.filter(o => o.status === "pending").length}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="text-lg font-bold text-primary">{orders.filter(o => o.status === "processing").length}</p>
                  <p className="text-xs text-muted-foreground">Processing</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="text-lg font-bold text-warning">{orders.filter(o => o.status === "waiting").length}</p>
                  <p className="text-xs text-muted-foreground">Waiting</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="text-lg font-bold text-success">{orders.filter(o => o.status === "completed" || o.status === "delivered").length}</p>
                  <p className="text-xs text-muted-foreground">Delivered</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="text-lg font-bold text-destructive">{orders.filter(o => o.status === "failed").length}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>
            );
          })()}
          <div className="mb-4 rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-semibold text-foreground">Auto-Deliver Timer</p>
              <p className="text-xs text-muted-foreground">
                {autoDeliverMinutes === "manual"
                  ? "Manual only — orders will not auto-deliver."
                  : `Pending/processing/waiting orders auto-mark as delivered after ${autoDeliverMinutes} minutes.`}
              </p>
            </div>
            <Select value={autoDeliverMinutes} onValueChange={handleSetAutoDeliver}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual (off)</SelectItem>
                <SelectItem value="5">5 minutes</SelectItem>
                <SelectItem value="10">10 minutes</SelectItem>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="20">20 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mb-4 rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <Switch checked={mashupEnabled} onCheckedChange={(v) => handleToggleProduct("mashup_enabled", v)} />
              <div>
                <p className="text-sm font-semibold text-foreground">MashUp</p>
                <p className="text-xs text-muted-foreground">{mashupEnabled ? "Visible to users" : "Hidden from users"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={airtimeEnabled} onCheckedChange={(v) => handleToggleProduct("airtime_enabled", v)} />
              <div>
                <p className="text-sm font-semibold text-foreground">Airtime</p>
                <p className="text-xs text-muted-foreground">{airtimeEnabled ? "Visible to users" : "Hidden from users"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={vsEnabled} onCheckedChange={(v) => handleToggleProduct("vs_enabled", v)} />
              <div>
                <p className="text-sm font-semibold text-foreground">Telecel V+D+S</p>
                <p className="text-xs text-muted-foreground">{vsEnabled ? "Visible to users" : "Hidden from users"}</p>
              </div>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-3 items-end">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by phone number..."
                value={orderPhoneSearch}
                onChange={(e) => setOrderPhoneSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="completed">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={orderNetworkFilter} onValueChange={setOrderNetworkFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filter by network" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Networks</SelectItem>
                <SelectItem value="MTN">MTN</SelectItem>
                <SelectItem value="TELECEL">Telecel</SelectItem>
                <SelectItem value="AT BIG TIME">AT Big Time</SelectItem>
                <SelectItem value="AT PREMIUM">AT Premium</SelectItem>
                <SelectItem value="MashUp">MashUp</SelectItem>
                <SelectItem value="Telecel V+D+S">Telecel V+D+S</SelectItem>
                <SelectItem value="Telecel V&S">Telecel V&S (legacy)</SelectItem>
                <SelectItem value="Airtime">Airtime</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !orderDateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {orderDateFrom ? format(orderDateFrom, "MMM dd, yyyy") : "From date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={orderDateFrom} onSelect={setOrderDateFrom} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !orderDateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {orderDateTo ? format(orderDateTo, "MMM dd, yyyy") : "To date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={orderDateTo} onSelect={setOrderDateTo} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
            {(orderDateFrom || orderDateTo) && <Button variant="ghost" size="sm" onClick={() => { setOrderDateFrom(undefined); setOrderDateTo(undefined); }}>Clear dates</Button>}
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Network</TableHead>
                  <TableHead>Bundle</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Update</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Delete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No orders found</TableCell></TableRow>
                ) : filteredOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <div>
                          <span className="font-medium">{o.order_ref}</span>
                          {(() => {
                            const orderUser = users.find(u => u.user_id === o.user_id);
                            return orderUser ? <p className="text-xs text-muted-foreground">{orderUser.full_name}</p> : null;
                          })()}
                        </div>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => {
                          navigator.clipboard.writeText(o.phone_number);
                          toast({ title: "Copied!", description: `${o.phone_number} copied` });
                        }}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{o.network}</TableCell>
                    <TableCell>{o.bundle_size}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span>{o.phone_number}</span>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => {
                          navigator.clipboard.writeText(o.phone_number);
                          toast({ title: "Copied!", description: `${o.phone_number} copied` });
                        }}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency(o.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        o.status === "completed" ? "bg-success/10 text-success" :
                        o.status === "pending" ? "bg-warning/10 text-warning" :
                        o.status === "processing" ? "bg-primary/10 text-primary" :
                        o.status === "waiting" ? "bg-warning/10 text-warning" :
                        "bg-destructive/10 text-destructive"
                      }>{o.status === "completed" ? "delivered" : o.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Select value={o.status} onValueChange={(val) => handleUpdateOrderStatus(o.id, val)}>
                        <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="waiting">Waiting</SelectItem>
                          <SelectItem value="completed">Delivered</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm">{format(parseISO(o.created_at), "MMM dd, yyyy • HH:mm")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {o.gh_reference && (
                          <Button size="sm" variant="outline" title="Re-sync status from GHData" onClick={() => handleResyncOrder(o.id)}>
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        )}
                        {(o.status === "failed" || o.status === "waiting") && (
                          <Button size="sm" variant="outline" className="text-primary" onClick={() => handleRetryOrder(o)}>
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteOrder(o.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* VERIFIED ID TAB */}
        <TabsContent value="verified-id">
          <AdminVerifiedTopups users={users} />
        </TabsContent>

        {/* COMPLAINTS TAB */}
        <TabsContent value="complaints">
          <div className="mb-4 flex flex-wrap gap-3 items-end">
            <Select value={complaintStatusFilter} onValueChange={setComplaintStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !complaintDateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {complaintDateFrom ? format(complaintDateFrom, "MMM dd, yyyy") : "From date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={complaintDateFrom} onSelect={setComplaintDateFrom} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !complaintDateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {complaintDateTo ? format(complaintDateTo, "MMM dd, yyyy") : "To date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={complaintDateTo} onSelect={setComplaintDateTo} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
            {(complaintDateFrom || complaintDateTo) && <Button variant="ghost" size="sm" onClick={() => { setComplaintDateFrom(undefined); setComplaintDateTo(undefined); }}>Clear dates</Button>}
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComplaints.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No complaints found</TableCell></TableRow>
                ) : filteredComplaints.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{format(parseISO(c.created_at), "MMM dd, yyyy • HH:mm")}</TableCell>
                    <TableCell className="text-sm">{users.find(u => u.user_id === c.user_id)?.full_name || c.user_id.slice(0, 8) + "..."}</TableCell>
                    <TableCell>{c.order_ref || "—"}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{c.subject}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{c.message}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        c.status === "open" ? "bg-warning/10 text-warning" :
                        c.status === "resolved" ? "bg-success/10 text-success" :
                        "bg-muted text-muted-foreground"
                      }>{c.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {c.status === "open" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => { setReplyDialog(c); setReplyText(c.admin_reply || ""); }}>Reply</Button>
                            <Button size="sm" variant="secondary" onClick={() => handleCloseComplaint(c.id)}>Close</Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* BUNDLES TAB */}
        <TabsContent value="bundles">
          <AdminBundleManager />
        </TabsContent>

        {/* PROMOS TAB */}
        <TabsContent value="promos">
          <AdminPromoManager />
        </TabsContent>

        {/* SITE MESSAGE TAB */}
        <TabsContent value="site-message">
          <AdminSiteMessage />
        </TabsContent>

        {/* BROADCAST PUSH TAB */}
        <TabsContent value="broadcast">
          <AdminBroadcast />
        </TabsContent>

        {/* LIVE CHAT TAB */}
        <TabsContent value="live-chat">
          <AdminLiveChat />
        </TabsContent>

        <TabsContent value="resellers">
          <AdminResellers />
        </TabsContent>

        <TabsContent value="withdrawals">
          <AdminWithdrawals />
        </TabsContent>
      </Tabs>

      {/* Wallet Dialog */}
      <Dialog open={!!walletDialog} onOpenChange={() => setWalletDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{walletDialog?.type === "credit" ? "Credit" : "Debit"} Wallet — {walletDialog?.user?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input type="number" placeholder="Amount (₵)" value={walletAmount} onChange={(e) => setWalletAmount(e.target.value)} />
            <Input placeholder="Description (optional)" value={walletDesc} onChange={(e) => setWalletDesc(e.target.value)} />
            <Button className="w-full gradient-primary border-0" onClick={handleWalletOp}>
              {walletDialog?.type === "credit" ? "Credit" : "Debit"} {walletAmount ? formatCurrency(parseFloat(walletAmount)) : ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reply Dialog */}
      <Dialog open={!!replyDialog} onOpenChange={() => setReplyDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reply to Complaint</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <div className="bg-muted p-3 rounded-lg text-sm">
              <p className="font-medium">{replyDialog?.subject}</p>
              <p className="text-muted-foreground mt-1">{replyDialog?.message}</p>
            </div>
            <Textarea placeholder="Type your reply..." value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} />
            <Button className="w-full gradient-primary border-0" onClick={handleReplyComplaint}>Send Reply & Resolve</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
