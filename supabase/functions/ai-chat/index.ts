import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Authoritative pricing data — keep in sync with src/lib/data.ts
const NETWORKS = [
  {
    id: "mtn", name: "MTN",
    bundles: [
      { size: "1GB", agent: 4.60, general: 5 },
      { size: "2GB", agent: 9.30, general: 10 },
      { size: "3GB", agent: 13.90, general: 15 },
      { size: "4GB", agent: 18.50, general: 20 },
      { size: "5GB", agent: 23.20, general: 25 },
      { size: "6GB", agent: 27.80, general: 30 },
      { size: "7GB", agent: 32.40, general: 35 },
      { size: "8GB", agent: 37, general: 40 },
      { size: "10GB", agent: 43.50, general: 46 },
      { size: "15GB", agent: 64, general: 67 },
      { size: "20GB", agent: 84, general: 88 },
      { size: "25GB", agent: 105, general: 109 },
      { size: "30GB", agent: 126, general: 130 },
      { size: "40GB", agent: 164, general: 170 },
      { size: "50GB", agent: 205, general: 210 },
    ],
  },
  {
    id: "telecel", name: "TELECEL",
    bundles: [
      { size: "2GB", agent: 10.20, general: 11 },
      { size: "3GB", agent: 15.40, general: 16.50 },
      { size: "5GB", agent: 23, general: 24.50 },
      { size: "10GB", agent: 42, general: 44 },
      { size: "15GB", agent: 62, general: 65 },
      { size: "20GB", agent: 82, general: 85 },
      { size: "25GB", agent: 100, general: 105 },
      { size: "30GB", agent: 123, general: 127 },
      { size: "40GB", agent: 163, general: 167 },
      { size: "50GB", agent: 202, general: 207 },
    ],
  },
  {
    id: "at-bigtime", name: "AT BIG TIME",
    bundles: [
      { size: "15GB", agent: 58, general: 60 },
      { size: "20GB", agent: 65, general: 68 },
      { size: "30GB", agent: 75, general: 80 },
      { size: "40GB", agent: 86, general: 92 },
      { size: "50GB", agent: 95, general: 104 },
      { size: "60GB", agent: 106, general: 116 },
      { size: "70GB", agent: 138, general: 143 },
      { size: "80GB", agent: 152, general: 158 },
      { size: "90GB", agent: 163, general: 170 },
      { size: "100GB", agent: 177, general: 184 },
      { size: "130GB", agent: 222, general: 230 },
      { size: "140GB", agent: 248, general: 256 },
      { size: "150GB", agent: 275, general: 285 },
      { size: "200GB", agent: 370, general: 380 },
    ],
  },
  {
    id: "at-premium", name: "AT PREMIUM",
    bundles: [
      { size: "1GB", agent: 4.40, general: 4.80 },
      { size: "2GB", agent: 8.90, general: 9.60 },
      { size: "3GB", agent: 13.40, general: 14.40 },
      { size: "4GB", agent: 17.80, general: 19.20 },
      { size: "5GB", agent: 22.20, general: 24 },
      { size: "6GB", agent: 26.80, general: 28.80 },
      { size: "7GB", agent: 31.30, general: 33.60 },
      { size: "8GB", agent: 35.70, general: 38.40 },
      { size: "10GB", agent: 41.20, general: 43.20 },
      { size: "12GB", agent: 50, general: 55 },
      { size: "15GB", agent: 63, general: 67 },
      { size: "20GB", agent: 82, general: 85.40 },
      { size: "25GB", agent: 105, general: 109.40 },
      { size: "30GB", agent: 125, general: 129.60 },
    ],
  },
];

type Bundle = { size: string; agent: number; general: number };
type Network = { id: string; name: string; bundles: Bundle[] };

