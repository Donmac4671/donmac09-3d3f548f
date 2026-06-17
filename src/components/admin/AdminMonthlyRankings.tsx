import { useEffect, useMemo, useState } from "react";
import { Crown, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";

type AdminMonthlyRankingsProps = {
  users: any[];
  orders: any[];
};

type RankedReseller = {
  userId: string;
  storeId: string;
  slug: string;
  name: string;
  whatsapp: string;
  monthlyProfit: number;
  lifetimeProfit: number;
  orderCount: number;
};

const getMonthRange = (year: number, month: number) => ({
  start: new Date(year, month, 1).getTime(),
  end: new Date(year, month + 1, 0, 23, 59, 59, 999).getTime(),
});

export default function AdminMonthlyRankings({ users, orders }: AdminMonthlyRankingsProps) {
  const now = new Date();
  const [monthKey, setMonthKey] = useState(`${now.getFullYear()}-${now.getMonth()}`);
  const [stores, setStores] = useState<any[]>([]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("reseller_stores")
        .select("id, user_id, slug, full_name, whatsapp, available_profit, lifetime_profit, is_active");
      setStores(data || []);
    })();
  }, []);

  const monthOptions = useMemo(() => {
    const opts: { key: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      opts.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleString("en", { month: "long", year: "numeric" }),
      });
    }
    return opts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [yStr, mStr] = monthKey.split("-");
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);

  const top3 = useMemo<RankedReseller[]>(() => {
    const { start, end } = getMonthRange(year, month);
    const userMap = new Map(users.map((u) => [u.user_id, u]));
    const byStore = new Map<string, RankedReseller>();

    stores.forEach((s) => {
      byStore.set(s.id, {
        userId: s.user_id,
        storeId: s.id,
        slug: s.slug || "",
        name: s.full_name || userMap.get(s.user_id)?.full_name || "Unnamed reseller",
        whatsapp: s.whatsapp || userMap.get(s.user_id)?.phone || "—",
        monthlyProfit: 0,
        lifetimeProfit: Number(s.lifetime_profit || 0),
        orderCount: 0,
      });
    });

    orders.forEach((o) => {
      if (!o.store_id || !byStore.has(o.store_id)) return;
      if (!["completed", "delivered"].includes(o.status)) return;
      const t = new Date(o.created_at).getTime();
      if (t < start || t > end) return;
      const r = byStore.get(o.store_id)!;
      r.monthlyProfit += Number(o.reseller_profit || 0);
      r.orderCount += 1;
    });

    return Array.from(byStore.values())
      .filter((r) => r.monthlyProfit > 0)
      .sort((a, b) => b.monthlyProfit - a.monthlyProfit || b.orderCount - a.orderCount)
      .slice(0, 3);
  }, [stores, users, orders, year, month]);

  const monthLabel = monthOptions.find((o) => o.key === monthKey)?.label || "";

  return (
    <section className="mb-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-bold text-foreground">Top 3 Resellers</h2>
            <p className="text-sm text-muted-foreground">Best storefronts for {monthLabel}, ranked by profit earned.</p>
          </div>
        </div>
        <Select value={monthKey} onValueChange={setMonthKey}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-foreground">Reseller Leaderboard</h3>
          </div>
          <Badge variant="secondary">Monthly Top 3</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Reseller</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>Monthly Profit</TableHead>
              <TableHead>Lifetime</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {top3.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No reseller profit recorded this month
                </TableCell>
              </TableRow>
            ) : (
              top3.map((row, index) => (
                <TableRow key={row.storeId}>
                  <TableCell>
                    <Badge className="bg-primary text-primary-foreground">#{index + 1}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div>{row.name}</div>
                    <div className="text-xs text-muted-foreground">{row.whatsapp}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-primary">/{row.slug}</TableCell>
                  <TableCell>{row.orderCount}</TableCell>
                  <TableCell className="font-semibold text-primary">{formatCurrency(row.monthlyProfit)}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(row.lifetimeProfit)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
