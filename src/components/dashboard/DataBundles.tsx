import { useState, useMemo } from "react";
import { Wifi, ChevronDown, ChevronUp, ShoppingCart } from "lucide-react";
import { Network, DataBundle, formatCurrency, getBundlePrice } from "@/lib/data";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomBundles } from "@/hooks/useCustomBundles";
import { useActivePromo } from "@/hooks/useActivePromo";
import { useResellerPrices } from "@/hooks/useResellerPrices";
import mtnLogo from "@/assets/networks/mtn.png";
import telecelLogo from "@/assets/networks/telecel.png";
import airteltigoLogo from "@/assets/networks/airteltigo.png";

const networkLogos: Record<string, string> = {
  mtn: mtnLogo,
  telecel: telecelLogo,
  "at-bigtime": airteltigoLogo,
  "at-premium": airteltigoLogo,
};

function NetworkIcon({ network }: { network: Network }) {
  return (
    <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-muted">
      <img src={networkLogos[network.id]} alt={network.name} className="w-full h-full object-cover" />
    </div>
  );
}

// Official brand colors
const BRAND_BG: Record<string, string> = {
  mtn: "#FFCB05",
  telecel: "#EE2722",
  "at-bigtime": "linear-gradient(135deg, #0066B3 0%, #0066B3 55%, #ED1C24 55%, #ED1C24 100%)",
  "at-premium": "linear-gradient(135deg, #0066B3 0%, #0066B3 55%, #ED1C24 55%, #ED1C24 100%)",
};
const BRAND_TEXT: Record<string, string> = {
  mtn: "#1a1a1a",
  telecel: "#ffffff",
  "at-bigtime": "#ffffff",
  "at-premium": "#ffffff",
};

function getValidity(networkId: string): string {
  if (networkId === "at-bigtime") return "Non-Expiry";
  if (networkId === "at-premium") return "60 Days";
  if (networkId === "telecel") return "60 Days";
  return "90 Days";
}

function BundleCard({
  bundle,
  network,
  tier,
  onSelect,
  applyDiscount,
  getResellerPrice,
}: {
  bundle: DataBundle;
  network: Network;
  tier: string;
  onSelect: () => void;
  applyDiscount?: (price: number) => number;
  getResellerPrice: (netId: string, size: string, base: number) => number;
}) {
  const wholesalePrice = getBundlePrice(bundle, tier);
  const isPrivilegedTier = tier === "reseller" || tier === "agent" || tier === "admin";
  const basePrice = isPrivilegedTier ? wholesalePrice : getResellerPrice(network.id, bundle.size, wholesalePrice);
  const displayPrice = applyDiscount ? applyDiscount(basePrice) : basePrice;
  const hasDiscount = displayPrice < basePrice;
  const offline = !!bundle.isOffline;

  const cardStyle = offline
    ? { background: "linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)", color: "#fff" }
    : { background: BRAND_BG[network.id] ?? undefined, color: BRAND_TEXT[network.id] ?? "#fff" };

  return (
    <div className="flex flex-col items-center">
      <div
        style={cardStyle}
        className={`rounded-2xl p-3 w-full aspect-square flex flex-col items-center justify-center text-center relative transition-all duration-200 ${
          offline ? "opacity-70" : "hover:shadow-lg hover:-translate-y-1 hover:scale-105"
        }`}
      >
        {offline ? (
          <span className="absolute top-1 right-1 flex items-center gap-1 bg-gray-700 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full shadow">
            <span className="w-1.5 h-1.5 rounded-full bg-white" /> Offline
          </span>
        ) : (
          <span className="absolute top-1 right-1 flex items-center gap-1 bg-green-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full shadow">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Online
          </span>
        )}
        <span className="text-sm font-extrabold tracking-wide uppercase leading-tight">
          {network.name} {bundle.size}
        </span>
        <span className="text-2xl lg:text-3xl font-extrabold mt-1">
          {formatCurrency(displayPrice)}
        </span>
        {hasDiscount && (
          <span className="text-[10px] opacity-70 line-through leading-none">
            {formatCurrency(basePrice)}
          </span>
        )}
        <span className="text-[10px] font-medium opacity-90 mt-1">
          Validity: {getValidity(network.id)}
        </span>
      </div>
      <Button
        size="sm"
        style={
          offline
            ? { background: "linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)", color: "#fff" }
            : { background: BRAND_BG[network.id], color: BRAND_TEXT[network.id] }
        }
        className="mt-2 border-0 text-xs w-full font-semibold shadow-sm hover:opacity-90 hover:shadow-md transition-all"
        onClick={onSelect}
        disabled={offline}
      >
        <ShoppingCart className="w-3 h-3 mr-1" /> {offline ? "Offline" : "Select Bundle"}
      </Button>
    </div>
  );
}

