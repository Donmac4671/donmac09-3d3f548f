// Public API for external sites to place data orders via the user's wallet.
// Endpoints:
//   GET  /networks                 → list available networks + bundles + prices
//   GET  /wallet/balance           → caller's wallet balance
//   POST /orders                   → place order { network, phone, bundle }
//   GET  /orders/:ref              → order status
//
// Authentication: Authorization: Bearer dmh_live_<token>
//
// Note: deployed with verify_jwt = false; auth is via the API token.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

async function authenticate(req: Request): Promise<{ userId: string } | Response> {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return json({ error: "Missing API token. Use 'Authorization: Bearer <token>'." }, 401);
  }
  const token = auth.slice(7).trim();
  if (!token.startsWith("dmh_live_")) return json({ error: "Invalid token format" }, 401);
  const hash = await sha256Hex(token);
  const { data, error } = await admin
    .from("api_tokens")
    .select("user_id, revoked_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (error || !data) return json({ error: "Invalid or revoked token" }, 401);
  if (data.revoked_at) return json({ error: "Token revoked" }, 401);
  // touch last_used_at (fire and forget)
  void admin.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("token_hash", hash);
  return { userId: data.user_id as string };
}

async function logRequest(
  userId: string | null,
  endpoint: string,
  method: string,
  status: number,
  request_body: unknown,
  response_body: unknown,
  error?: string
) {
  await admin.from("api_order_logs").insert({
    user_id: userId,
    endpoint,
    method,
    status_code: status,
    request_body: request_body ?? null,
    response_body: response_body ?? null,
    error: error ?? null,
  });
}

// ---- Bundle catalog (must match src/lib/data.ts) ----
// Kept inline so the API is self-contained. Update prices here when you change them in the app.
const NETWORKS = [
  {
    id: "mtn-mashup-data",
    name: "MTN MASHUP DATA",
    bundles: [
      { size: "1.7GB", price: 6 }, { size: "3.4GB", price: 12 }, { size: "5.1GB", price: 18 },
      { size: "6.8GB", price: 24 }, { size: "8.5GB", price: 30 }, { size: "10.2GB", price: 36 },
      { size: "15.3GB", price: 54 }, { size: "20.4GB", price: 72 },
    ],
  },
  {
    id: "mtn-mashup-minutes",
    name: "MTN MASHUP MINUTES + DATA",
    bundles: [
      { size: "350min+870MB", price: 20 }, { size: "700min+1.6GB", price: 30 },
      { size: "1000min+2.6GB", price: 40 }, { size: "1400min+3.5GB", price: 50 },
    ],
  },
  {
    id: "telecel",
    name: "TELECEL",
    bundles: [
      { size: "2GB", price: 9.5 }, { size: "3GB", price: 14.2 }, { size: "5GB", price: 21.2 },
      { size: "10GB", price: 40 }, { size: "15GB", price: 59 }, { size: "20GB", price: 79 },
      { size: "25GB", price: 97 }, { size: "30GB", price: 116 }, { size: "40GB", price: 154 },
      { size: "50GB", price: 189 },
    ],
  },
];

function findBundle(networkId: string, size: string) {
  const n = NETWORKS.find((x) => x.id === networkId);
  if (!n) return null;
  const b = n.bundles.find((x) => x.size.toLowerCase() === size.toLowerCase());
  if (!b) return null;
  return { network: n, bundle: b };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  // Strip the /public-api prefix added by Supabase routing
  const path = url.pathname.replace(/^\/public-api/, "") || "/";
  const method = req.method.toUpperCase();

  try {
    // ---- GET /networks (public) ----
    if (method === "GET" && path === "/networks") {
      return json({ networks: NETWORKS });
    }

    // All other endpoints require auth
    const authResult = await authenticate(req);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    // ---- GET /wallet/balance ----
    if (method === "GET" && path === "/wallet/balance") {
      const { data, error } = await admin.from("profiles").select("wallet_balance").eq("user_id", userId).maybeSingle();
      if (error) {
        await logRequest(userId, path, method, 500, null, null, error.message);
        return json({ error: error.message }, 500);
      }
      const body = { balance: Number(data?.wallet_balance ?? 0), currency: "GHS" };
      await logRequest(userId, path, method, 200, null, body);
      return json(body);
    }

    // ---- GET /orders/:ref ----
    const orderMatch = path.match(/^\/orders\/([^/]+)$/);
    if (method === "GET" && orderMatch) {
      const ref = orderMatch[1];
      const { data, error } = await admin
        .from("orders")
        .select("order_ref, network, phone_number, bundle_size, amount, status, created_at, payment_method")
        .eq("user_id", userId)
        .eq("order_ref", ref)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Order not found" }, 404);
      await logRequest(userId, path, method, 200, null, data);
      return json({ order: data });
    }

    // ---- POST /orders ----
    if (method === "POST" && path === "/orders") {
      const body = await req.json().catch(() => ({}));
      const networkId = String(body.network ?? "").trim();
      const phone = String(body.phone ?? "").trim();
      const bundleSize = String(body.bundle ?? "").trim();

      if (!networkId || !phone || !bundleSize) {
        return json({ error: "Required fields: network, phone, bundle" }, 400);
      }
      if (!/^\d{10}$/.test(phone)) {
        return json({ error: "phone must be 10 digits" }, 400);
      }
      const found = findBundle(networkId, bundleSize);
      if (!found) {
        return json({ error: "Unknown network or bundle. Call GET /networks." }, 400);
      }

      const { data: rpc, error } = await admin.rpc("api_place_order_for_user", {
        p_user_id: userId,
        p_network: found.network.name,
        p_phone: phone,
        p_bundle: found.bundle.size,
        p_amount: found.bundle.price,
      });

      if (error) {
        await logRequest(userId, path, method, 400, body, null, error.message);
        return json({ error: error.message }, 400);
      }
      const row = Array.isArray(rpc) ? rpc[0] : rpc;
      const orderId = row?.order_id;

      // Call fulfill-order directly for data bundles to submit immediately to GHData
      if (orderId && found.network.id !== "airtime" && found.network.id !== "mashup" && found.network.id !== "vs") {
        try {
          const sizeMatch = found.bundle.size.match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
          let bundleSizeGb = 1;
          if (sizeMatch) {
            const val = parseFloat(sizeMatch[1]);
            const unit = sizeMatch[2].toUpperCase();
            bundleSizeGb = unit === "MB" ? val / 1000 : val;
          }

          console.log(`📡 Public API calling fulfill-order for order ${orderId}`);
          const fulfillResponse = await fetch(`${SUPABASE_URL}/functions/v1/fulfill-order`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SERVICE_KEY}`,
            },
            body: JSON.stringify({
              order_id: orderId,
              network_id: found.network.id,
              phone: phone,
              bundle_size_gb: bundleSizeGb,
            }),
          });
          const fulfillResult = await fulfillResponse.json().catch(() => ({}));
          console.log(`📡 Public API fulfill-order response:`, fulfillResult);
        } catch (err) {
          console.error(`❌ Public API fulfill-order failed:`, err);
        }
      }

      const out = {
        order_ref: row?.order_ref,
        status: "processing",
        network: found.network.name,
        bundle: found.bundle.size,
        phone,
        amount: found.bundle.price,
        currency: "GHS",
      };
      await logRequest(userId, path, method, 200, body, out);
      return json(out, 201);
    }

    return json({ error: `No route for ${method} ${path}` }, 404);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return json({ error: msg }, 500);
  }
});
