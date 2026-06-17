import { useCanonical } from "@/hooks/useCanonical";
import { Link } from "react-router-dom";
import {
  Zap,
  Shield,
  TrendingUp,
  Wallet,
  ChevronRight,
  MessageCircle,
  Store,
  Percent,
  Users,
  LogIn,
  Smartphone,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { networks, formatCurrency } from "@/lib/data";

const RESELLER_WHATSAPP = "233549358359";
const RESELLER_MSG = encodeURIComponent(
  "Hi Donmac, I want to become a reseller. Please help me get started."
);

const benefits = [
  {
    icon: TrendingUp,
    title: "Set Your Own Prices",
    desc: "Set your own prices — keep 100% of the profit.",
  },
  {
    icon: Wallet,
    title: "Withdraw Anytime",
    desc: "Request payout to your MoMo once your profit balance reaches ₵30.",
  },
  {
    icon: Store,
    title: "Your Own Storefront",
    desc: "Get a personal link (e.g. donmacdatahubgh.com/yourstore) with your name & WhatsApp.",
  },
  {
    icon: Zap,
    title: "Instant Fulfillment",
    desc: "Orders go straight to our servers. Mashup & airtime are instant, MTN 3–30 minutes.",
  },
  {
    icon: Shield,
    title: "Secure Wallet System",
    desc: "Auto-claim MoMo top-ups via your reference code. No admin wait.",
  },
  {
    icon: Percent,
    title: "Low Wholesale Prices",
    desc: "Wholesale rates so even with markup, your customers still pay less.",
  },
];

const steps = [
  {
    step: "1",
    title: "Click 'Become a Reseller'",
    desc: "Send us a WhatsApp message — we'll respond within minutes.",
  },
  {
    step: "2",
    title: "Get Your Store Link",
    desc: "We create your storefront and send your unique link.",
  },
  {
    step: "3",
    title: "Share & Earn",
    desc: "Share with customers, set markups, and watch profits roll in.",
  },
];

const networkCardGradients: Record<string, string> = {
  "mtn-mashup-data": "bg-gradient-to-br from-purple-600 to-purple-800",
  "mtn-mashup-minutes": "bg-gradient-to-br from-pink-600 to-rose-700",
  mtn: "bg-gradient-to-br from-yellow-400 to-yellow-600",
  telecel: "bg-gradient-to-br from-red-500 to-red-700",
  "at-bigtime": "bg-gradient-to-br from-sky-500 to-sky-700",
  "at-premium": "bg-gradient-to-br from-sky-600 to-sky-800",
};

const networkCardTextColors: Record<string, string> = {
  mtn: "text-black",
  telecel: "text-white",
  "at-bigtime": "text-white",
  "at-premium": "text-white",
  "mtn-mashup-data": "text-white",
  "mtn-mashup-minutes": "text-white",
};

function networkIcon(id: string) {
  if (id.includes("mashup")) return Clock;
  return Smartphone;
}

export default function Landing() {
  useCanonical("/");

  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "landing-jsonld";
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Donmac Data Hub",
      url: "https://donmacdatahub.com",
      description:
        "Donmac Data Hub — Ghana's reseller platform for cheap MTN, Telecel & AirtelTigo data bundles. Become a reseller and earn.",
      logo: "https://donmacdatahub.com/favicon.png",
    });
    document.head.appendChild(script);
    return () => {
      document.getElementById("landing-jsonld")?.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav with Sign In */}
      <nav className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 sm:px-8 py-4">
        <div className="flex items-center gap-2">
          <img
            src="/favicon.png"
            alt="Donmac Data Hub"
            className="w-8 h-8 rounded-lg"
          />
          <span className="font-bold text-primary-foreground hidden sm:inline">
            Donmac Data Hub
          </span>
        </div>
        <Button
          asChild
          size="sm"
          variant="secondary"
          className="font-semibold shadow-md"
        >
          <Link to="/login">
            <LogIn className="w-4 h-4 mr-1" /> Sign In
          </Link>
        </Button>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-primary opacity-95" />
        <div className="relative z-10 max-w-5xl mx-auto px-4 pt-24 pb-16 sm:pt-28 sm:pb-24 text-center">
          <div className="flex justify-center mb-6">
            <img
              src="/favicon.png"
              alt="Donmac Data Hub"
              className="w-16 h-16 rounded-xl"
            />
          </div>
          <span className="inline-block px-3 py-1 rounded-full bg-white/15 text-primary-foreground text-xs font-semibold mb-4">
            RESELLERS ONLY · GHANA
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-primary-foreground mb-4 leading-tight">
            Start Your Own Data Business Today
          </h1>
          <p className="text-lg sm:text-xl text-primary-foreground/90 max-w-2xl mx-auto mb-8">
            Become a Donmac reseller. Get wholesale prices on MTN, Telecel &
            AirtelTigo data, set your own markup, and earn profit on every sale
            — paid straight to your MoMo.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="text-base font-bold px-8 shadow-lg"
            >
              <a
                href={`https://wa.me/${RESELLER_WHATSAPP}?text=${RESELLER_MSG}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Become a Reseller
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="text-base font-bold px-8 bg-white/10 text-primary-foreground border-white/40 hover:bg-white/20 hover:text-primary-foreground"
            >
              <Link to="/login">
                <LogIn className="w-5 h-5 mr-2" /> Sign In
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Benefits */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-2">
          Why Become a Reseller?
        </h2>
        <p className="text-center text-muted-foreground mb-8">
          Everything you need to run a profitable data business.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => (
            <article
              key={b.title}
              className="bg-card border border-border rounded-xl p-5"
            >
              <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center mb-3">
                <b.icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <h3 className="font-bold text-foreground mb-1">{b.title}</h3>
              <p className="text-sm text-muted-foreground">{b.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Browse Packages */}
      <section className="bg-muted/50 py-12">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-2">
            Browse Available Packages
          </h2>
          <p className="text-center text-muted-foreground mb-8">
            New bundles added — MTN Mashup Data, MTN Mashup Minutes + Data, and
            more. All prices are general user prices; resellers get even lower
            wholesale rates.
          </p>
          <div className="space-y-8">
            {networks.map((net) => {
              const Icon = networkIcon(net.id);
              const textColor = networkCardTextColors[net.id] ?? "text-white";
              const gradient =
                networkCardGradients[net.id] ??
                "bg-gradient-to-br from-gray-700 to-gray-900";
              return (
                <div
                  key={net.id}
                  className="bg-card border border-border rounded-2xl overflow-hidden"
                >
                  <div
                    className={`px-6 py-4 ${gradient} ${textColor} flex items-center gap-3`}
                  >
                    <Icon className="w-5 h-5" />
                    <h3 className="font-bold text-base sm:text-lg">
                      {net.name}
                    </h3>
                  </div>
                  <div className="p-4 sm:p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {net.bundles.map((bundle) => (
                        <div
                          key={bundle.size}
                          className="rounded-xl border border-border bg-background p-3 text-center hover:shadow-md transition-shadow"
                        >
                          <p className="font-bold text-foreground text-sm">
                            {bundle.size}
                          </p>
                          <p className="text-primary font-semibold text-sm mt-1">
                            {formatCurrency(bundle.generalPrice)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-center mt-8">
            <Button
              asChild
              size="lg"
              className="gradient-primary border-0 text-base font-bold px-8"
            >
              <Link to="/register">
                Get Started <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8">
          Get Started in 3 Steps
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.step}
              className="bg-card border border-border rounded-xl p-6 text-center"
            >
              <div className="w-10 h-10 gradient-primary rounded-full mx-auto mb-3 flex items-center justify-center text-primary-foreground font-bold">
                {s.step}
              </div>
              <h3 className="font-semibold text-foreground mb-1">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 py-12 text-center">
        <div className="bg-card border border-border rounded-2xl p-8">
          <div className="flex justify-center mb-3">
            <Users className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
            Ready to Start Earning?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Click below to message us on WhatsApp. We'll set up your reseller
            account and storefront within minutes.
          </p>
          <Button
            asChild
            size="lg"
            className="gradient-primary border-0 text-base font-bold px-8"
          >
            <a
              href={`https://wa.me/${RESELLER_WHATSAPP}?text=${RESELLER_MSG}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="w-5 h-5 mr-2" /> Become a Reseller{" "}
              <ChevronRight className="w-4 h-4 ml-1" />
            </a>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        <p>© 2026 Donmac Data Hub · Reseller Platform · Ghana</p>
      </footer>
    </div>
  );
}
