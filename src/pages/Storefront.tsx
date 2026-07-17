import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { networks, formatCurrency } from "@/lib/data";
import { useResellerPrices } from "@/hooks/useResellerPrices";
import {
  Store,
  MessageCircle,
  ShieldCheck,
  Zap,
  Wallet,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface StoreInfo {
  id: string;
  user_id: string;
  slug: string;
  full_name: string;
  whatsapp: string;
  store_message: string;
  is_active: boolean;
}

const STOREFRONT_KEY = "donmac_store_slug";

export default function Storefront() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const [store, setStore] = useState<StoreInfo | null>(null);
  const { getResellerPrice, getMarkupPrice, loading: pricesLoading } = useResellerPrices(store?.id);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug) return;
      setLoading(true);
      const cleaned = slug.trim().toLowerCase();
      const { data, error } = await (supabase as any)
        .from("public_reseller_stores")
        .select("id, user_id, slug, full_name, whatsapp, store_message, is_active")
        .eq("slug", cleaned)
        .eq("is_active", true)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
        setStore(null);
      } else {
        setStore(data as StoreInfo);
        try {
          localStorage.setItem(STOREFRONT_KEY, data.slug);
        } catch {
          /* ignore */
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (authLoading || !user || !store) return;
    const isOwner = store.user_id === user.id;
    if (isOwner) return;

    void supabase.rpc("register_store_referral", { p_slug: store.slug }).then(() => undefined, () => undefined);
  }, [authLoading, user, store]);

  useEffect(() => {
    if (!store) return;
    const url = `https://donmacdatahub.com/${store.slug}`;
    const title = `${store.full_name} – Buy Data Bundles | Donmac Data Hub`;
    const prevTitle = document.title;
    document.title = title;

    const upsertMeta = (selector: string, attr: string, key: string, value: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", value);
      return el;
    };
    const ogTitle = upsertMeta('meta[property="og:title"]', "property", "og:title", title);
    const ogUrl = upsertMeta('meta[property="og:url"]', "property", "og:url", url);
    const twTitle = upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const prevCanonical = canonical?.href;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = url;

    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.id = "storefront-jsonld";
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: store.full_name,
      url,
      telephone: store.whatsapp,
      description: store.store_message || `Buy MTN, Telecel and AirtelTigo data bundles from ${store.full_name}.`,
    });
    document.getElementById("storefront-jsonld")?.remove();
    document.head.appendChild(ld);

    return () => {
      document.title = prevTitle;
      if (prevCanonical && canonical) canonical.href = prevCanonical;
      document.getElementById("storefront-jsonld")?.remove();
      ogTitle.setAttribute("content", "Donmac Data Hub – Cheap Data Bundles & Reselling in Ghana");
      twTitle.setAttribute("content", "Donmac Data Hub – Cheap Data Bundles & Reselling in Ghana");
      ogUrl.setAttribute("content", "https://donmacdatahub.com");
    };
  }, [store]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <Store className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Store not found</h1>
          <p className="text-muted-foreground mb-6">
            The reseller store <span className="font-mono">/{slug}</span> doesn't exist or is no longer active.
          </p>
          <Button asChild className="gradient-primary border-0">
            <Link to="/">Back to Home</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const waLink = store.whatsapp
    ? `https://wa.me/${store.whatsapp.replace(/^0/, "233").replace(/\D/g, "")}`
    : "";

  return (
    <div className="min-h-screen bg-background">
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-primary opacity-95" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 py-14 sm:py-20 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Store className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <span className="inline-block px-3 py-1 rounded-full bg-white/15 text-primary-foreground text-xs font-semibold mb-3">
            OFFICIAL STORE
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-primary-foreground mb-3 leading-tight">
            {store.full_name}
          </h1>
          {store.store_message && (
            <p className="text-base sm:text-lg text-primary-foreground/90 max-w-2xl mx-auto mb-6 whitespace-pre-line">
              {store.store_message}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {user ? (
              <Button asChild size="lg" variant="secondary" className="text-base font-bold px-8 shadow-lg">
                <Link to="/dashboard">
                  Enter Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" variant="secondary" className="text-base font-bold px-8 shadow-lg">
                  <Link to={`/${store.slug}/register`}>
                    Create Account <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="text-base font-bold px-8 bg-white/10 text-primary-foreground border-white/40 hover:bg-white/20 hover:text-primary-foreground"
                >
                  <Link to={`/${store.slug}/login`}>Sign In</Link>
                </Button>
              </>
            )}
          </div>

          {waLink && (
            <div className="mt-6">
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-primary-foreground/90 text-sm hover:underline"
              >
                <MessageCircle className="w-4 h-4" />
                Chat with {store.full_name} on WhatsApp
              </a>
            </div>
          )}
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">
          Buy Data, Airtime & More — Cheap & Fast
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5 text-center">
            <Zap className="w-8 h-8 text-primary mx-auto mb-2" />
            <h3 className="font-bold mb-1">Fast Delivery</h3>
            <p className="text-sm text-muted-foreground">Airtime & Mashup instant. MTN within 3–30 minutes.</p>
          </Card>
          <Card className="p-5 text-center">
            <Wallet className="w-8 h-8 text-primary mx-auto mb-2" />
            <h3 className="font-bold mb-1">Wallet Top-Up</h3>
            <p className="text-sm text-muted-foreground">Send MoMo and your wallet credits automatically.</p>
          </Card>
          <Card className="p-5 text-center">
            <ShieldCheck className="w-8 h-8 text-primary mx-auto mb-2" />
            <h3 className="font-bold mb-1">Secure & Trusted</h3>
            <p className="text-sm text-muted-foreground">Backed by Donmac Data Hub fulfillment.</p>
          </Card>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">
          Store Prices
        </h2>
        <div className="space-y-6">
          {networks.map((net) => (
            <Card key={net.id} className="overflow-hidden border-border/50">
              <div className={`${net.gradient} px-4 py-2 text-white font-bold flex items-center justify-between`}>
                <span>{net.name} DATA</span>
                <Badge variant="outline" className="bg-white/20 text-white border-0 text-[10px] uppercase tracking-wider">BUNDLES</Badge>
              </div>
              <div className="p-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {net.bundles.slice(0, 8).map((b) => (
                  <div key={b.size} className="bg-accent/30 rounded-lg p-2 text-center border border-border/50">
                    <p className="text-xs font-semibold text-muted-foreground">{b.size}</p>
                    <p className="text-lg font-bold text-foreground">
                      {formatCurrency(getResellerPrice(net.id, b.size, b.price))}
                    </p>
                  </div>
                ))}
                <div className="bg-primary/5 rounded-lg p-2 text-center border border-primary/20 flex items-center justify-center italic text-[10px] text-primary/80">
                  + More sizes in app
                </div>
              </div>
            </Card>
          ))}

        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 pb-12">
        <Card className="p-8 text-center border-primary/20 bg-primary/5 shadow-inner">
          <h2 className="text-2xl font-bold text-foreground mb-2">Ready to shop?</h2>
          <p className="text-muted-foreground mb-5">
            Create an account in seconds — you'll be linked to {store.full_name}'s store automatically.
          </p>
          <Button asChild size="lg" className="gradient-primary border-0 text-base font-bold px-8">
            <Link to={`/${store.slug}/register`}>
              Get Started <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </Card>
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Powered by <span className="font-semibold text-foreground">Donmac Data Hub</span>
      </footer>
    </div>
  );
}

export { STOREFRONT_KEY };
