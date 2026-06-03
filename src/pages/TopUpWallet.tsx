import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, Smartphone, Copy, CheckCircle, Hash, KeyRound, RefreshCw, Sparkles } from "lucide-react";
import { formatCurrency } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function TopUpWallet() {
  const [transactionId, setTransactionId] = useState("");
  const [claiming, setClaiming] = useState(false);
  const { toast } = useToast();
  const { profile, refreshProfile } = useAuth();
  const [generatingCode, setGeneratingCode] = useState(false);
  const referenceCode = (profile as any)?.topup_reference_code || "";

  const handleGenerateReferenceCode = async () => {
    setGeneratingCode(true);
    const { data, error } = await supabase.rpc("generate_topup_reference_code");
    setGeneratingCode(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await refreshProfile();
    toast({
      title: referenceCode ? "New Code Generated" : "Code Generated",
      description: `Your reference code is ${data}. Old code (if any) is now invalid.`,
    });
  };

  const handleClaimPayment = async () => {
    if (!transactionId || transactionId.length !== 11) {
      toast({ title: "Error", description: "Please enter a valid 11-digit transaction ID", variant: "destructive" });
      return;
    }

    setClaiming(true);
    try {
      const { error } = await supabase.rpc("claim_verified_topup", {
        p_transaction_id: transactionId,
      });

      if (error) {
        toast({ title: "Claim Failed", description: error.message, variant: "destructive" });
        return;
      }

      await refreshProfile();
      toast({ title: "Payment Claimed!", description: "Your wallet has been credited successfully." });
      setTransactionId("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setClaiming(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: text });
  };

  return (
    <DashboardLayout title="Top Up Wallet">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="bg-card rounded-xl border border-border shadow-sm p-6 text-center">
          <Wallet className="w-10 h-10 mx-auto text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Current Balance</p>
          <p className="text-3xl font-bold text-foreground">{formatCurrency(profile?.wallet_balance ?? 0)}</p>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm p-6 flex items-center gap-3">
          <Smartphone className="w-6 h-6 text-primary" />
          <div>
            <p className="font-semibold">Mobile Money Top-Up</p>
            <p className="text-xs text-muted-foreground">
              Send any amount via MoMo. The exact amount you send will be credited automatically via your
              reference code, or you can claim it manually with the transaction ID.
            </p>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-primary" /> Send Payment To
          </h3>
          <div className="bg-accent rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">MoMo Number</p>
                <p className="font-bold text-foreground text-lg">0549358359</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard("0549358359")}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Account Name</p>
              <p className="font-bold text-foreground">Michael Osei</p>
            </div>
          </div>

          <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-foreground text-sm">Auto-Claim with Reference Code</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use this 6-character code as the <span className="font-semibold">Reference</span> when
                  sending MoMo. The exact amount you send will be credited automatically — no need to enter it.
                </p>
              </div>
            </div>

            {referenceCode ? (
              <div className="flex items-center justify-between bg-card rounded-lg p-3 border border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <KeyRound className="w-4 h-4 text-primary flex-shrink-0" />
                  <p className="font-bold text-foreground text-xl tracking-widest truncate">{referenceCode}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(referenceCode)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateReferenceCode}
                    disabled={generatingCode}
                    title="Generate a new code (old code stops working)"
                  >
                    <RefreshCw className={`w-4 h-4 ${generatingCode ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleGenerateReferenceCode}
                disabled={generatingCode}
              >
                <KeyRound className="w-4 h-4 mr-2" />
                {generatingCode ? "Generating..." : "Generate My Reference Code"}
              </Button>
            )}
          </div>

          <div className="space-y-3 pt-2 border-t border-border">
            <h4 className="font-semibold flex items-center gap-2">
              <Hash className="w-4 h-4 text-primary" /> Or claim manually
            </h4>
            <p className="text-sm text-muted-foreground">
              Enter the 11-digit Transaction ID from your network provider.
            </p>
            <Input
              placeholder="Enter 11-digit Transaction ID"
              value={transactionId}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 11);
                setTransactionId(val);
              }}
              maxLength={11}
              inputMode="numeric"
              className="text-lg text-center tracking-widest"
            />
            <Button
              className="w-full gradient-primary border-0"
              size="lg"
              onClick={handleClaimPayment}
              disabled={transactionId.length !== 11 || claiming}
            >
              {claiming ? "Claiming..." : "Claim Payment"}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
