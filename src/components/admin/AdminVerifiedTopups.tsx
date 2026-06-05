import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Plus, Edit, CalendarIcon } from "lucide-react";
import { format, parseISO, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface VerifiedTopup {
  id: string;
  transaction_id: string;
  amount: number;
  network: string;
  is_claimed: boolean;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
}

interface Props {
  users: any[];
}

export default function AdminVerifiedTopups({ users }: Props) {
  const { toast } = useToast();
  const [topups, setTopups] = useState<VerifiedTopup[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTopup, setEditingTopup] = useState<VerifiedTopup | null>(null);
  const [txnId, setTxnId] = useState("");
  const [amount, setAmount] = useState("");
  const [network, setNetwork] = useState("MTN");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(new Date());
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());

  const fetchTopups = async () => {
    const { data } = await supabase
      .from("verified_topups")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setTopups(data as any);
  };

  useEffect(() => { fetchTopups(); }, []);

  // Auto-refresh via realtime subscription + window focus
  useEffect(() => {
    const channel = supabase
      .channel("admin-verified-topups-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "verified_topups" },
        () => { fetchTopups(); }
      )
      .subscribe();

    const onFocus = () => fetchTopups();
    const onVisible = () => { if (document.visibilityState === "visible") fetchTopups(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const filteredTopups = useMemo(() => {
    return topups.filter((t) => {
      const created = parseISO(t.created_at);
      if (dateFrom && created < startOfDay(dateFrom)) return false;
      if (dateTo && created > endOfDay(dateTo)) return false;
      return true;
    });
  }, [topups, dateFrom, dateTo]);

  const handleAdd = async () => {
    if (!txnId || txnId.length !== 11 || !amount || !network) {
      toast({ title: "Error", description: "Please fill all fields. Transaction ID must be 11 digits.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("verified_topups").insert({
      transaction_id: txnId,
      amount: parseFloat(amount),
      network,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Verified ID Added", description: `Transaction ${txnId} added for ${formatCurrency(parseFloat(amount))}` });
    resetForm();
    fetchTopups();
  };

  const handleEdit = async () => {
    if (!editingTopup || !txnId || txnId.length !== 11 || !amount || !network) {
      toast({ title: "Error", description: "Please fill all fields correctly.", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("verified_topups")
      .update({ transaction_id: txnId, amount: parseFloat(amount), network })
      .eq("id", editingTopup.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Verified ID Updated" });
    resetForm();
    fetchTopups();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("verified_topups").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Verified ID Deleted" });
    fetchTopups();
  };

  const resetForm = () => {
    setShowAddDialog(false);
    setEditingTopup(null);
    setTxnId("");
    setAmount("");
    setNetwork("MTN");
  };

  const openEdit = (topup: VerifiedTopup) => {
    setEditingTopup(topup);
    setTxnId(topup.transaction_id);
    setAmount(topup.amount.toString());
    setNetwork(topup.network);
    setShowAddDialog(true);
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return "—";
    const user = users.find((u) => u.user_id === userId);
    return user?.full_name || userId.slice(0, 8) + "...";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-1 h-4 w-4" />
                {dateFrom ? format(dateFrom, "MMM dd, yyyy") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground text-sm">to</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-1 h-4 w-4" />
                {dateTo ? format(dateTo, "MMM dd, yyyy") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
              Clear
            </Button>
          )}
        </div>
        <Button onClick={() => { resetForm(); setShowAddDialog(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Add Verified ID
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {filteredTopups.length} verified ID{filteredTopups.length !== 1 ? "s" : ""} found
      </p>

      <div className="bg-card rounded-xl border border-border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Network</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Claimed By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTopups.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No verified IDs found</TableCell></TableRow>
            ) : filteredTopups.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono font-medium">{t.transaction_id}</TableCell>
                <TableCell className="font-semibold">{formatCurrency(t.amount)}</TableCell>
                <TableCell>{t.network}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={t.is_claimed ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}>
                    {t.is_claimed ? "Claimed" : "Unclaimed"}
                  </Badge>
                </TableCell>
                <TableCell>{getUserName(t.claimed_by)}</TableCell>
                <TableCell className="text-sm">{format(parseISO(t.created_at), "MMM dd, yyyy • HH:mm")}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {!t.is_claimed && (
                      <Button size="sm" variant="outline" onClick={() => openEdit(t)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(t.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showAddDialog} onOpenChange={() => resetForm()}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTopup ? "Edit" : "Add"} Verified ID</DialogTitle>
            <DialogDescription className="sr-only">Form to update the status of a topup request</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Transaction ID (11 digits)</label>
              <Input
                placeholder="Enter 11-digit Transaction ID"
                value={txnId}
                onChange={(e) => setTxnId(e.target.value.replace(/\D/g, "").slice(0, 11))}
                maxLength={11}
                inputMode="numeric"
                className="tracking-widest text-base"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Amount (₵)</label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Network</label>
              <Select value={network} onValueChange={setNetwork}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MTN">MTN</SelectItem>
                  <SelectItem value="Telecel">Telecel</SelectItem>
                  <SelectItem value="AirtelTigo">AirtelTigo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full gradient-primary border-0" onClick={editingTopup ? handleEdit : handleAdd}>
              {editingTopup ? "Update" : "Add"} Verified ID
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