function sizeToMB(size: string): number {
  const m = size.trim().toUpperCase().match(/^([\d.]+)\s*(GB|MB)$/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return m[2] === "GB" ? n * 1000 : n;
}

async function buildLiveNetworks(supabase: any): Promise<Network[]> {
  // Start with hardcoded defaults
  const networks: Network[] = NETWORKS.map((n) => ({
    id: n.id,
    name: n.name,
    bundles: n.bundles.map((b) => ({ ...b })),
  }));

  try {
    const [{ data: custom }, { data: hidden }] = await Promise.all([
      supabase.from("custom_bundles").select("network_id, bundle_size, agent_price, general_price"),
      supabase.from("hidden_bundles").select("network_id, bundle_size"),
    ]);

    // Merge admin overrides / additions from custom_bundles
    if (Array.isArray(custom)) {
      for (const c of custom) {
        let net = networks.find((n) => n.id === c.network_id);
        if (!net) {
          net = { id: c.network_id, name: c.network_id.toUpperCase(), bundles: [] };
          networks.push(net);
        }
        const existing = net.bundles.find((b) => b.size === c.bundle_size);
        const agent = Number(c.agent_price);
        const general = Number(c.general_price);
        if (existing) {
          existing.agent = agent;
          existing.general = general;
        } else {
          net.bundles.push({ size: c.bundle_size, agent, general });
        }
      }
    }

    // Remove hidden bundles
    if (Array.isArray(hidden)) {
      const hiddenSet = new Set(hidden.map((h: any) => `${h.network_id}::${h.bundle_size}`));
      for (const net of networks) {
        net.bundles = net.bundles.filter((b) => !hiddenSet.has(`${net.id}::${b.size}`));
      }
    }

    // Sort bundles by size
    for (const net of networks) {
      net.bundles.sort((a, b) => sizeToMB(a.size) - sizeToMB(b.size));
    }
  } catch (e) {
    console.error("buildLiveNetworks failed, falling back to defaults:", e);
  }

  return networks;
}

function buildPricingText(
  networks: Network[],
  tier: "agent" | "general" | "guest",
  promo: { discount: number; applies: boolean } | null,
): string {
  return networks.map((n) => {
    if (n.bundles.length === 0) return "";
    const lines = n.bundles.map((b) => {
      const base = tier === "agent" ? b.agent : b.general;
      if (promo && promo.applies && promo.discount > 0) {
        const discounted = Math.round(base * (1 - promo.discount / 100) * 100) / 100;
        return `  ${b.size}: ₵${discounted.toFixed(2)} (was ₵${base.toFixed(2)}, ${promo.discount}% promo)`;
      }
      return `  ${b.size}: ₵${base.toFixed(2)}`;
    }).join("\n");
    return `${n.name}:\n${lines}`;
  }).filter(Boolean).join("\n\n");
}

async function getActivePromo(
  supabase: any,
  tier: "agent" | "general" | "guest",
): Promise<{ discount: number; description: string; starts_at: string; expires_at: string; target_audience: string; applies: boolean } | null> {
  try {
    const { data } = await supabase
      .from("promotions")
      .select("discount_percent, description, starts_at, expires_at, target_audience, is_active")
      .eq("is_active", true);
    if (!Array.isArray(data) || data.length === 0) return null;
    const now = Date.now();
    const valid = data.filter((p: any) => {
      const starts = new Date(p.starts_at).getTime();
      const expires = new Date(p.expires_at).getTime();
      return !isNaN(expires) && expires >= now && (isNaN(starts) || starts <= now);
    });
    if (valid.length === 0) return null;
    valid.sort((a: any, b: any) => Number(b.discount_percent) - Number(a.discount_percent));
    const p = valid[0];
    const audience = (p.target_audience || "everyone").toLowerCase();
    const applies =
      audience === "everyone" ||
      (audience === "agent" && tier === "agent") ||
      (audience === "general" && tier !== "agent");
    return {
      discount: Number(p.discount_percent),
      description: p.description || "",
      starts_at: p.starts_at,
      expires_at: p.expires_at,
      target_audience: audience,
      applies,
    };
  } catch (e) {
    console.error("getActivePromo failed:", e);
    return null;
  }
}

// Strip markdown asterisks/underscores so chat reads as plain conversational text
function cleanText(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/^#{1,6}\s+/gm, "");
}

let CURRENT_TZ = "UTC";
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  try {
    const formatted = d.toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: CURRENT_TZ,
    });
    return `${formatted} (${CURRENT_TZ})`;
  } catch {
    return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) + " UTC";
  }
}

