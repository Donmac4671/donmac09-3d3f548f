import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GH_API_BASE = "https://ghdataconnect.com/api";

const NETWORK_KEYS: Record<string, string[]> = {
  mtn: ["mtn", "MTN"],
  telecel: ["telecel", "TELECEL"],
  "at-bigtime": ["atbigtime", "at_bigtime", "at-bigtime", "AT_BIGTIME", "AT-BIGTIME", "AIRTELTIGO_BIGTIME"],
  "at-big-time": ["atbigtime", "at_bigtime", "at-bigtime", "AT_BIGTIME", "AT-BIGTIME", "AIRTELTIGO_BIGTIME"],
  "at-premium": [
    "atpremium",
    "at_premium",
    "at-premium",
    "premium",
    "PREMIUM",
    "AT_PREMIUM",
    "AT-PREMIUM",
    "AIRTELTIGO_PREMIUM",
    "AIRTELTIGOPREMIUM",
    "AT_PREMIUM_BUNDLE",
    "AIRTELTIGO_PREMIUM_BUNDLE",
    "airteltigo_premium",
    "airteltigopremium",
  ],
};

const ENDPOINT = "/v1/purchaseBundle";

function normalizeNetworkKey(networkId: string): string {
  return networkId.toLowerCase().trim().replace(/\s+/g, "-");
}

function isNetworkValidationError(result: any, status: number): boolean {
  const message = String(result?.message ?? "").toLowerCase();
  const networkErrors = Array.isArray(result?.errors?.network)
    ? result.errors.network.join(" ").toLowerCase()
    : String(result?.errors?.network ?? "").toLowerCase();
  return (
    status === 422 &&
    (message.includes("validation") ||
      networkErrors.includes("network") ||
      networkErrors.includes("invalid") ||
      networkErrors.includes("selected"))
  );
}

const RequestSchema = z.object({
  order_id: z.string().uuid(),
  network_id: z.string(),
  phone: z.string().min(10).max(13),
  bundle_size_gb: z.number().positive(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GH_API_KEY = Deno.env.get("GHDATACONNECT_API_KEY");
    if (!GH_API_KEY) throw new Error("GHDATACONNECT_API_KEY is not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, message: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const isServiceRequest = token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    let user = null;
    let authError = null;

    if (!isServiceRequest) {
      const result = await supabase.auth.getUser(token);
      user = result.data.user;
      authError = result.error;
    }

    if (!isServiceRequest && (authError || !user)) {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid request", errors: parsed.error.flatten().fieldErrors }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { order_id, network_id, phone, bundle_size_gb } = parsed.data;

    // ============================================================
    // 🔥 BLOCK Airtime and Mashup - NEVER go to GHData
    // ============================================================
    if (network_id === "airtime" || network_id === "mashup" || network_id === "vs" || network_id === "mtn-mashup-data" || network_id === "mtn-mashup-minutes") {
      console.log(`🚫 Blocked ${network_id} order ${order_id} from GHData. Setting to processing (manual delivery).`);

      await supabase
        .from("orders")
        .update({
          status: "processing",
          gh_reference: `manual-${network_id}-${Date.now()}`,
        })
        .eq("id", order_id);

      return new Response(
        JSON.stringify({
          success: true,
          message: `${network_id} order set to processing (manual delivery required)`,
          product_type: network_id,
          order_id: order_id,
          status: "processing",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check if this is a valid GHData network
    const networkKey = normalizeNetworkKey(network_id);
    const candidateKeys = NETWORK_KEYS[networkKey];
    if (!candidateKeys) {
      return new Response(JSON.stringify({ success: false, message: `Unknown network: ${network_id}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch order and verify ownership
    const { data: orderRow, error: orderError } = await supabase
      .from("orders")
      .select("order_ref, user_id")
      .eq("id", order_id)
      .maybeSingle();

    if (orderError || !orderRow) {
      console.error("Order fetch error:", orderError);
      return new Response(JSON.stringify({ success: false, message: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin status
    const userId = user?.id || null;
    let isAdmin = isServiceRequest;

    if (!isAdmin && userId) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
    }

    if (!isAdmin && orderRow.user_id !== userId) {
      return new Response(JSON.stringify({ success: false, message: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate reference
    const reference = orderRow.order_ref || `DMH${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await supabase.from("orders").update({ gh_reference: reference }).eq("id", order_id);

    console.log(`📡 Fulfilling order ${order_id}: ${network_id} ${bundle_size_gb}GB to ${phone}`);

    let lastResult: any = null;
    let lastStatus = 0;
    const diagnostics: Array<{ key: string; status: number; message: string; errors?: any }> = [];
    let sawNetworkValidationError = false;

    for (const key of candidateKeys) {
      const requestBody = { network: key, reference, msisdn: phone, capacity: bundle_size_gb };
      console.log(
        "📤 GH request:",
        JSON.stringify({ order_id, networkKey, key, reference, msisdn: phone, capacity: bundle_size_gb }),
      );

      const response = await fetch(`${GH_API_BASE}${ENDPOINT}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GH_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      lastStatus = response.status;
      lastResult = await response.json().catch(() => ({}));
      console.log(`📥 GH response (key=${key}, status=${response.status}):`, JSON.stringify(lastResult));
      diagnostics.push({
        key,
        status: response.status,
        message: String(lastResult?.message ?? ""),
        errors: lastResult?.errors,
      });

      if (isNetworkValidationError(lastResult, response.status)) sawNetworkValidationError = true;

      if (lastResult?.success) {
        const actualRef = lastResult.data?.reference ?? lastResult.data?.id ?? lastResult.reference ?? reference;
        const nextStatus =
          networkKey === "at-premium" ? "completed" : networkKey === "mtn" ? "pending" : "processing";
        await supabase
          .from("orders")
          .update({ gh_reference: String(actualRef), status: nextStatus })
          .eq("id", order_id);

        console.log(`✅ Order ${order_id} fulfilled successfully. Status: ${nextStatus}`);
        return new Response(
          JSON.stringify({
            success: true,
            data: lastResult.data,
            reference: actualRef,
            status: nextStatus,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const isAtPremium = networkKey === "at-premium";
      const msg = String(lastResult?.message ?? "").toLowerCase();
      const looksLikeNetworkError =
        msg.includes("network") ||
        msg.includes("invalid") ||
        msg.includes("not found") ||
        msg.includes("unsupported") ||
        response.status === 404 ||
        response.status === 422 ||
        response.status === 400;
      if (!isAtPremium && !looksLikeNetworkError) break;
    }

    if (networkKey === "at-premium" && sawNetworkValidationError) {
      console.error(`⚠️ AT Premium GHData validation failed for order ${order_id}; keeping order waiting.`);
      await supabase.from("orders").update({ status: "waiting", gh_reference: reference }).eq("id", order_id);
      return new Response(
        JSON.stringify({
          success: false,
          status: "waiting",
          message: "AT Premium order is waiting for manual review.",
          provider_status: lastStatus,
          diagnostics,
        }),
        {
          status: 202,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // All attempts failed → mark failed and refund wallet
    console.error(`❌ All GHData attempts failed for order ${order_id} [${lastStatus}]:`, JSON.stringify(lastResult));
    await supabase.from("orders").update({ status: "failed" }).eq("id", order_id);
    await supabase.rpc("refund_failed_order", { p_order_id: order_id });

    return new Response(
      JSON.stringify({
        success: false,
        message: lastResult?.message || "Order failed on provider",
        provider_status: lastStatus,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("💥 Fulfill order error:", errorMessage);
    return new Response(JSON.stringify({ success: false, message: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
