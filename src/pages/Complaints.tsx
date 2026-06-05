import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { MessageSquarePlus, AlertCircle } from "lucide-react";
import { networks, getBundlePrice } from "@/lib/data";

export default function Complaints() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedOrder, setSelectedOrder] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState("");
  const [dataPackage, setDataPackage] = useState("");
  const [issueDate, setIssueDate] = useState("");

  const selectedNetworkData = networks.find((n) => n.id === selectedNetwork);
  const [submitting, setSubmitting] = useState(false);

  const fetchComplaints = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("complaints")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setComplaints(data || []);
  };

  const fetchOrders = async () => {
    if (!user) return;
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("orders")
      .select("id, order_ref, network, bundle_size, phone_number")
      .eq("user_id", user.id)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false });
    setOrders(data || []);
  };

  useEffect(() => {
    fetchComplaints();
    fetchOrders();
  }, [user]);

  const handleSubmit = async () => {
    if (!user || !subject.trim() || !message.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const orderRef = orders.find((o) => o.id === selectedOrder)?.order_ref || "";
    const networkName = selectedNetworkData?.name || "N/A";
    const fullMessage = `Phone: ${phoneNumber.trim() || "N/A"}\nNetwork: ${networkName}\nData Package: ${dataPackage.trim() || "N/A"}\nDate: ${issueDate || "N/A"}\n\n${message.trim()}`;
    const { error } = await supabase.from("complaints").insert({
      user_id: user.id,
      order_id: selectedOrder || null,
      order_ref: orderRef,
      subject: subject.trim(),
      message: fullMessage,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Failed to submit complaint", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Complaint submitted", description: "We'll review it shortly." });
    setOpen(false);
    setSubject("");
    setMessage("");
    setSelectedOrder("");
    setPhoneNumber("");
    setSelectedNetwork("");
    setDataPackage("");
    setIssueDate("");
    fetchComplaints();
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-warning/10 text-warning border-warning/20";
      case "resolved": return "bg-success/10 text-success border-success/20";
      case "closed": return "bg-muted text-muted-foreground";
      default: return "";
    }
  };

  return (
    <DashboardLayout title="Complaints">
      <div className="flex justify-end mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 gradient-primary border-0">
              <MessageSquarePlus className="w-4 h-4" /> New Complaint
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Submit a Complaint</DialogTitle>
              <DialogDescription className="sr-only">Form to submit a new complaint or issue</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Related Order (optional)</label>
                <Select value={selectedOrder} onValueChange={setSelectedOrder}>
                  <SelectTrigger><SelectValue placeholder="Select an order" /></SelectTrigger>
                  <SelectContent>
                    {orders.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.order_ref} — {o.network} {o.bundle_size} → {o.phone_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Phone Number (affected)</label>
                <Input placeholder="e.g., 0549358359" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} maxLength={15} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Network</label>
                <Select value={selectedNetwork} onValueChange={(val) => { setSelectedNetwork(val); setDataPackage(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select network" /></SelectTrigger>
                  <SelectContent>
                    {networks.map((n) => (
                      <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Data Package</label>
                <Select value={dataPackage} onValueChange={setDataPackage} disabled={!selectedNetwork}>
                  <SelectTrigger><SelectValue placeholder={selectedNetwork ? "Select data package" : "Select network first"} /></SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {selectedNetworkData?.bundles.map((b) => (
                      <SelectItem key={b.size} value={b.size}>{b.size} — ₵{getBundlePrice(b, profile?.tier || "general").toFixed(2)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Date of Issue</label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Subject</label>
                <Input placeholder="e.g. Data bundle not delivered" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Message</label>
                <Textarea placeholder="Describe your issue..." value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000} />
              </div>
              <Button className="w-full gradient-primary border-0" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Complaint"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & Time</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Admin Reply</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {complaints.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No complaints yet
                </TableCell>
              </TableRow>
            ) : (
              complaints.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{format(parseISO(c.created_at), "MMM dd, yyyy • HH:mm")}</TableCell>
                  <TableCell>{c.order_ref || "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{c.subject}</TableCell>
                  <TableCell><Badge variant="outline" className={statusColor(c.status)}>{c.status}</Badge></TableCell>
                  <TableCell className="max-w-[200px] truncate">{c.admin_reply || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </DashboardLayout>
  );
}
