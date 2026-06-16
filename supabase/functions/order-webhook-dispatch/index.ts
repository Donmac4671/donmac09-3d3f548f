// Receives order INSERT/UPDATE events from the DB trigger and forwards a signed
// webhook to the order owner's configured api_webhooks.url (if any).
//
// Payload to user webhook:
//   { event: "order.created" | "order.updated", order: { ref, network, phone, bundle, amount, status, created_at } }
// Signature header: X-DMH-Signature: sha256=<hex hmac of raw body using user's webhook secret>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const evt = await req.json();
    const op = evt?.type as string;
    const rec = evt?.record;
    const old = evt?.old_record;
    if (!rec || !rec.user_id) return new Response("ok");

    // Only react to INSERT or status changes on UPDATE
    if (op === "UPDATE" && old && old.status === rec.status) {
      return new Response("ok");
    }
    if (op !== "INSERT" && op !== "UPDATE") return new Response("ok");

    const { data: hook } = await admin
      .from("api_webhooks")
      .select("url, secret, is_active")
      .eq("user_id", rec.user_id)
      .maybeSingle();

    if (!hook || !hook.is_active || !hook.url) return new Response("ok");

    const payload = {
      event: op === "INSERT" ? "order.created" : "order.updated",
      order: {
        ref: rec.order_ref,
        network: rec.network,
        phone: rec.phone_number,
        bundle: rec.bundle_size,
        amount: Number(rec.amount),
        status: rec.status,
        created_at: rec.created_at,
      },
    };
    const body = JSON.stringify(payload);
    const sig = await hmacSha256Hex(hook.secret, body);

    let statusCode = 0;
    let respText = "";
    let err: string | null = null;
    try {
      const resp = await fetch(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-DMH-Signature": `sha256=${sig}`,
          "X-DMH-Event": payload.event,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      statusCode = resp.status;
      respText = (await resp.text()).slice(0, 2000);
    } catch (e) {
      err = (e as Error).message;
    }

    await admin.from("api_order_logs").insert({
      user_id: rec.user_id,
      endpoint: hook.url,
      method: "POST",
      status_code: statusCode || null,
      request_body: payload,
      response_body: respText ? { body: respText } : null,
      error: err,
    });

    return new Response("ok");
  } catch (e) {
    console.error("dispatch error", e);
    return new Response("error", { status: 500 });
  }
});
