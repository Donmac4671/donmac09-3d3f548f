import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Parse request body
    const body = await req.json();
    const items = body.items || [];

    console.log("📦 Received items:", JSON.stringify(items, null, 2));

    if (items.length === 0) {
      return new Response(JSON.stringify({ error: "No items" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const item of items) {
      console.log(`🔄 Processing: ${item.network_id} for ${item.phone}`);

      // Call the RPC to create order and deduct wallet
      const { data: orderId, error: rpcError } = await supabase.rpc("pay_with_wallet", {
        p_network: item.network,
        p_phone: item.phone,
        p_bundle: item.bundle,
        p_amount: item.amount,
        p_network_id: item.network_id,
      });

      if (rpcError) {
        console.error("❌ RPC Error:", rpcError);
        return new Response(JSON.stringify({ error: rpcError.message, results }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const orderIdStr = String(orderId);
      console.log(`✅ Order created: ${orderIdStr}`);

      // Handle Airtime and Mashup - set to "processing" (manual delivery)
      if (item.network_id === "airtime" || item.network_id === "mashup" || item.network_id === "vs") {
        const { error: updateError } = await supabase
          .from("orders")
          .update({
            status: "processing",
            gh_reference: `${item.network_id}-manual-${Date.now()}`,
          })
          .eq("id", orderIdStr);

        if (updateError) {
          console.error("❌ Update Error:", updateError);
        } else {
          console.log(`✅ ${item.network_id} order ${orderIdStr} set to processing (manual delivery)`);
        }

        results.push({
          orderId: orderIdStr,
          product: item.network_id,
          status: "processing",
          message: `${item.network_id} order created - manual delivery required`,
        });
      } else {
        // ============================================================
        // 🔥 FIXED: Call fulfill-order for data bundles
        // Make sure to await the response properly
        // ============================================================
        console.log(`📡 Calling fulfill-order for data order ${orderIdStr}`);

        const fulfillResponse = await fetch(`${supabaseUrl}/functions/v1/fulfill-order`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            order_id: orderIdStr,
            network_id: item.network_id,
            phone: item.phone,
            bundle_size_gb: item.bundle_size_gb,
          }),
        });

        const fulfillResult = await fulfillResponse.json();
        console.log(`📡 fulfill-order response:`, fulfillResult);

        if (!fulfillResponse.ok) {
          console.error(`❌ fulfill-order failed: ${fulfillResponse.status}`, fulfillResult);
          // Don't fail the whole order, just log it
        }

        results.push({
          orderId: orderIdStr,
          product: item.network_id,
          status: fulfillResult.status || "processing",
          message: fulfillResult.message || "Order sent to GHData",
          gh_response: fulfillResult,
        });

        console.log(`✅ Data order ${orderIdStr} sent to fulfill-order`);
      }
    }

    console.log(`🎉 All orders processed successfully:`, results);

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("💥 Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
