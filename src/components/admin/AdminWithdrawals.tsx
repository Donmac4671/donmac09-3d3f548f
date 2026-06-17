import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/data";
import { format } from "date-fns";
import { ArrowDownToLine, Check, X, Wallet, Copy } from "lucide-react";

interface WithdrawalReq {
  id: string;
  store_id: string;
  user_id: string;
  amount: number;
  fee_amount: number;
  net_amount: number;
  momo_number: string;
  momo_name: string;
  network: string;
  status: "pending" | "approved" | "rejected" | "paid";
  admin_notes: string;
  created_at: string;
}

interface StoreLite {
  id: string;
  slug: string;
  full_name: string;
}

const STATUSES = ["pending", "approved", "rejected", "paid"] as const;

export default function AdminWithdrawals() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [reqs, setReqs] = useState<WithdrawalReq[]>([]);
  const [stores, setStores] = useState<StoreLite[]>([]);
  const [filter, setFilter] = useState<(typeof STATUSES)[number] | "all">("pending");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const [{ data: r }, { data: s }] = await Promise.all([
      supabase.from("withdrawal_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("reseller_stores").select("id, slug, full_name"),
    ]);
    setReqs((r || []) as WithdrawalReq[]);
    setStores((s || []) as StoreLite[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const storeFor = (id: string) => stores.find((s) => s.id === id);

  const act = async (
    rpc: "admin_approve_withdrawal" | "admin_reject_withdrawal" | "admin_mark_withdrawal_paid",
    p_id: string,
    label: string,
  ) => {
    const { error } = await supabase.rpc(rpc, { p_id });
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: label });
    void load();
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: text });
  };

  const filtered = reqs.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (dateFrom) {
      const fromTs = new Date(dateFrom + "T00:00:00").getTime();
      if (new Date(r.created_at).getTime() < fromTs) return false;
    }
    if (dateTo) {
      const toTs = new Date(dateTo + "T23:59:59").getTime();
      if (new Date(r.created_at).getTime() > toTs) return false;
    }
    return true;
  });

  const pendingCount = reqs.filter((r) => r.status === "pending").length;
  const totalPaid = reqs.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.net_amount || r.amount), 0);
  const totalFees = reqs.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.fee_amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5" /> Withdrawal Requests
            {pendingCount > 0 && <Badge variant="destructive">{pendingCount} pending</Badge>}
          </h2>
          <p className="text-sm text-muted-foreground">
            Lifetime paid out: <span className="font-semibold text-foreground">{formatCurrency(totalPaid)}</span>
            {totalFees > 0 && (
              <span className="ml-2 text-xs">(fees collected: <span className="font-semibold text-destructive">{formatCurrency(totalFees)}</span>)</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["pending", "approved", "paid", "rejected", "all"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={filter === s ? "default" : "outline"}
              onClick={() => setFilter(s)}
              className="capitalize"
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-muted/30 rounded-lg p-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">From</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">To</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" />
        </div>
        {(dateFrom || dateTo) && (
          <Button size="sm" variant="ghost" onClick={() => { setDateFrom(""); setDateTo(""); }}>
            Clear dates
          </Button>
        )}
        <div className="text-xs text-muted-foreground ml-auto self-center">
          Showing {filtered.length} of {reqs.length} requests
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Gross</TableHead>
              <TableHead>Fee (1%)</TableHead>
              <TableHead>Net</TableHead>
              <TableHead>MoMo Details</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-6">Loading…</TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  No {filter === "all" ? "" : filter} requests.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => {
              const store = storeFor(r.store_id);
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(r.created_at), "MMM dd, yyyy • HH:mm")}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{store?.full_name || "—"}</div>
                    <div className="text-xs font-mono text-primary">/{store?.slug || "?"}</div>
                  </TableCell>
                  <TableCell className="font-bold">{formatCurrency(Number(r.amount))}</TableCell>
                  <TableCell className="text-destructive">{formatCurrency(Number(r.fee_amount || 0))}</TableCell>
                  <TableCell className="font-semibold text-primary">{formatCurrency(Number(r.net_amount || r.amount))}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className="font-semibold uppercase mr-2">{r.network}</span>
                      <span className="font-mono">{r.momo_number}</span>
                      <Button size="sm" variant="ghost" className="h-6 px-2 ml-1" onClick={() => copy(r.momo_number)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">{r.momo_name || "—"}</div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.status === "paid"
                          ? "default"
                          : r.status === "rejected"
                            ? "destructive"
                            : r.status === "approved"
                              ? "secondary"
                              : "outline"
                      }
                      className="capitalize"
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {r.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => act("admin_approve_withdrawal", r.id, "Approved")}
                          >
                            <Check className="w-3 h-3 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={() => act("admin_reject_withdrawal", r.id, "Rejected & refunded")}
                          >
                            <X className="w-3 h-3 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                      {(r.status === "pending" || r.status === "approved") && (
                        <Button
                          size="sm"
                          className="gradient-primary border-0"
                          onClick={() => act("admin_mark_withdrawal_paid", r.id, "Marked paid")}
                        >
                          <Wallet className="w-3 h-3 mr-1" /> Mark Paid
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
