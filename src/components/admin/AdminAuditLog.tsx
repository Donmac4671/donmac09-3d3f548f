import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay, endOfDay } from "date-fns";
import { CalendarIcon, RefreshCw, Search, ScrollText, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_is_admin: boolean;
  action: string;
  table_name: string;
  record_id: string | null;
  target_user_id: string | null;
  summary: string | null;
  old_data: unknown;
  new_data: unknown;
  created_at: string;
}

const TABLE_LABELS: Record<string, string> = {
  orders: "Orders",
  transactions: "Wallet",
  profiles: "Accounts",
  withdrawal_requests: "Withdrawals",
  wallet_topups: "Top-ups",
  verified_topups: "Verified IDs",
  user_roles: "Roles",
  custom_bundles: "Bundle prices",
  reseller_bundle_prices: "Store prices",
  reseller_stores: "Stores",
};

const actionVariant = (action: string) =>
  action === "insert" ? "default" : action === "delete" ? "destructive" : "secondary";

const actionLabel = (action: string) =>
  action === "insert" ? "Created" : action === "delete" ? "Deleted" : "Updated";

export default function AdminAuditLog() {
  const { toast } = useToast();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [detail, setDetail] = useState<AuditRow | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (date) {
      query = query
        .gte("created_at", startOfDay(date).toISOString())
        .lte("created_at", endOfDay(date).toISOString());
    }
    if (tableFilter !== "all") query = query.eq("table_name", tableFilter);
    if (actionFilter !== "all") query = query.eq("action", actionFilter);

    const { data, error } = await query;
    if (error) {
      toast({ title: "Could not load audit log", description: error.message, variant: "destructive" });
    } else {
      setRows((data ?? []) as AuditRow[]);
    }
    setLoading(false);
  }, [date, tableFilter, actionFilter, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.summary, r.actor_email, r.table_name, r.record_id].some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [rows, search]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ScrollText className="w-5 h-5" /> Audit Log
          <Badge variant="secondary" className="ml-1">{filtered.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 text-base"
              placeholder="Search user, action or reference"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search audit log"
            />
          </div>

          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="w-[170px]" aria-label="Filter by area">
              <SelectValue placeholder="Area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All areas</SelectItem>
              {Object.entries(TABLE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[140px]" aria-label="Filter by action">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="insert">Created</SelectItem>
              <SelectItem value="update">Updated</SelectItem>
              <SelectItem value="delete">Deleted</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("gap-2", !date && "text-muted-foreground")} aria-label="Filter by date">
                <CalendarIcon className="w-4 h-4" />
                {date ? format(date, "MMM dd, yyyy") : "All dates"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
            </PopoverContent>
          </Popover>

          {date && (
            <Button variant="ghost" size="icon" onClick={() => setDate(undefined)} aria-label="Clear date filter">
              <X className="w-4 h-4" />
            </Button>
          )}

          <Button variant="outline" onClick={fetchLogs} disabled={loading} aria-label="Refresh audit log">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Performed by</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No activity found</TableCell></TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetail(r)}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {format(new Date(r.created_at), "MMM dd, yyyy • HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={actionVariant(r.action)} className="text-xs">{actionLabel(r.action)}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{TABLE_LABELS[r.table_name] ?? r.table_name}</TableCell>
                    <TableCell className="text-sm">
                      <span className="block max-w-[180px] truncate">{r.actor_email ?? (r.actor_id ? "Unknown user" : "System")}</span>
                      {r.actor_is_admin && <Badge variant="outline" className="text-[10px] mt-1">Admin</Badge>}
                    </TableCell>
                    <TableCell className="text-sm max-w-[420px]">
                      <span className="block truncate">{r.summary ?? "—"}</span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit entry</DialogTitle>
            <DialogDescription>
              {detail && `${actionLabel(detail.action)} • ${TABLE_LABELS[detail.table_name] ?? detail.table_name} • ${format(new Date(detail.created_at), "MMM dd, yyyy • HH:mm")}`}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <p><span className="text-muted-foreground">Performed by: </span>{detail.actor_email ?? (detail.actor_id ? detail.actor_id : "System / automated")}</p>
              <p><span className="text-muted-foreground">Summary: </span>{detail.summary ?? "—"}</p>
              {detail.record_id && <p><span className="text-muted-foreground">Record: </span><span className="font-mono text-xs">{detail.record_id}</span></p>}
              {!!detail.old_data && (
                <div>
                  <p className="text-muted-foreground mb-1">Before</p>
                  <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">{JSON.stringify(detail.old_data, null, 2)}</pre>
                </div>
              )}
              {!!detail.new_data && (
                <div>
                  <p className="text-muted-foreground mb-1">After</p>
                  <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">{JSON.stringify(detail.new_data, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
