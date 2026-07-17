import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

function normalizeSmsText(smsBody: string): string {
  let text = smsBody.replace(/\u00a0/g, " ").trim();

  const separatorMatch = text.match(/\*{4,}/);
  if (separatorMatch) {
    text = text.substring(separatorMatch.index! + separatorMatch[0].length).trim();
  }

  text = text.replace(/\n+\s*Reply:\s*https?:\/\/\S+\s*$/i, "").trim();

  return text;
}

function detectNetwork(smsBody: string): string {
  const text = smsBody
    .replace(
      /Reference:.*?(?=(?:Financial Transaction Id|Transaction Id|External Transaction Id|Trans(?:action)? ID|Txn ID|$))/is,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  if (
    /\bto\s+mtn(?:\s+(?:airtime|momo|mobile money))?\b/i.test(text)
    || /\bmtn\s+(?:airtime|momo|mobile money)\b/i.test(text)
    || /^mtn\b/i.test(text)
  ) {
    return "MTN";
  }

  if (
    /\bto\s+(?:telecel|vodafone)(?:\s+(?:cash|airtime|momo|mobile money))?\b/i.test(text)
    || /\b(?:telecel|vodafone)\s+(?:cash|airtime|momo|mobile money)\b/i.test(text)
    || /^(?:telecel|vodafone)\b/i.test(text)
  ) {
    return "Telecel";
  }

  if (
    /\bto\s+(?:airteltigo|airtel|tigo)(?:\s+(?:cash|airtime|money))?\b/i.test(text)
    || /\b(?:airteltigo|airtel|tigo)\s+(?:cash|airtime|money)\b/i.test(text)
    || /^(?:airteltigo|airtel|tigo)\b/i.test(text)
  ) {
    return "AirtelTigo";
  }

  return "MTN";
}

// Parse MoMo SMS to extract transaction details
function parseMomoSms(smsBody: string): { transactionId: string; amount: number; network: string } | null {
  const text = normalizeSmsText(smsBody);

  const txnMatch = text.match(/(?:Financial Transaction Id|Transaction Id|External Transaction Id|Trans(?:action)? ID|Txn ID)[:\s#-]*(\d{11})/i)
    || text.match(/\b(\d{11})\b/);
  if (!txnMatch) return null;
  const transactionId = txnMatch[1];

  const amountMatch = text.match(/(?:GH[SC]|GH¢|¢)\s*([\d,]+\.?\d*)/i)
    || text.match(/([\d,]+\.?\d*)\s*(?:GH[SC]|GH¢|¢|cedis?)/i)
    || text.match(/(?:amount|received|sent|payment(?: received)?(?: for)?|cash in received|of)\s*(?:GH[SC]|GH¢|¢)?\s*([\d,]+\.?\d*)/i);

  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  if (isNaN(amount) || amount <= 0) return null;

  const network = detectNetwork(text);

  return { transactionId, amount, network };
}

// Parse order command like "0241234567 MTN 1GB" or "0549358359 at premium 5gb"
const NETWORK_ALIASES: Record<string, string> = {
  mtn: "mtn",
  telecel: "telecel",
  vodafone: "telecel",
  "at bigtime": "at-bigtime",
  "at big time": "at-bigtime",
  "at-bigtime": "at-bigtime",
  "airteltigo bigtime": "at-bigtime",
  "airteltigo big time": "at-bigtime",
  "at premium": "at-premium",
  "at-premium": "at-premium",
  "airteltigo premium": "at-premium",
  "airteltigo": "at-bigtime",
};

const GH_API_BASE = "https://ghdataconnect.com/api";

const FULFILL_ENDPOINT = "/v1/purchaseBundle";
const FULFILL_NETWORK_KEYS: Record<string, string[]> = {
  mtn: ["mtn"],
  telecel: ["telecel"],
  "at-bigtime": ["atbigtime", "at_bigtime", "at-bigtime"],
  "at-premium": ["AT_PREMIUM", "AT-PREMIUM", "AIRTELTIGO_PREMIUM", "AIRTELTIGOPREMIUM", "AT_PREMIUM_BUNDLE", "AIRTELTIGO_PREMIUM_BUNDLE", "premium", "PREMIUM", "atpremium", "at_premium", "at-premium", "airteltigo_premium", "airteltigopremium"],
};

function isNetworkValidationError(result: any, status: number): boolean {
  const message = String(result?.message ?? "").toLowerCase();
  const networkErrors = Array.isArray(result?.errors?.network)
    ? result.errors.network.join(" ").toLowerCase()
    : String(result?.errors?.network ?? "").toLowerCase();
  return status === 422 && (
    message.includes("validation") ||
    networkErrors.includes("network") ||
    networkErrors.includes("invalid") ||
    networkErrors.includes("selected")
  );
}

// Fallback prices when custom_bundles table is empty
const FALLBACK_AGENT_PRICES: Record<string, Record<number, number>> = {
  mtn: { 1: 4.60, 2: 9.30, 3: 13.90, 4: 18.50, 5: 23.20, 6: 27.80, 8: 37, 10: 43.50, 15: 64, 20: 84, 25: 105, 30: 126, 40: 164, 50: 205 },
  telecel: { 2: 10.20, 3: 15.40, 5: 23, 10: 42, 15: 62, 20: 82, 25: 100, 30: 123, 40: 163, 50: 202 },
  "at-bigtime": { 15: 58, 20: 65, 30: 75, 40: 86, 50: 95, 60: 106, 70: 138, 80: 152, 90: 163, 100: 177, 130: 222, 140: 248, 150: 275, 200: 370 },
  "at-premium": { 1: 4.40, 2: 8.90, 3: 13.40, 4: 17.80, 5: 22.20, 6: 26.80, 7: 31.30, 8: 35.70, 10: 41.20, 12: 50, 15: 63, 20: 82, 25: 105, 30: 125 },
};

const FALLBACK_GENERAL_PRICES: Record<string, Record<number, number>> = {
  mtn: { 1: 5, 2: 10, 3: 15, 4: 20, 5: 25, 6: 30, 8: 40, 10: 46, 15: 67, 20: 88, 25: 109, 30: 130, 40: 170, 50: 210 },
  telecel: { 2: 11, 3: 16.50, 5: 24.50, 10: 44, 15: 65, 20: 85, 25: 105, 30: 127, 40: 167, 50: 207 },
  "at-bigtime": { 15: 60, 20: 68, 30: 80, 40: 92, 50: 104, 60: 116, 70: 143, 80: 158, 90: 170, 100: 184, 130: 230, 140: 256, 150: 285, 200: 380 },
  "at-premium": { 1: 4.80, 2: 9.60, 3: 14.40, 4: 19.20, 5: 24, 6: 28.80, 7: 33.60, 8: 38.40, 10: 43.20, 12: 55, 15: 67, 20: 85.40, 25: 109.40, 30: 129.60 },
};

function parseOrderCommand(text: string): { phone: string; networkId: string; networkDisplay: string; sizeGB: number; sizeLabel: string } | null {
  // Match: phone network size (e.g., "0241234567 MTN 1GB" or "0549358359 at premium 5gb")
  const match = text.trim().match(/^(0\d{9})\s+(.+?)\s+(\d+(?:\.\d+)?)\s*gb$/i);
  if (!match) return null;

  const phone = match[1];
  const rawNetwork = match[2].trim().toLowerCase();
  const sizeGB = parseFloat(match[3]);

  const networkId = NETWORK_ALIASES[rawNetwork];
  if (!networkId) return null;

  const displayNames: Record<string, string> = {
    mtn: "MTN", telecel: "TELECEL", "at-bigtime": "AT BIG TIME", "at-premium": "AT PREMIUM",
  };

  return { phone, networkId, networkDisplay: displayNames[networkId] || networkId, sizeGB, sizeLabel: `${sizeGB}GB` };
}

async function getNextOrderRef(supabase: any): Promise<string> {
  const { data, error } = await supabase.rpc("next_order_ref");
  if (error || !data) {
    throw new Error(error?.message || "Unable to generate the next order reference");
  }
  return String(data);
}

Deno.serve(async (req) => {
  // Restrict to scheduler/service-role callers via shared secret or service-role JWT.
  const triggerSecret = Deno.env.get("TRIGGER_SHARED_SECRET");
  const providedSecret = req.headers.get("x-trigger-secret");
  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const hasServiceRole = serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`;
  const hasSecret = triggerSecret && providedSecret === triggerSecret;
  if (!hasSecret && !hasServiceRole) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log("telegram-momo invoked");
  const startTime = Date.now();

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }), { status: 500 });
  }

  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
  if (!TELEGRAM_API_KEY) {
    return new Response(JSON.stringify({ error: "TELEGRAM_API_KEY is not configured" }), { status: 500 });
  }

  // Ensure no webhook is set (webhooks prevent getUpdates from working)
  const delWebhook = await fetch(`${GATEWAY_URL}/deleteWebhook`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ drop_pending_updates: false }),
  });
  const webhookResult = await delWebhook.json();
  console.log("deleteWebhook result:", JSON.stringify(webhookResult));

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let totalProcessed = 0;
  let totalTopups = 0;

  // Read initial offset
  const { data: state, error: stateErr } = await supabase
    .from("telegram_bot_state")
    .select("update_offset")
    .eq("id", 1)
    .single();

  if (stateErr) {
    return new Response(JSON.stringify({ error: stateErr.message }), { status: 500 });
  }

  let currentOffset = state.update_offset;

  // Poll continuously until time runs out
  while (true) {
    const elapsed = Date.now() - startTime;
    const remainingMs = MAX_RUNTIME_MS - elapsed;
    if (remainingMs < MIN_REMAINING_MS) break;

    const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
    if (timeout < 1) break;

    console.log(`Polling getUpdates: offset=${currentOffset}, timeout=${timeout}`);
    const response = await fetch(`${GATEWAY_URL}/getUpdates`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        offset: currentOffset,
        timeout,
        allowed_updates: ["message"],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("getUpdates failed:", response.status, JSON.stringify(data));
      return new Response(JSON.stringify({ error: data }), { status: 502 });
    }

    const updates = data.result ?? [];
    console.log(`getUpdates returned ${updates.length} updates`);
    if (updates.length === 0) continue;

    for (const update of updates) {
      const msg = update.message;
      const text = msg?.text ?? msg?.caption ?? "";

      if (!text) {
        console.log("Skipping update (no text):", update.update_id, JSON.stringify(msg?.forward_origin ?? msg?.forward_from ?? "no-forward-info"));
        continue;
      }

      const chatId = msg.chat.id;

      console.log(`Processing msg from chat ${chatId}, length=${text.length}, hasText=${!!msg.text}, hasCaption=${!!msg.caption}, isForward=${!!msg.forward_origin || !!msg.forward_from}`);

      // Try to parse as MoMo SMS
      const parsed = parseMomoSms(text);

      if (parsed) {
        // Check for duplicate
        const { data: existing } = await supabase
          .from("verified_topups")
          .select("id")
          .eq("transaction_id", parsed.transactionId)
          .maybeSingle();

        if (existing) {
          // Send duplicate reply
          await sendTelegramMessage(
            LOVABLE_API_KEY, TELEGRAM_API_KEY, chatId,
            `⚠️ Duplicate: Transaction ${parsed.transactionId} already exists.`
          );
        } else {
          // Insert into verified_topups
          const { error: insertErr } = await supabase.from("verified_topups").insert({
            transaction_id: parsed.transactionId,
            amount: parsed.amount,
            network: parsed.network,
          });

          if (insertErr) {
            await sendTelegramMessage(
              LOVABLE_API_KEY, TELEGRAM_API_KEY, chatId,
              `❌ Error saving: ${insertErr.message}`
            );
          } else {
            totalTopups++;
            await sendTelegramMessage(
              LOVABLE_API_KEY, TELEGRAM_API_KEY, chatId,
              `✅ Verified Top-up Added!\n\n💰 Amount: GHS ${parsed.amount}\n📱 Network: ${parsed.network}\n🔢 Transaction ID: ${parsed.transactionId}`
            );
          }
        }
      } else {
        // Try to parse as an order command
        const orderCmd = parseOrderCommand(text);
        if (orderCmd) {
          await handleOrderCommand(supabase, LOVABLE_API_KEY, TELEGRAM_API_KEY, chatId, orderCmd);
        } else {
          // Not a MoMo SMS or order - send help message
          await sendTelegramMessage(
            LOVABLE_API_KEY, TELEGRAM_API_KEY, chatId,
            `📲 Forward your MoMo payment SMS here to auto-capture transactions.\n\n📦 To place an order, send:\n<code>0241234567 MTN 1GB</code>\n\nSupported networks: MTN, Telecel, AT BigTime, AT Premium`
          );
        }
      }

      totalProcessed++;
    }

    // Log messages
    const rows = updates
      .filter((u: any) => u.message)
      .map((u: any) => ({
        update_id: u.update_id,
        chat_id: u.message.chat.id,
        text: u.message.text ?? u.message.caption ?? null,
        raw_update: u,
        processed: true,
      }));

    if (rows.length > 0) {
      await supabase.from("telegram_messages").upsert(rows, { onConflict: "update_id" });
    }

    // Advance offset
    const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
    await supabase
      .from("telegram_bot_state")
      .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
      .eq("id", 1);

    currentOffset = newOffset;
  }

  return new Response(JSON.stringify({ ok: true, processed: totalProcessed, topups: totalTopups, finalOffset: currentOffset }));
});

async function sendTelegramMessage(lovableKey: string, telegramKey: string, chatId: number, text: string) {
  try {
    const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": telegramKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    await res.text(); // consume body
  } catch (e) {
    console.error("Failed to send Telegram message:", e);
  }
}

async function handleOrderCommand(
  supabase: any,
  lovableKey: string,
  telegramKey: string,
  chatId: number,
  order: { phone: string; networkId: string; networkDisplay: string; sizeGB: number; sizeLabel: string }
) {
  const GH_API_KEY = Deno.env.get("GHDATACONNECT_API_KEY");
  if (!GH_API_KEY) {
    await sendTelegramMessage(lovableKey, telegramKey, chatId, `❌ GHDataConnect API key not configured.`);
    return;
  }

  // Use the primary admin wallet so bot orders always appear on the same website account
  const { data: primaryAdminProfile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("email", "donmacdatahub@gmail.com")
    .maybeSingle();

  let adminUserId = primaryAdminProfile?.user_id;

  if (!adminUserId) {
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .single();

    adminUserId = adminRole?.user_id;
  }

  if (!adminUserId) {
    await sendTelegramMessage(lovableKey, telegramKey, chatId, `❌ No admin account found.`);
    return;
  }

  // Get admin profile to check tier for correct pricing
  const { data: adminProfile } = await supabase.from("profiles").select("wallet_balance, tier").eq("user_id", adminUserId).single();
  if (!adminProfile) {
    await sendTelegramMessage(lovableKey, telegramKey, chatId, `❌ Admin profile not found.`);
    return;
  }

  const priceField = adminProfile.tier === "agent" ? "agent_price" : "general_price";

  // Look up bundle price from custom_bundles using admin's tier
  const { data: customBundle } = await supabase
    .from("custom_bundles")
    .select(priceField)
    .eq("network_id", order.networkId)
    .eq("size_gb", order.sizeGB)
    .maybeSingle();

  let amount: number;
  if (customBundle) {
    amount = customBundle[priceField];
  } else {
    // Fallback to hardcoded prices based on admin's tier
    const fallbackMap = adminProfile.tier === "agent" ? FALLBACK_AGENT_PRICES : FALLBACK_GENERAL_PRICES;
    const fallback = fallbackMap[order.networkId]?.[order.sizeGB];
    if (fallback === undefined) {
      await sendTelegramMessage(lovableKey, telegramKey, chatId, `❌ No bundle found for ${order.networkDisplay} ${order.sizeLabel}.`);
      return;
    }
    amount = fallback;
  }

  let orderRef: string;
  try {
    orderRef = await getNextOrderRef(supabase);
  } catch (error) {
    await sendTelegramMessage(
      lovableKey,
      telegramKey,
      chatId,
      `❌ Failed to generate order reference: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    return;
  }
  const ghReference = `DMH${Date.now()}${Math.floor(Math.random() * 1000)}`;

  // Debit admin wallet BEFORE placing the order
  if (amount > 0) {
    if (adminProfile.wallet_balance < amount) {
      await sendTelegramMessage(lovableKey, telegramKey, chatId, `❌ Insufficient admin wallet balance. Balance: GHS ${adminProfile.wallet_balance}, Required: GHS ${amount}`);
      return;
    }
    const { error: debitErr } = await supabase.from("profiles").update({ wallet_balance: adminProfile.wallet_balance - amount }).eq("user_id", adminUserId);
    if (debitErr) {
      await sendTelegramMessage(lovableKey, telegramKey, chatId, `❌ Failed to debit wallet: ${debitErr.message}`);
      return;
    }
    // Record the transaction
    await supabase.from("transactions").insert({
      user_id: adminUserId,
      type: "purchase",
      description: `${order.networkDisplay} ${order.sizeLabel} to ${order.phone} (Telegram)`,
      amount: -amount,
      status: "completed",
    });
  }

  const { data: newOrder, error: orderErr } = await supabase.from("orders").insert({
    user_id: adminUserId,
    order_ref: orderRef,
    network: order.networkDisplay,
    phone_number: order.phone,
    bundle_size: order.sizeLabel,
    amount,
    status: "processing",
    payment_method: "wallet",
    gh_reference: ghReference,
  }).select("id").single();

  if (orderErr) {
    // Refund wallet if order creation fails
    if (amount > 0) {
      const { data: profile } = await supabase.from("profiles").select("wallet_balance").eq("user_id", adminUserId).single();
      if (profile) {
        await supabase.from("profiles").update({ wallet_balance: profile.wallet_balance + amount }).eq("user_id", adminUserId);
      }
    }
    await sendTelegramMessage(lovableKey, telegramKey, chatId, `❌ Failed to create order: ${orderErr.message}`);
    return;
  }

  // Call GHDataConnect with retries across alternate network keys
  const candidateKeys = FULFILL_NETWORK_KEYS[order.networkId];
  if (!candidateKeys) {
    await sendTelegramMessage(lovableKey, telegramKey, chatId, `❌ Unknown network config for ${order.networkId}`);
    return;
  }

  const capacity = order.sizeGB;
  console.log(`Telegram order: ${order.networkDisplay} ${order.sizeLabel} to ${order.phone}`);

  let lastResult: any = null;
  let lastStatus = 0;
  let success = false;
  let actualGhRef: string = ghReference;
  let sawNetworkValidationError = false;
  const diagnostics: Array<{ key: string; status: number; message: string; errors?: any }> = [];

  for (const key of candidateKeys) {
    try {
      const requestBody = { network: key, reference: ghReference, msisdn: order.phone, capacity };
      const response = await fetch(`${GH_API_BASE}${FULFILL_ENDPOINT}`, {
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
      console.log(`GH Telegram response (key=${key}, status=${response.status}):`, JSON.stringify(lastResult));
      diagnostics.push({ key, status: response.status, message: String(lastResult?.message ?? ""), errors: lastResult?.errors });
      if (isNetworkValidationError(lastResult, response.status)) sawNetworkValidationError = true;

      if (lastResult?.success) {
        actualGhRef = lastResult.data?.reference ?? lastResult.data?.id ?? lastResult.reference ?? ghReference;
        await supabase.from("orders").update({ gh_reference: String(actualGhRef), status: order.networkId === "at-premium" ? "completed" : "processing" }).eq("id", newOrder.id);
        success = true;
        break;
      }

      const msg = String(lastResult?.message ?? "").toLowerCase();
      const looksLikeNetworkError = msg.includes("network") || msg.includes("invalid") || response.status === 404 || response.status === 422;
      if (!looksLikeNetworkError) break;
    } catch (err) {
      console.error(`GH Telegram fetch error (key=${key}):`, err);
    }
  }

  if (success) {
    await sendTelegramMessage(lovableKey, telegramKey, chatId,
      `✅ Order Placed!\n\n📱 ${order.networkDisplay} ${order.sizeLabel}\n📞 ${order.phone}\n💰 GHS ${amount}\n🔖 Ref: ${orderRef}\n📋 GH Ref: ${actualGhRef}`
    );
  } else if (order.networkId === "at-premium" && sawNetworkValidationError) {
    console.error(`AT Premium Telegram GHData network validation failed; keeping order waiting:`, JSON.stringify({ order_id: newOrder.id, lastStatus, lastResult, diagnostics }));
    await supabase.from("orders").update({ status: "waiting" }).eq("id", newOrder.id);
    await sendTelegramMessage(lovableKey, telegramKey, chatId,
      `⚠️ Order Waiting For Manual Review\n\n📱 ${order.networkDisplay} ${order.sizeLabel}\n📞 ${order.phone}\n💰 GHS ${amount}\n🔖 Ref: ${orderRef}\nGHData rejected the AT Premium network key, so this was not failed/refunded.`
    );
  } else {
    await supabase.from("orders").update({ status: "failed" }).eq("id", newOrder.id);
    // Refund admin wallet on failure
    await supabase.rpc("refund_failed_order", { p_order_id: newOrder.id });
    await sendTelegramMessage(lovableKey, telegramKey, chatId,
      `❌ Order Failed (refunded)!\n\n📱 ${order.networkDisplay} ${order.sizeLabel}\n📞 ${order.phone}\n⚠️ ${lastResult?.message || "Provider error"} [${lastStatus}]`
    );
  }
}