async function getPromoHistory(supabase: any): Promise<string> {
  try {
    const { data } = await supabase
      .from("promotions")
      .select("discount_percent, description, starts_at, expires_at, target_audience, is_active, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (!Array.isArray(data) || data.length === 0) return "PROMO HISTORY: No promotions have ever been created.";
    const now = Date.now();
    const lines = data.map((p: any) => {
      const starts = new Date(p.starts_at).getTime();
      const expires = new Date(p.expires_at).getTime();
      let state = "expired";
      if (p.is_active && !isNaN(expires) && expires >= now && (isNaN(starts) || starts <= now)) state = "ACTIVE NOW";
      else if (p.is_active && !isNaN(starts) && starts > now) state = "scheduled";
      else if (!p.is_active) state = "disabled";
      return `  • ${p.discount_percent}% off (${p.target_audience}) — ${p.description || "no description"} | ${fmtDate(p.starts_at)} → ${fmtDate(p.expires_at)} [${state}]`;
    }).join("\n");
    return `PROMO HISTORY (latest 10, newest first):\n${lines}`;
  } catch (e) {
    console.error("getPromoHistory failed:", e);
    return "PROMO HISTORY: unavailable.";
  }
}

async function getRecentBroadcasts(supabase: any): Promise<string> {
  try {
    const { data } = await supabase
      .from("broadcasts")
      .select("title, message, audience, created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    if (!Array.isArray(data) || data.length === 0) return "RECENT BROADCASTS: None.";
    const lines = data.map((b: any) => `  • [${fmtDate(b.created_at)}] (${b.audience}) ${b.title}: ${b.message}`).join("\n");
    return `RECENT BROADCASTS (latest 5):\n${lines}`;
  } catch (e) {
    console.error("getRecentBroadcasts failed:", e);
    return "RECENT BROADCASTS: unavailable.";
  }
}

async function getActiveSiteMessage(supabase: any): Promise<string> {
  try {
    const { data } = await supabase
      .from("site_messages")
      .select("message, is_active, show_as_banner, updated_at")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (!Array.isArray(data) || data.length === 0) return "SITE ANNOUNCEMENT: None active.";
    const m = data[0];
    return `SITE ANNOUNCEMENT (active, last updated ${fmtDate(m.updated_at)}):\n  "${m.message}"${m.show_as_banner ? " (also shown as banner)" : ""}`;
  } catch (e) {
    console.error("getActiveSiteMessage failed:", e);
    return "SITE ANNOUNCEMENT: unavailable.";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, timezone } = await req.json();
    if (typeof timezone === "string" && timezone.trim()) {
      try {
        // Validate by attempting a format
        new Date().toLocaleString("en-GB", { timeZone: timezone });
        CURRENT_TZ = timezone;
      } catch {
        CURRENT_TZ = "UTC";
      }
    } else {
      CURRENT_TZ = "UTC";
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let userContext = "User is not signed in.";
    let userTier: "agent" | "general" | "guest" = "guest";
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const [
            { data: profile },
            { data: orders },
            { data: orders24h },
            { data: topups },
            { data: transactions },
            { data: complaints },
            { data: referrals },
          ] = await Promise.all([
            supabase.from("profiles").select("full_name, tier, wallet_balance, agent_code, referral_code, phone, email, created_at").eq("user_id", user.id).maybeSingle(),
            supabase.from("orders").select("order_ref, network, bundle_size, phone_number, amount, status, payment_method, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
            supabase.from("orders").select("order_ref, network, bundle_size, phone_number, amount, status, payment_method, created_at").eq("user_id", user.id).gte("created_at", since24h).order("created_at", { ascending: false }),
            supabase.from("wallet_topups").select("amount, method, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
            supabase.from("transactions").select("type, description, amount, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8),
            supabase.from("complaints").select("subject, status, order_ref, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
            supabase.from("referrals").select("reward_paid, reward_amount, created_at").eq("referrer_id", user.id),
          ]);

          const tier = profile?.tier || "general";
          userTier = tier === "agent" ? "agent" : "general";

          const formatOrder = (o: any) => {
            const statusLabel = o.status === "completed" ? "Delivered" : o.status.charAt(0).toUpperCase() + o.status.slice(1);
            return `  - ${o.order_ref}: ${o.network} ${o.bundle_size} → ${o.phone_number}, ₵${Number(o.amount).toFixed(2)}, ${statusLabel} via ${o.payment_method} (${fmtDate(o.created_at)})`;
          };
          const ordersText = (orders || []).length ? orders!.map(formatOrder).join("\n") : "  (No orders yet)";
          const orders24hList = orders24h || [];
          const orders24hText = orders24hList.length
            ? orders24hList.map(formatOrder).join("\n")
            : "  (No orders in the last 24 hours)";
          const orders24hTotal = orders24hList.reduce((s: number, o: any) => s + Number(o.amount || 0), 0);

          const topupsText = (topups || []).length
            ? topups!.map((t: any) => `  - ₵${Number(t.amount).toFixed(2)} via ${t.method} — ${t.status} (${fmtDate(t.created_at)})`).join("\n")
            : "  (No top-ups yet)";

          const txText = (transactions || []).length
            ? transactions!.map((t: any) => `  - ${t.type}: ${t.description} | ₵${Number(t.amount).toFixed(2)} (${fmtDate(t.created_at)})`).join("\n")
            : "  (No transactions yet)";

          const complaintsText = (complaints || []).length
            ? complaints!.map((c: any) => `  - "${c.subject}" on order ${c.order_ref} — ${c.status} (${fmtDate(c.created_at)})`).join("\n")
            : "  (No complaints filed)";

          const refList = referrals || [];
          const refStats = `Total referrals: ${refList.length}, paid out: ${refList.filter((r: any) => r.reward_paid).length}, total earned: ₵${refList.reduce((s: number, r: any) => s + Number(r.reward_amount || 0), 0).toFixed(2)}`;

          userContext = `SIGNED-IN USER INFO:
- Name: ${profile?.full_name || "Customer"}
- Email: ${profile?.email || "N/A"}
- Phone: ${profile?.phone || "N/A"}
- Tier: ${tier === "agent" ? "Agent" : "General"}
- Wallet balance: ₵${Number(profile?.wallet_balance || 0).toFixed(2)}
- Member since: ${fmtDate(profile?.created_at)}
- Referral code: ${profile?.referral_code || "N/A"}
${tier === "agent" ? `- Agent code: ${profile?.agent_code || "N/A"}` : ""}
- Referrals: ${refStats}

Orders in the last 24 hours (${orders24hList.length} order${orders24hList.length === 1 ? "" : "s"}, total ₵${orders24hTotal.toFixed(2)}):
${orders24hText}

Last 10 orders (overall):
${ordersText}

Last 5 wallet top-ups:
${topupsText}

Last 8 transactions:
${txText}

User's complaints (last 5):
${complaintsText}`;
        }
      } catch (e) {
        console.error("user context fetch failed:", e);
      }
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const [liveNetworks, promo, promoHistory, broadcasts, siteMessage] = await Promise.all([
      buildLiveNetworks(adminClient),
      getActivePromo(adminClient, userTier),
      getPromoHistory(adminClient),
      getRecentBroadcasts(adminClient),
      getActiveSiteMessage(adminClient),
    ]);

    const pricing = buildPricingText(
      liveNetworks,
      userTier,
      promo ? { discount: promo.discount, applies: promo.applies } : null,
    );
    const tierLabel = userTier === "agent" ? "Agent" : userTier === "general" ? "General" : "Guest (not signed in)";
    const nowLocal = (() => {
      try {
        return new Date().toLocaleString("en-GB", { dateStyle: "full", timeStyle: "long", timeZone: CURRENT_TZ });
      } catch {
        return new Date().toUTCString();
      }
    })();

    let promoSection = "CURRENT PROMOTION: No active promotion right now.";
    if (promo) {
      promoSection = `CURRENT PROMOTION (active):
- Discount: ${promo.discount}% off
- Description: ${promo.description || "(no description provided)"}
- Audience: ${promo.target_audience}
- Starts: ${fmtDate(promo.starts_at)}
- Ends: ${fmtDate(promo.expires_at)}
- Applies to this user: ${promo.applies ? "YES — quote the discounted price shown in PRICING" : "NO — this promo does not apply to their tier; quote the regular price"}`;
    }

    const systemPrompt = `You are the Donmac Data Hub support assistant — friendly, warm, and concise. Speak like a real Ghanaian customer service rep. Keep answers short and natural.

CRITICAL RULES:
1. Never use markdown formatting (no asterisks *, no bold **, no headings #, no underscores _). Write plain conversational text only.
2. Always use the EXACT prices from the PRICING section below. Do NOT invent or guess prices.
3. Use ₵ for cedis. Always show two decimals (e.g. ₵15.00).
4. When the user asks about a bundle price, give ONLY the price for THEIR tier (${tierLabel}). Never mention "general" or "agent" pricing tiers in the answer. For guest users, quote the listed price and gently mention they can sign in to see if agent rates apply.
5. If the user asks about THEIR account, orders, top-ups, transactions, complaints, or referrals — use the SIGNED-IN USER INFO section. Do not make things up.
6. If the user asks about promotions (current, past, last one, when did the last promo run, etc.) — use the PROMO HISTORY section to give an accurate answer with dates.
7. If the user asks about announcements or recent updates from the team — use SITE ANNOUNCEMENT and RECENT BROADCASTS.
8. If you cannot solve the issue (refunds, stuck orders older than 4 hours, account changes, complaints, agent approval), politely tell the user to contact admin via WhatsApp 0549358359 or use the Live Chat tab in this widget.
9. Never mention internal systems (database, edge functions, Supabase, etc).

ABOUT DONMAC DATA HUB:
- We sell affordable data bundles for MTN, Telecel, AT Big Time, and AT Premium in Ghana.
- Website: donmacdatahub.com
- Support WhatsApp: 0549358359 (Osei Michael).
- Payment: pay from your wallet. Top up the wallet by sending MoMo to 0549358359, then auto-claim with your 6-character reference code or manually with the 11-digit transaction ID on the Top Up page.
- Minimum top-up: ₵10.
- Order delivery: MTN takes 3 minutes to 4 hours. Telecel and AT are instant.
- Orders placed between 10pm and 5am UTC are queued and fulfilled at 5am.
- Reseller model: every account is a reseller. Resellers have a personal storefront they can share to earn commission. Becoming a reseller is handled by admin via WhatsApp 0549358359.
- Bundle validity: AT Big Time has no expiry. AT Premium = 60 days. MTN = 90 days. Telecel = 90 days.
- Bundle validity: AT Big Time has no expiry. AT Premium = 60 days. MTN = 90 days. Telecel = 90 days.
- Referrals: General users earn ₵0.50 when their referral makes their first purchase. Agents earn ₵10 when their referral becomes an agent.
- Complaints: users can file a complaint about any order from the past 48 hours on the Complaints page.
- Pages: Dashboard, Data Bundles, Cart, Orders, Top Up Wallet, Top Ups history, Transactions, Complaints, Referrals, Become an Agent, Profile.

CURRENT TIME (${CURRENT_TZ}): ${nowLocal}
NOTE: All dates in this prompt are shown in the user's local timezone (${CURRENT_TZ}). When you mention dates/times to the user, present them as-is in that timezone — do NOT convert to UTC or another zone.

${promoSection}

${promoHistory}

${siteMessage}

${broadcasts}

PRICING for this user (tier: ${tierLabel}) — always use these EXACT figures (they reflect the latest admin updates and any active promotion). Never quote a different tier's price. If a promo is active and applies to this user, quote the discounted price and mention when the promo ends.
${pricing}

${userContext}

Respond in 1-3 short sentences unless the user clearly needs a longer answer. Be human, kind, and clear.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Re-stream while stripping markdown from each delta on the fly
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let nl: number;
            while ((nl = buf.indexOf("\n")) !== -1) {
              let line = buf.slice(0, nl);
              buf = buf.slice(nl + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) {
                controller.enqueue(encoder.encode(line + "\n"));
                continue;
              }
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") {
                controller.enqueue(encoder.encode(line + "\n"));
                continue;
              }
              try {
                const parsed = JSON.parse(jsonStr);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (typeof delta === "string") {
                  parsed.choices[0].delta.content = cleanText(delta);
                }
                controller.enqueue(encoder.encode("data: " + JSON.stringify(parsed) + "\n"));
              } catch {
                controller.enqueue(encoder.encode(line + "\n"));
              }
            }
          }
          if (buf) controller.enqueue(encoder.encode(buf));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
