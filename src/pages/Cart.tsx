import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useCart } from "@/contexts/CartContext";
import { formatCurrency, calculateMashupFee, calculateTelecelVSFee } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Trash2, ShoppingCart, Wallet, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import mtnLogo from "@/assets/networks/mtn.png";
import telecelLogo from "@/assets/networks/telecel.png";
import airteltigoLogo from "@/assets/networks/airteltigo.png";
import { Smartphone, Phone as PhoneIcon, MessageSquare } from "lucide-react";

function getNetworkVisual(networkId: string) {
  const id = networkId?.toLowerCase() || "";
  if (id === "mtn") return { logo: mtnLogo, bg: "bg-yellow-400" };
  if (id === "telecel" || id === "vs") return { logo: telecelLogo, bg: "bg-red-500" };
  if (id.startsWith("at-") || id === "airteltigo") return { logo: airteltigoLogo, bg: "bg-sky-600" };
  return { logo: null, bg: "bg-muted" };
}

import { usePageMeta } from "@/hooks/usePageMeta";

export default function Cart() {
  usePageMeta({ title: "Cart | Donmac Data Hub", description: "Review your data bundle cart and checkout with wallet on Donmac Data Hub.", path: "/cart" });
  const { items, removeItem, clearCart, total } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { profile, refreshProfile, referredStoreId } = useAuth();
  const [processing, setProcessing] = useState(false);

  const mashupSubtotal = items.filter((i) => i.networkId === "mashup").reduce((sum, i) => sum + i.effectivePrice, 0);
  const mashupFee = calculateMashupFee(mashupSubtotal);
  const vsSubtotal = items.filter((i) => i.networkId === "vs").reduce((sum, i) => sum + i.effectivePrice, 0);
  const vsFee = calculateTelecelVSFee(vsSubtotal);
  const grandTotal = total + mashupFee + vsFee;


  const checkPendingOrders = async (phoneNumbers: string[]): Promise<string[]> => {
    const uniquePhones = [...new Set(phoneNumbers)];
    const { data } = await supabase
      .from("orders")
      .select("phone_number")
      .in("phone_number", uniquePhones)
      .in("status", ["pending", "processing"]);
    return data?.map((o) => o.phone_number) || [];
  };

  // Helper to get bundle size in GB
  const getBundleSizeGB = (bundleSize: string): number => {
    const match = bundleSize.match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2].toUpperCase();
      return unit === "MB" ? value / 1000 : value;
    }
    return 1;
  };

  const handlePayWithWallet = async () => {
    if (!profile) return;

    if (profile.wallet_balance < grandTotal) {
      toast({ title: "Insufficient Balance", description: "Please top up your wallet first.", variant: "destructive" });
      return;
    }

    const manualItems = items.filter((i) => i.networkId === "airtime" || i.networkId === "mashup" || i.networkId === "vs");
    const dataItems = items.filter((i) => i.networkId !== "airtime" && i.networkId !== "mashup" && i.networkId !== "vs");

    setProcessing(true);

    try {
      // Handle Airtime, Mashup & Telecel V&S (manual delivery)
      for (const item of manualItems) {
        let amount = item.effectivePrice;
        if (item.networkId === "mashup") amount = item.effectivePrice + calculateMashupFee(item.effectivePrice);
        else if (item.networkId === "vs") amount = item.effectivePrice + calculateTelecelVSFee(item.effectivePrice);

        const { data: orderId, error: orderError } = await supabase.rpc("pay_with_wallet", {
          p_network: item.network,
          p_phone: item.phoneNumber,
          p_bundle: item.bundle.size,
          p_amount: amount,
        });

        if (orderError) throw new Error(`${item.networkId} order failed: ${orderError.message}`);

        await supabase
          .from("orders")
          .update({ status: "processing", gh_reference: `${item.networkId}-manual-${Date.now()}` })
          .eq("id", orderId);

        toast({
          title: `${item.networkId.toUpperCase()} Order Created!`,
          description: `Order for ${item.phoneNumber} is processing.`,
        });
      }

      // Handle Data orders - FIXED: Call fulfill-order directly
      if (dataItems.length > 0) {
        const dataPhones = dataItems.map((i) => i.phoneNumber);
        const pendingPhones = await checkPendingOrders(dataPhones);

        if (pendingPhones.length > 0) {
          toast({
            title: "Pending Order Exists",
            description: `Phone number(s) ${pendingPhones.join(", ")} already have a pending order.`,
            variant: "destructive",
          });
          setProcessing(false);
          return;
        }

        for (const item of dataItems) {
          // Profit = effective price (with reseller markup) minus wholesale base.
          const wholesale = item.bundle.price;
          const profit = Math.max(0, Math.round((item.effectivePrice - wholesale) * 100) / 100);

          // Step 1: Create order and deduct wallet. Pass store_id + profit so the
          // reseller gets credited on delivery.
          const { data: orderId, error: orderError } = await supabase.rpc("pay_with_wallet", {
            p_network: item.network,
            p_phone: item.phoneNumber,
            p_bundle: item.bundle.size,
            p_amount: item.effectivePrice,
            p_store_id: referredStoreId ?? undefined,
            p_profit: profit,
            p_network_id: item.networkId,
          });

          if (orderError) throw new Error(`Order failed: ${orderError.message}`);

          // Step 2: Call fulfill-order directly (same as resend button)
          await supabase.functions.invoke("fulfill-order", {
            body: {
              order_id: orderId,
              network_id: item.networkId,
              phone: item.phoneNumber,
              bundle_size_gb: getBundleSizeGB(item.bundle.size),
            },
          });
        }

        toast({ title: "Data Orders Placed!", description: `${dataItems.length} data order(s) are processing.` });
      }

      await refreshProfile();
      toast({ title: "Success!", description: `${manualItems.length + dataItems.length} order(s) placed.` });
      clearCart();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };




  return (
    <DashboardLayout title="Cart">
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> Shopping Cart ({items.length})
          </h2>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={clearCart}>
                Clear All
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} title="Close cart">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Your cart is empty</p>
            <p className="text-sm">Select data bundles from the dashboard to add them here</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {items.map((item) => {
                const visual = getNetworkVisual(item.networkId);
                const isMashup = item.networkId === "mashup";
                const isAirtime = item.networkId === "airtime";
                const isVs = item.networkId === "vs";
                return (
                <div key={item.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isMashup ? (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-white" />
                      </div>
                    ) : isVs ? (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-white" />
                      </div>
                    ) : isAirtime ? (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                        <PhoneIcon className="w-5 h-5 text-white" />
                      </div>
                    ) : visual.logo ? (
                      <div className={`w-10 h-10 rounded-full ${visual.bg} flex items-center justify-center overflow-hidden`}>
                        <img src={visual.logo} alt={item.network} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-xs font-bold">{item.network.slice(0, 3)}</span>
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-foreground">
                        {item.network} — {item.bundle.size}
                      </p>
                      <p className="text-sm text-muted-foreground">📞 {item.phoneNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-foreground">{formatCurrency(item.effectivePrice)}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-border space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                {(mashupFee + vsFee) > 0 && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Fee </span>
                    <span>{formatCurrency(mashupFee + vsFee)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="text-xl font-bold text-foreground">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-primary bg-primary/5">
                <Wallet className="w-5 h-5 text-primary" />
                <div className="text-left flex-1">
                  <p className="font-semibold text-foreground">Pay with Wallet</p>
                  <p className="text-xs text-muted-foreground">
                    Balance: {formatCurrency(profile?.wallet_balance ?? 0)}
                  </p>
                </div>
              </div>

              <Button
                className="w-full gradient-primary border-0"
                size="lg"
                disabled={processing}
                onClick={handlePayWithWallet}
              >
                {processing ? "Processing…" : `Proceed to Pay — ${formatCurrency(grandTotal)}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
