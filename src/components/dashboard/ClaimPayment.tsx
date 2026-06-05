import { useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function ClaimPayment() {
  const [open, setOpen] = useState(false);
  const [txnId, setTxnId] = useState("");
  const [claiming, setClaiming] = useState(false);
  const { toast } = useToast();
  const { refreshProfile } = useAuth();

  const handleClaim = async () => {
    const trimmed = txnId.trim();
    if (!/^\d{11}$/.test(trimmed)) {
      toast({ title: "Invalid ID", description: "Transaction ID must be exactly 11 digits.", variant: "destructive" });
      return;
    }
    setClaiming(true);
    const { error } = await supabase.rpc("claim_verified_topup", { p_transaction_id: trimmed });
    setClaiming(false);
    if (error) {
      toast({ title: "Claim Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Payment Claimed!", description: "Your wallet has been credited." });
      setTxnId("");
      setOpen(false);
      refreshProfile?.();
    }
  };

  return (
    <>
      <div className="bg-card rounded-xl p-4 lg:p-5 border border-border shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-1 hover:border-primary/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Claim Payment</h3>
              <p className="text-xs text-muted-foreground">Claim with transaction ID</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary border-0">
                <CreditCard className="w-4 h-4 mr-1" /> Claim
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Claim Payment</DialogTitle>
            <DialogDescription className="sr-only">Submit details of your manual payment for verification</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Transaction ID</label>
                  <Input
                    placeholder="Enter 11-digit transaction ID"
                    value={txnId}
                    onChange={(e) => setTxnId(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    maxLength={11}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Enter the 11-digit ID from your network provider</p>
                </div>
                <Button className="w-full gradient-primary border-0" onClick={handleClaim} disabled={claiming || txnId.trim().length !== 11}>
                  {claiming ? "Claiming..." : "Claim Payment"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </>
  );
}