export default function DataBundles() {
  const [expandedNetwork, setExpandedNetwork] = useState<string | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<{ network: Network; bundle: DataBundle } | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const { addItem } = useCart();
  const { toast } = useToast();
  const { profile, isAdmin } = useAuth();
  const { networks: mergedNetworks } = useCustomBundles();
  const { getResellerPrice: calculateResellerPrice } = useResellerPrices();
  const userTier = profile?.tier || "customer";

  const getResellerPrice = (netId: string, size: string, base: number) => {
    if (isAdmin || userTier === "reseller" || userTier === "agent" || userTier === "admin") return base;
    return calculateResellerPrice(netId, size, base);
  };
  const { promo, applyDiscount } = useActivePromo(userTier);

  const toggleNetwork = (id: string) => {
    setExpandedNetwork(expandedNetwork === id ? null : id);
  };

  const networkPrefixes: Record<string, string[]> = {
    mtn: ["024", "025", "053", "054", "055", "059"],
    telecel: ["020", "050"],
    "at-bigtime": ["026", "027", "056", "057"],
    "at-premium": ["026", "027", "056", "057"],
  };

  const mtnExceptions = ["0278213799"];

  const phonePrefix = phoneNumber.length >= 3 ? phoneNumber.slice(0, 3) : "";
  const detectedNetwork = useMemo(() => {
    if (phonePrefix.length < 3) return null;
    if (mtnExceptions.includes(phoneNumber)) return "mtn";
    for (const [netId, prefixes] of Object.entries(networkPrefixes)) {
      if (prefixes.includes(phonePrefix)) return netId;
    }
    return "unknown";
  }, [phonePrefix, phoneNumber]);

  const isWrongNetwork = useMemo(() => {
    if (!selectedBundle || !detectedNetwork || detectedNetwork === "unknown") return false;
    const selectedId = selectedBundle.network.id;
    if ((selectedId === "at-bigtime" || selectedId === "at-premium") && (detectedNetwork === "at-bigtime" || detectedNetwork === "at-premium")) return false;
    return detectedNetwork !== selectedId;
  }, [detectedNetwork, selectedBundle]);

  const getExpectedNetworkName = (networkId: string) => {
    if (networkId === "mtn") return "MTN";
    if (networkId === "telecel") return "Telecel";
    if (networkId === "at-bigtime" || networkId === "at-premium") return "AirtelTigo";
    return networkId;
  };

  const handleAddToCart = () => {
    if (!selectedBundle || phoneNumber.length !== 10 || !/^\d{10}$/.test(phoneNumber)) {
      toast({ title: "Error", description: "Please enter a valid 10-digit phone number", variant: "destructive" });
      return;
    }
    if (isWrongNetwork) {
      const expected = getExpectedNetworkName(selectedBundle.network.id);
      toast({ title: "Wrong Network", description: `This number doesn't belong to ${expected}. Please enter a valid ${expected} number.`, variant: "destructive" });
      return;
    }
    if (detectedNetwork === "unknown") {
      toast({ title: "Unknown Number", description: "This phone number prefix is not recognized. Please check the number.", variant: "destructive" });
      return;
    }
    const wholesalePrice = getBundlePrice(selectedBundle.bundle, userTier);
    const isPrivilegedTier = userTier === "reseller" || userTier === "agent" || userTier === "admin";
    let effectivePrice = isPrivilegedTier ? wholesalePrice : getResellerPrice(selectedBundle.network.id, selectedBundle.bundle.size, wholesalePrice);
    if (promo) {
      effectivePrice = applyDiscount(effectivePrice);
    }
    addItem(selectedBundle.network.id, selectedBundle.network.name, selectedBundle.bundle, phoneNumber, effectivePrice);
    toast({ title: "Added to cart", description: `${selectedBundle.network.name} ${selectedBundle.bundle.size} added` });
    setSelectedBundle(null);
    setPhoneNumber("");
  };

  return (
    <>
      <div className="gradient-primary rounded-2xl p-4 lg:p-5 mb-4">
        <div className="flex items-center gap-3">
          <Wifi className="w-6 h-6 text-primary-foreground" />
          <div>
            <h2 className="text-lg font-bold text-primary-foreground">Data Bundles</h2>
            <p className="text-sm text-primary-foreground/70">Select your network and choose a data package</p>
          </div>
        </div>
      </div>
      {promo && userTier !== "agent" && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-4 text-center">
          <p className="text-sm font-semibold text-green-700">🎉 {promo.discount_percent}% OFF all bundles! {promo.description}</p>
        </div>
      )}

      <div className="space-y-3">
        {mergedNetworks.map((network) => {
          if (network.bundles.length === 0) return null;
          return (
          <div key={network.id} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <button
              onClick={() => toggleNetwork(network.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <NetworkIcon network={network} />
                <div className="text-left">
                  <p className="font-semibold text-foreground">{network.name}</p>
                  <p className="text-xs text-muted-foreground">{network.bundles.length} data packages available</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded-full">
                  {network.bundles.length} bundles
                </span>
                {expandedNetwork === network.id ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {expandedNetwork === network.id && (
              <div className="p-4 pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {network.bundles.map((bundle) => (
                    <BundleCard
                      key={bundle.size}
                      bundle={bundle}
                      network={network}
                      tier={userTier}
                      onSelect={() => setSelectedBundle({ network, bundle })}
                      applyDiscount={promo ? applyDiscount : undefined}
                      getResellerPrice={getResellerPrice}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>

      {/* Add to cart dialog */}
      <Dialog open={!!selectedBundle} onOpenChange={() => setSelectedBundle(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md p-0 overflow-hidden rounded-2xl border-0">
          {selectedBundle && (() => {
            const wholesalePrice = getBundlePrice(selectedBundle.bundle, userTier);
            const isPrivilegedTier = userTier === "reseller" || userTier === "agent" || userTier === "admin";
            const base = isPrivilegedTier ? wholesalePrice : getResellerPrice(selectedBundle.network.id, selectedBundle.bundle.size, wholesalePrice);
            const final = promo ? applyDiscount(base) : base;
            const hasDiscount = final < base;
            const headerStyle = {
              background: BRAND_BG[selectedBundle.network.id] ?? "var(--accent)",
              color: BRAND_TEXT[selectedBundle.network.id] ?? "#fff",
            };
            const validity = getValidity(selectedBundle.network.id);
            const phoneValid = phoneNumber.length === 10 && !isWrongNetwork && detectedNetwork !== "unknown";
            return (
              <>
                {/* Branded header */}
                <div style={headerStyle} className="relative px-5 pt-6 pb-8">
                  <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
                  <div className="absolute -top-8 -left-8 w-28 h-28 rounded-full bg-black/10 blur-2xl" />
                  <DialogHeader className="relative">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white/40 shadow-lg bg-white/20">
                        <img
                          src={networkLogos[selectedBundle.network.id]}
                          alt={selectedBundle.network.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="text-left">
                        <DialogTitle style={{ color: "inherit" }} className="text-lg font-extrabold tracking-tight">
                          {selectedBundle.network.name} {selectedBundle.bundle.size}
                        </DialogTitle>
                        <p className="text-xs opacity-80">Confirm details to add to cart</p>
                      </div>
                    </div>
                  </DialogHeader>
                </div>

                <div className="px-5 -mt-5 pb-5 space-y-4">
                  {/* Price + validity card */}
                  <div className="bg-card rounded-2xl border border-border shadow-md p-4 grid grid-cols-2 divide-x divide-border">
                    <div className="pr-3 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Price</p>
                      {hasDiscount && (
                        <p className="text-xs text-muted-foreground line-through leading-none">{formatCurrency(base)}</p>
                      )}
                      <p className={`text-2xl font-extrabold ${hasDiscount ? "text-green-600" : "text-foreground"}`}>
                        {formatCurrency(final)}
                      </p>
                    </div>
                    <div className="pl-3 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Validity</p>
                      <p className="text-2xl font-extrabold text-foreground">{validity}</p>
                    </div>
                  </div>

                  {/* Phone input */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                      Recipient Phone Number
                    </label>
                    <div
                      className={`flex items-center gap-2 rounded-xl border-2 bg-background px-3 transition-colors ${
                        phoneNumber.length === 0
                          ? "border-border"
                          : phoneValid
                          ? "border-green-500"
                          : "border-destructive"
                      }`}
                    >
                      <span className="text-lg">📞</span>
                      <Input
                        placeholder="0549358359"
                        value={phoneNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                          setPhoneNumber(val);
                        }}
                        maxLength={10}
                        inputMode="numeric"
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-base font-semibold tracking-wider"
                        style={{ fontSize: 16 }}
                      />
                      {phoneValid && (
                        <span className="text-green-600 text-lg" aria-hidden>✓</span>
                      )}
                    </div>
                    {phoneNumber.length > 0 && phoneNumber.length < 10 && (
                      <p className="text-xs text-muted-foreground mt-1.5 ml-1">
                        {10 - phoneNumber.length} more digit(s) needed
                      </p>
                    )}
                    {isWrongNetwork && (
                      <p className="text-xs text-destructive mt-1.5 ml-1 font-semibold">
                        ⚠️ Not a {getExpectedNetworkName(selectedBundle.network.id)} number
                      </p>
                    )}
                    {detectedNetwork === "unknown" && phoneNumber.length >= 3 && (
                      <p className="text-xs text-destructive mt-1.5 ml-1">⚠️ Unrecognized phone prefix</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-1">
                    <Button
                      variant="outline"
                      className="flex-1 h-11 rounded-xl"
                      onClick={() => setSelectedBundle(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 h-11 rounded-xl gradient-primary border-0 shadow-md font-semibold"
                      onClick={handleAddToCart}
                      disabled={!phoneValid}
                    >
                      <ShoppingCart className="w-4 h-4 mr-1.5" /> Add to Cart
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
