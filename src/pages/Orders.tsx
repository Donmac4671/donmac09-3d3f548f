import { useState, useEffect, useMemo, useDeferredValue } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { formatCurrency } from "@/lib/data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, CheckCircle, Clock, XCircle, List, Loader, Search, Hourglass } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, isSameDay, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type OrderStatus = "all" | "completed" | "pending" | "processing" | "waiting" | "failed";

const displayStatus = (status: string) => status === "completed" ? "delivered" : status;

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [statusFilter, setStatusFilter] = useState<OrderStatus>("all");
  const [phoneSearch, setPhoneSearch] = useState("");
  const deferredPhoneSearch = useDeferredValue(phoneSearch);
  const [networkFilter, setNetworkFilter] = useState<string>("all");

  const fetchOrders = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setOrders(data || []);
  };

  useEffect(() => {
    if (!user) return;
    fetchOrders();

    // Realtime subscription for auto-refresh
    const channel = supabase
      .channel(`user-orders-realtime-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        () => fetchOrders()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const statusCounts = useMemo(() => {
    const counts = { all: orders.length, completed: 0, pending: 0, processing: 0, waiting: 0, failed: 0 };
    orders.forEach((o) => {
      if (o.status in counts) counts[o.status as keyof typeof counts]++;
    });
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = orders;
    const phoneQ = deferredPhoneSearch.trim();
    if (phoneQ) {
      return result.filter((o) => o.phone_number?.includes(phoneQ));
    }
    if (statusFilter !== "all") {
      result = result.filter((o) => o.status === statusFilter);
    }
    if (networkFilter !== "all") {
      result = result.filter((o) => (o.network || "").toLowerCase() === networkFilter.toLowerCase());
    }
    if (selectedDate) {
      result = result.filter((o) => isSameDay(parseISO(o.created_at), selectedDate));
    }
    return result;
  }, [orders, statusFilter, networkFilter, deferredPhoneSearch, selectedDate]);

  const statusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-success/10 text-success border-success/20";
      case "pending": return "bg-warning/10 text-warning border-warning/20";
      case "waiting": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "processing": return "bg-primary/10 text-primary border-primary/20";
      case "failed": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "";
    }
  };

  const statusTabs: { key: OrderStatus; label: string; icon: any; color: string }[] = [
    { key: "all", label: "All", icon: List, color: "text-foreground" },
    { key: "pending", label: "Pending", icon: Clock, color: "text-warning" },
    { key: "waiting", label: "Waiting", icon: Hourglass, color: "text-amber-600" },
    { key: "processing", label: "Processing", icon: Loader, color: "text-primary" },
    { key: "completed", label: "Delivered", icon: CheckCircle, color: "text-success" },
    { key: "failed", label: "Failed", icon: XCircle, color: "text-destructive" },
  ];

  return (
    <DashboardLayout title="Orders">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`bg-card rounded-xl border p-3 text-center transition-all ${
              statusFilter === tab.key ? "border-primary shadow-md" : "border-border hover:border-primary/30"
            }`}
          >
            <tab.icon className={`w-5 h-5 mx-auto mb-1 ${tab.color}`} />
            <p className="text-lg font-bold text-foreground">{statusCounts[tab.key]}</p>
            <p className="text-xs text-muted-foreground">{tab.label}</p>
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-border flex-wrap gap-2">
          <h2 className="font-semibold text-foreground">Order History</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search phone" value={phoneSearch} onChange={e => setPhoneSearch(e.target.value)} className="pl-8 w-[160px] h-9" />
            </div>
            <select
              value={networkFilter}
              onChange={(e) => setNetworkFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="all">All Networks</option>
              <option value="MTN">MTN</option>
              <option value="TELECEL">Telecel</option>
              <option value="AT BIG TIME">AT Big Time</option>
              <option value="AT PREMIUM">AT Premium</option>
              <option value="MTN MashUp Data">MTN MashUp Data</option>
              <option value="MTN MashUp Minutes + Data">MTN MashUp Minutes + Data</option>
            </select>
            {selectedDate && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(undefined)}>Clear</Button>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Filter by date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={selectedDate} onSelect={(date: Date | undefined) => setSelectedDate(date)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ref</TableHead>
              <TableHead>Network</TableHead>
              <TableHead>Bundle</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date & Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No orders found</TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.order_ref}</TableCell>
                  <TableCell>{order.network}</TableCell>
                  <TableCell>{order.bundle_size}</TableCell>
                  <TableCell>{order.phone_number}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(order.amount)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColor(order.status)}>{displayStatus(order.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{format(parseISO(order.created_at), "MMM dd, yyyy • HH:mm")}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </DashboardLayout>
  );
}
