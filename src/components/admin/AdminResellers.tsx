import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/data";
import { format } from "date-fns";
import { Store, Plus, ExternalLink, ToggleLeft, ToggleRight, Trash2, UserPlus } from "lucide-react";

interface ResellerStore {
  id: string;
  user_id: string;
  slug: string;
  full_name: string;
  whatsapp: string;
  store_message: string;
  is_active: boolean;
  available_profit: number;
  lifetime_profit: number;
  created_at: string;
}

interface ProfileLite {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
}

export default function AdminResellers() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<ResellerStore[]>([]);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    slug: "",
    full_name: "",
    whatsapp: "",
    store_message: "",
  });
  const [userSearch, setUserSearch] = useState("");
  const [search, setSearch] = useState("");
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ full_name: "", email: "", phone: "", password: "" });
  const [creatingUser, setCreatingUser] = useState(false);

  const handleAddUser = async () => {
    if (!newUser.full_name || !newUser.email || !newUser.phone || !newUser.password) {
      toast({ title: "Missing fields", description: "All fields are required.", variant: "destructive" });
      return;
    }
    setCreatingUser(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", { body: newUser });
    setCreatingUser(false);
    if (error || (data as any)?.error) {
      toast({ title: "Create failed", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "User added", description: `${newUser.full_name} can now sign in.` });
    setAddUserOpen(false);
    setNewUser({ full_name: "", email: "", phone: "", password: "" });
    void load();
  };

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from("reseller_stores").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name, email, phone"),
    ]);
    setStores((s || []) as ResellerStore[]);
    setProfiles((p || []) as ProfileLite[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const profileById = (id: string) => profiles.find((p) => p.user_id === id);

  const handleCreate = async () => {
    if (!form.user_id || !form.slug || !form.full_name) {
      toast({ title: "Missing fields", description: "User, slug and name are required.", variant: "destructive" });
      return;
    }
    const cleanSlug = form.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { error } = await supabase.rpc("admin_create_store", {
      p_user_id: form.user_id,
      p_slug: cleanSlug,
      p_full_name: form.full_name,
      p_whatsapp: form.whatsapp,
      p_store_message: form.store_message,
    });
    if (error) {
      toast({ title: "Create failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Store created", description: `/${cleanSlug} is live.` });
    setCreateOpen(false);
    setForm({ user_id: "", slug: "", full_name: "", whatsapp: "", store_message: "" });
    void load();
  };

  const toggleActive = async (store: ResellerStore) => {
    const { error } = await supabase
      .from("reseller_stores")
      .update({ is_active: !store.is_active })
      .eq("id", store.id);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: store.is_active ? "Store disabled" : "Store enabled" });
    void load();
  };

  const handleDelete = async (store: ResellerStore) => {
    if (!confirm(`Delete store /${store.slug}? Their referred users keep their accounts.`)) return;
    const { error } = await supabase.from("reseller_stores").delete().eq("id", store.id);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Store deleted" });
    void load();
  };

  const filteredStores = stores.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const p = profileById(s.user_id);
    return (
      s.slug.includes(q) ||
      s.full_name.toLowerCase().includes(q) ||
      s.whatsapp.includes(q) ||
      p?.email?.toLowerCase().includes(q)
    );
  });

  const filteredUsers = profiles
    .filter((p) => !stores.some((s) => s.user_id === p.user_id))
    .filter((p) => {
      if (!userSearch.trim()) return true;
      const q = userSearch.toLowerCase();
      return (
        p.full_name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.phone?.includes(q)
      );
    })
    .slice(0, 30);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Store className="w-5 h-5" /> Reseller Stores
            <Badge variant="secondary">{stores.length}</Badge>
          </h2>
          <p className="text-sm text-muted-foreground">Create stores for users and manage existing ones.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Search slug, name, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Button onClick={() => setAddUserOpen(true)} variant="outline">
            <UserPlus className="w-4 h-4 mr-1" /> Add Reseller
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gradient-primary border-0">
            <Plus className="w-4 h-4 mr-1" /> New Store
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Slug</TableHead>
              <TableHead>Reseller</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Lifetime</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!loading && filteredStores.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  No stores yet.
                </TableCell>
              </TableRow>
            )}
            {filteredStores.map((s) => {
              const p = profileById(s.user_id);
              return (
                <TableRow key={s.id}>
                  <TableCell>
                    <a
                      href={`/${s.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono font-semibold text-primary hover:underline inline-flex items-center gap-1"
                    >
                      /{s.slug}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{s.full_name}</div>
                    <div className="text-xs text-muted-foreground">{p?.email || "—"}</div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{s.whatsapp || "—"}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(Number(s.available_profit))}</TableCell>
                  <TableCell>{formatCurrency(Number(s.lifetime_profit))}</TableCell>
                  <TableCell>
                    <Badge variant={s.is_active ? "default" : "secondary"}>
                      {s.is_active ? "Active" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(s.created_at), "MMM dd, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(s)} title={s.is_active ? "Disable" : "Enable"}>
                        {s.is_active ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(s)} title="Delete">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Reseller Store</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold">Assign to User</label>
              <Input
                placeholder="Search user by name/email/phone…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="mt-1 mb-2"
              />
              <Select value={form.user_id} onValueChange={(v) => {
                const p = profileById(v);
                setForm({
                  ...form,
                  user_id: v,
                  full_name: p?.full_name || form.full_name,
                  whatsapp: p?.phone || form.whatsapp,
                });
              }}>
                <SelectTrigger><SelectValue placeholder="Pick a user without a store" /></SelectTrigger>
                <SelectContent>
                  {filteredUsers.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.full_name || p.email} — {p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold">Slug (store URL)</label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="e.g. johnstore"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Public link: /{form.slug || "your-slug"}</p>
            </div>
            <div>
              <label className="text-sm font-semibold">Display Name</label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-semibold">WhatsApp Number</label>
              <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="0549358359" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-semibold">Store Message</label>
              <Textarea value={form.store_message} onChange={(e) => setForm({ ...form, store_message: e.target.value })} rows={3} placeholder="Welcome to my store..." className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} className="gradient-primary border-0">Create Store</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
