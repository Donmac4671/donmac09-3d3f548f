import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/data";
import { format, parseISO, subDays, startOfDay, endOfDay, isBefore, isAfter } from "date-fns";
import {
  Users,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  CalendarIcon,
  X,
  RefreshCw,
  Wallet,
  Eye,
  EyeOff,
  Database,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface AdminAnalyticsProps {
  users: any[];
  orders: any[];
  topups: any[];
  complaints: any[];
}

const orderChartConfig: ChartConfig = {
  orders: { label: "Orders", color: "hsl(var(--primary))" },
};

const revenueChartConfig: ChartConfig = {
  revenue: { label: "Revenue", color: "hsl(var(--success))" },
};

const profitChartConfig: ChartConfig = {
  profit: { label: "Profit", color: "hsl(var(--primary))" },
};

const PIE_COLORS = ["hsl(var(--warning))", "hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--destructive))"];

// Original cost prices per network/bundle (DATA ONLY)
const ORIGINAL_PRICES: Record<string, Record<string, number>> = {
  MTN: {
    "1GB": 3.73,
    "2GB": 7.45,
    "3GB": 11.18,
    "4GB": 14.91,
    "5GB": 18.64,
    "6GB": 22.36,
    "7GB": 26.11,
    "8GB": 29.82,
    "10GB": 37.27,
    "15GB": 55.90,
    "20GB": 74.54,
    "25GB": 93.17,
    "30GB": 111.81,
    "40GB": 149.08,
    "50GB": 186.35,
  },
  TELECEL: {
    "2GB": 9.09,
    "3GB": 13.54,
    "5GB": 19.09,
    "10GB": 36.26,
    "15GB": 53.43,
    "20GB": 70.7,
    "30GB": 104.03,
    "40GB": 138.37,
    "50GB": 172.71,
  },
  "AT BIG TIME": {
    "15GB": 47.47,
    "20GB": 55.55,
    "30GB": 65.65,
    "40GB": 78.78,
    "50GB": 86.86,
    "60GB": 98.98,
    "70GB": 121.2,
    "80GB": 141.4,
    "90GB": 151.5,
    "100GB": 161.6,
    "130GB": 202.0,
    "140GB": 225.23,
    "150GB": 250.48,
    "200GB": 321.18,
  },
  "AT PREMIUM": {
    "1GB": 3.73,
    "2GB": 7.46,
    "3GB": 11.21,
    "4GB": 14.95,
    "5GB": 18.69,
    "6GB": 22.42,
    "7GB": 26.16,
    "8GB": 29.9,
    "10GB": 37.27,
    "12GB": 44.84,
    "15GB": 56.05,
    "20GB": 74.74,
    "25GB": 93.43,
    "30GB": 112.11,
  },
};

// ============================================================
// 🔥 FIXED: Calculate profit correctly for each order type
// ============================================================
function calculateOrderProfit(order: any, customCostMap?: Record<string, Record<string, number>>): number {
  const network = order.network?.toLowerCase();
  const amount = Number(order.amount);

  // Airtime - NO profit (profit = 0)
  if (network === "airtime") {
    return 0;
  }

  // Mashup & Telecel Voice/SMS - No profit from fee anymore
  if (network === "mashup" || network === "telecel v+d+s" || network === "telecel v&s") {
    return 0;
  }

  // Data bundles - Profit = selling price - cost price
  let cost = 0;
  const originalCost = ORIGINAL_PRICES[order.network]?.[order.bundle_size];
  if (typeof originalCost === "number") {
    cost = originalCost;
  } else {
    const fallbackCost = customCostMap?.[order.network]?.[order.bundle_size];
    if (typeof fallbackCost === "number") {
      cost = fallbackCost;
    }
  }

  return amount - cost;
}

function getOrderCostForDisplay(order: any, customCostMap?: Record<string, Record<string, number>>): number {
  const network = order.network?.toLowerCase();

  // Airtime has no cost
  if (network === "airtime") {
    return 0;
  }

  // Mashup & Telecel Voice/SMS - cost is the amount
  if (network === "mashup" || network === "telecel v+d+s" || network === "telecel v&s") {
    return Number(order.amount);
  }

  // Data bundles - get actual cost
  const originalCost = ORIGINAL_PRICES[order.network]?.[order.bundle_size];
  if (typeof originalCost === "number") {
    return originalCost;
  }
  const fallbackCost = customCostMap?.[order.network]?.[order.bundle_size];
  if (typeof fallbackCost === "number") {
    return fallbackCost;
  }
  return 0;
}

const NETWORK_ID_TO_NAME: Record<string, string> = {
  mtn: "MTN",
  telecel: "TELECEL",
  "at-bigtime": "AT BIG TIME",
  "at-premium": "AT PREMIUM",
  airtime: "Airtime",
  mashup: "Mashup",
};

function DateFilter({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onClear,
}: {
  dateFrom?: Date;
  dateTo?: Date;
  onDateFromChange: (d?: Date) => void;
  onDateToChange: (d?: Date) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("text-xs gap-1", !dateFrom && "text-muted-foreground")}>
            <CalendarIcon className="w-3 h-3" />
            {dateFrom ? format(dateFrom, "MMM dd, yyyy") : "From date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateFrom}
            onSelect={onDateFromChange}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("text-xs gap-1", !dateTo && "text-muted-foreground")}>
            <CalendarIcon className="w-3 h-3" />
            {dateTo ? format(dateTo, "MMM dd, yyyy") : "To date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateTo}
            onSelect={onDateToChange}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
      {(dateFrom || dateTo) && (
        <Button variant="ghost" size="sm" className="text-xs gap-1 text-destructive" onClick={onClear}>
          <X className="w-3 h-3" /> Clear
        </Button>
      )}
    </div>
  );
}

export default function AdminAnalytics({ users, orders, topups, complaints }: AdminAnalyticsProps) {
  const today = new Date();
  const [dateFrom, setDateFrom] = useState<Date | undefined>(today);
  const [dateTo, setDateTo] = useState<Date | undefined>(today);
  const [ghBalance, setGhBalance] = useState<number | null>(null);
  const [ghBalanceLoading, setGhBalanceLoading] = useState(false);
  const [showProfit, setShowProfit] = useState(false);
  const [customCostMap, setCustomCostMap] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    const fetchCustomCosts = async () => {
      const { data } = await supabase.from("custom_bundles").select("network_id, bundle_size, agent_price");
      if (!data) return;
      const map: Record<string, Record<string, number>> = {};
      for (const row of data) {
        const networkName = NETWORK_ID_TO_NAME[row.network_id] ?? row.network_id?.toUpperCase();
        if (!map[networkName]) map[networkName] = {};
        map[networkName][row.bundle_size] = Number(row.agent_price);
      }
      setCustomCostMap(map);
    };
    fetchCustomCosts();
  }, []);

  const fetchGhBalance = async () => {
    setGhBalanceLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ghconnect-balance");
      if (error) throw error;
      if (data?.success && data?.data) {
        const bal = data.data.balance ?? data.data.wallet_balance ?? data.data.data?.balance;
        setGhBalance(typeof bal === "number" ? bal : parseFloat(bal));
      }
    } catch (err) {
      console.error("Failed to fetch GH balance:", err);
    } finally {
      setGhBalanceLoading(false);
    }
  };

  useEffect(() => {
    fetchGhBalance();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const d = parseISO(o.created_at);
      if (dateFrom && isBefore(d, startOfDay(dateFrom))) return false;
      if (dateTo && isAfter(d, endOfDay(dateTo))) return false;
      return true;
    });
  }, [orders, dateFrom, dateTo]);

  const filteredTopups = useMemo(() => {
    return topups.filter((t) => {
      const d = parseISO(t.created_at);
      if (dateFrom && isBefore(d, startOfDay(dateFrom))) return false;
      if (dateTo && isAfter(d, endOfDay(dateTo))) return false;
      return true;
    });
  }, [topups, dateFrom, dateTo]);

  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      const d = parseISO(c.created_at);
      if (dateFrom && isBefore(d, startOfDay(dateFrom))) return false;
      if (dateTo && isAfter(d, endOfDay(dateTo))) return false;
      return true;
    });
  }, [complaints, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + Number(o.amount), 0);
    const totalTopups = filteredTopups
      .filter((t) => t.status === "completed")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const pendingOrders = filteredOrders.filter((o) => o.status === "pending" || o.status === "processing").length;
    const completedOrders = filteredOrders.filter((o) => o.status === "completed" || o.status === "delivered").length;
    const failedOrders = filteredOrders.filter((o) => o.status === "failed").length;
    const openComplaints = filteredComplaints.filter((c) => c.status === "open").length;
    const totalWalletBalance = users.reduce((sum, u) => sum + Number(u.wallet_balance), 0);
    const blockedUsers = users.filter((u) => u.is_blocked).length;
    const pendingTopups = filteredTopups.filter((t) => t.status === "pending").length;

    // 🔥 FIXED: Calculate cost and profit using the new functions
    const totalCost = filteredOrders.reduce((sum, o) => sum + getOrderCostForDisplay(o, customCostMap), 0);
    const totalProfit = filteredOrders.reduce((sum, o) => sum + calculateOrderProfit(o, customCostMap), 0);

    const totalCapacityGB = filteredOrders.reduce((sum, o) => {
      // Skip Airtime and Mashup for capacity calculation
      const network = o.network?.toLowerCase();
      if (network === "airtime" || network === "mashup") return sum;

      const s = String(o.bundle_size || "");
      const m = s.match(/([\d.]+)\s*(GB|MB)/i);
      if (!m) return sum;
      const val = parseFloat(m[1]);
      return sum + (m[2].toUpperCase() === "MB" ? val / 1000 : val);
    }, 0);

    return {
      totalUsers: users.length,
      totalRevenue,
      totalTopups,
      totalOrders: filteredOrders.length,
      pendingOrders,
      completedOrders,
      failedOrders,
      openComplaints,
      totalComplaints: filteredComplaints.length,
      totalWalletBalance,
      blockedUsers,
      pendingTopups,
      totalCost,
      totalProfit,
      totalCapacityGB,
    };
  }, [users, filteredOrders, filteredTopups, filteredComplaints, customCostMap]);

  // Profit per day (last 7 days)
  const profitPerDay = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(dateTo || new Date(), 6 - i);
      return { date: startOfDay(date), label: format(date, "EEE dd") };
    });

    return days.map(({ date, label }) => {
      const dayOrders = filteredOrders.filter((o) => startOfDay(parseISO(o.created_at)).getTime() === date.getTime());
      const profit = dayOrders.reduce((sum, o) => sum + calculateOrderProfit(o, customCostMap), 0);
      return { day: label, profit: Math.round(profit * 100) / 100 };
    });
  }, [filteredOrders, dateTo, customCostMap]);

  // Orders per day (last 7 days or within date range)
  const ordersPerDay = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(dateTo || new Date(), 6 - i);
      return { date: startOfDay(date), label: format(date, "EEE dd") };
    });

    return days.map(({ date, label }) => {
      const count = filteredOrders.filter((o) => {
        const d = startOfDay(parseISO(o.created_at));
        return d.getTime() === date.getTime();
      }).length;
      return { day: label, orders: count };
    });
  }, [filteredOrders, dateTo]);

  // Revenue per day (last 7 days or within date range)
  const revenuePerDay = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(dateTo || new Date(), 6 - i);
      return { date: startOfDay(date), label: format(date, "EEE dd") };
    });

    return days.map(({ date, label }) => {
      const total = filteredOrders
        .filter((o) => startOfDay(parseISO(o.created_at)).getTime() === date.getTime())
        .reduce((sum, o) => sum + Number(o.amount), 0);
      return { day: label, revenue: total };
    });
  }, [filteredOrders, dateTo]);

  // Order status distribution
  const orderStatusData = useMemo(() => {
    const statuses = ["pending", "processing", "completed", "delivered", "failed"];
    return statuses
      .map((s) => ({
        name:
          s === "delivered" ? "Delivered" : s === "completed" ? "Completed" : s.charAt(0).toUpperCase() + s.slice(1),
        value: filteredOrders.filter((o) => o.status === s).length,
      }))
      .filter((d) => d.value > 0);
  }, [filteredOrders]);

  // Network distribution
  const networkData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredOrders.forEach((o) => {
      map[o.network] = (map[o.network] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredOrders]);

  const networkChartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    networkData.forEach((item, i) => {
      config[item.name] = { label: item.name, color: PIE_COLORS[i % PIE_COLORS.length] };
    });
    return config;
  }, [networkData]);

  const statusChartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    orderStatusData.forEach((item, i) => {
      config[item.name] = { label: item.name, color: PIE_COLORS[i % PIE_COLORS.length] };
    });
    return config;
  }, [orderStatusData]);

  return (
    <div className="space-y-6">
      {/* Date Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Filter by date:</span>
        <DateFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onClear={() => {
            setDateFrom(undefined);
            setDateTo(undefined);
          }}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
                {stats.blockedUsers > 0 && <p className="text-xs text-destructive">{stats.blockedUsers} blocked</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-success/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <DollarSign className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Profit</p>
                  <p className={`text-2xl font-bold ${stats.totalProfit >= 0 ? "text-success" : "text-destructive"}`}>
                    {showProfit ? formatCurrency(stats.totalProfit) : "••••••"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cost: {showProfit ? formatCurrency(stats.totalCost) : "••••••"}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowProfit(!showProfit)} className="shrink-0">
                {showProfit ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <ShoppingBag className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold">{stats.totalOrders}</p>
                <p className="text-xs text-muted-foreground">{stats.pendingOrders} pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertCircle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Open Complaints</p>
                <p className="text-2xl font-bold">{stats.openComplaints}</p>
                <p className="text-xs text-muted-foreground">{stats.totalComplaints} total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-primary/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data Capacity</p>
                <p className="text-xl font-bold text-primary">
                  {stats.totalCapacityGB.toFixed(stats.totalCapacityGB % 1 === 0 ? 0 : 2)} GB
                </p>
                <p className="text-xs text-muted-foreground">in selected range</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <DollarSign className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Top-ups</p>
                <p className="text-xl font-bold">{formatCurrency(stats.totalTopups)}</p>
                {stats.pendingTopups > 0 && (
                  <p className="text-xs text-warning">{stats.pendingTopups} pending approval</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Wallet Balance</p>
                <p className="text-xl font-bold">{formatCurrency(stats.totalWalletBalance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Delivered Orders</p>
                <p className="text-xl font-bold">{stats.completedOrders}</p>
                {stats.failedOrders > 0 && <p className="text-xs text-destructive">{stats.failedOrders} failed</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GHDataConnect Balance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">GHDataConnect Balance</p>
                  <p className="text-2xl font-bold">
                    {ghBalanceLoading ? "..." : ghBalance !== null ? formatCurrency(ghBalance) : "Not available"}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchGhBalance} disabled={ghBalanceLoading}>
                <RefreshCw className={`w-4 h-4 ${ghBalanceLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profit Trend (Last 7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={profitChartConfig} className="h-[300px] w-full">
              <LineChart data={profitPerDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="profit" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ChartContainer>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Profit: {showProfit ? formatCurrency(profitPerDay.reduce((s, d) => s + d.profit, 0)) : "••••••"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders Trend (Last 7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={orderChartConfig} className="h-[300px] w-full">
              <BarChart data={ordersPerDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend (Last 7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueChartConfig} className="h-[300px] w-full">
              <BarChart data={revenuePerDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {orderStatusData.length > 0 ? (
              <ChartContainer config={statusChartConfig} className="h-[300px] w-full">
                <PieChart>
                  <Pie data={orderStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {orderStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">No orders data</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Network Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {networkData.length > 0 ? (
              <ChartContainer config={networkChartConfig} className="h-[300px] w-full">
                <PieChart>
                  <Pie data={networkData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {networkData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">No orders data</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
