import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

function sendPush(opts: { user_ids?: string[]; admins?: boolean; title: string; message: string; url?: string }): Promise<void> {
  return fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(opts),
  }).then(() => undefined).catch((e) => { console.error("dispatcher → send-push failed", e); });
}

async function isAgent(user_id: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("tier, phone").eq("user_id", user_id).maybeSingle();
  return data?.tier === "agent";
}

async function getUserPhone(user_id: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("phone").eq("user_id", user_id).maybeSingle();
  return (data?.phone ?? "").replace(/\D/g, "");
}

function digits(v: string | null | undefined) {
  return (v ?? "").replace(/\D/g, "");
}

async function buildOrderMessage(o: any, status: "placed" | "pending" | "failed" | "delivered" | "processing") {
  const net = o.network ?? "";
  const pkg = o.bundle_size ?? "";
  const recipient = digits(o.phone_number);
  const ownerPhone = await getUserPhone(o.user_id);
  const includeRecipient = recipient && (await isAgent(o.user_id) ? true : recipient !== ownerPhone);
  const tail = includeRecipient ? ` for ${recipient}` : "";

  switch (status) {
    case "placed":
      return { title: "Order Placed", message: `Your ${net} order of ${pkg}${tail} has been successfully placed and is being processed.` };
    case "processing":
      return { title: "Order Processing", message: `Your ${net} order of ${pkg}${tail} is now being processed.` };
    case "pending":
      return { title: "Order Pending", message: `Your ${net} order of ${pkg}${tail} is pending and will be processed soon.` };
    case "failed":
      return { title: "Order Failed", message: `Your ${net} order of ${pkg}${tail} failed. Please contact support.` };
    case "delivered":
      return { title: "Order Delivered", message: `Your ${net} ${pkg}${tail} has been successfully delivered.` };
  }
}

async function handle(payload: any) {
  const { type, table, record: rawRecord, old_record } = payload as {
    type: "INSERT" | "UPDATE" | "DELETE";
    table: string;
    record: any;
    old_record?: any;
  };

  // Re-fetch the actual row from DB to prevent forged payloads (the public
  // endpoint accepts unauthenticated calls because pg_net trigger uses anon).
  // For INSERT/UPDATE we trust only DB-confirmed values.
  let record = rawRecord;
  const allowedTables = new Set(["orders", "wallet_topups", "complaints", "chat_messages", "referrals", "agent_applications"]);
  if (!allowedTables.has(table)) return;
  if (type !== "DELETE" && rawRecord?.id) {
    const { data: fresh } = await supabase.from(table).select("*").eq("id", rawRecord.id).maybeSingle();
    if (!fresh) {
      console.warn(`dispatcher: record ${table}/${rawRecord.id} not found, ignoring`);
      return;
    }
    record = fresh;
  }
  const tasks: Promise<void>[] = [];

  // ─── ORDERS ───
  if (table === "orders") {
    if (type === "INSERT") {
      const status = record.status === "pending" ? "pending" : "placed";
      const { title, message } = await buildOrderMessage(record, status);
      tasks.push(sendPush({ user_ids: [record.user_id], title, message, url: "/orders" }));
      tasks.push(sendPush({
        admins: true,
        title: "🔔 New Order",
        message: `${record.order_ref}: ${record.network} ${record.bundle_size} → ${record.phone_number} (₵${Number(record.amount ?? 0).toFixed(2)})`,
        url: "/admin#orders",
      }));
    } else if (type === "UPDATE" && record.status !== old_record?.status) {
      let userStatus: "delivered" | "failed" | "pending" | "processing" | null = null;
      if (record.status === "completed") userStatus = "delivered";
      else if (record.status === "failed") userStatus = "failed";
      else if (record.status === "pending") userStatus = "pending";
      else if (record.status === "processing") userStatus = "processing";

      if (userStatus) {
        const { title, message } = await buildOrderMessage(record, userStatus);
        tasks.push(sendPush({ user_ids: [record.user_id], title, message, url: "/orders" }));
      }
      tasks.push(sendPush({
        admins: true,
        title: `📦 Order ${record.status}`,
        message: `${record.order_ref} ${record.network} ${record.bundle_size} → ${record.phone_number}`,
        url: "/admin#orders",
      }));
    }
  }

  // ─── WALLET TOPUPS ───
  if (table === "wallet_topups") {
    if (type === "INSERT") {
      tasks.push(sendPush({
        admins: true,
        title: "💰 New Top-up",
        message: `${(record.method ?? "").toUpperCase()} deposit of ₵${Number(record.amount ?? 0).toFixed(2)} (${record.status})`,
        url: "/admin#verified-id",
      }));
    } else if (type === "UPDATE" && record.status !== old_record?.status) {
      tasks.push(sendPush({
        user_ids: [record.user_id],
        title: "Top-up Update",
        message:
          record.status === "completed"
            ? `Your top-up of ₵${Number(record.amount ?? 0).toFixed(2)} is completed.`
            : `Your top-up status is now ${record.status}.`,
        url: "/topups",
      }));
      tasks.push(sendPush({
        admins: true,
        title: "💰 Top-up Status",
        message: `${(record.method ?? "").toUpperCase()} ₵${Number(record.amount ?? 0).toFixed(2)} → ${record.status}`,
        url: "/admin#verified-id",
      }));
    }
  }

  // ─── COMPLAINTS ───
  if (table === "complaints") {
    if (type === "INSERT") {
      tasks.push(sendPush({
        admins: true,
        title: "📋 New Complaint",
        message: `${record.subject ?? ""}`.slice(0, 100),
        url: "/admin#complaints",
      }));
    } else if (type === "UPDATE" && record.admin_reply && record.admin_reply !== old_record?.admin_reply) {
      tasks.push(sendPush({
        user_ids: [record.user_id],
        title: "📋 Complaint Reply",
        message: `Admin replied: "${String(record.admin_reply).slice(0, 80)}"`,
        url: "/complaints",
      }));
    }
  }

  // ─── CHAT ───
  if (table === "chat_messages" && type === "INSERT") {
    const preview = String(record.message ?? "").slice(0, 80);
    if (record.sender_role === "user") {
      tasks.push(sendPush({ admins: true, title: "💬 New Chat Message", message: `User: "${preview}"`, url: "/admin#live-chat" }));
    } else if (record.sender_role === "admin") {
      tasks.push(sendPush({ user_ids: [record.user_id], title: "💬 New Reply", message: `Support: "${preview}"`, url: "/dashboard" }));
    }
  }

  // ─── REFERRALS ───
  if (table === "referrals" && type === "INSERT") {
    tasks.push(sendPush({
      user_ids: [record.referrer_id],
      title: "🎉 New Referral",
      message: "Someone signed up using your referral code!",
      url: "/referrals",
    }));
    tasks.push(sendPush({
      admins: true,
      title: "🎉 New Referral",
      message: `Code ${record.referral_code} used.`,
      url: "/admin",
    }));
  }

  // ─── AGENT APPLICATIONS ───
  if (table === "agent_applications" && type === "INSERT") {
    tasks.push(sendPush({
      admins: true,
      title: "🧑‍💼 New Agent Application",
      message: `${record.full_name ?? ""} (${record.phone ?? ""})`,
      url: "/admin#agent-apps",
    }));
  }

  await Promise.all(tasks);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const expected = Deno.env.get("TRIGGER_SHARED_SECRET");
    const provided = req.headers.get("x-trigger-secret") || req.headers.get("X-Trigger-Secret");
    if (!expected || provided !== expected) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const payload = await req.json();
    // Fire-and-forget so pg_net doesn't time out at 5s while we fan out pushes.
    // @ts-ignore - EdgeRuntime is provided by Supabase Edge runtime
    EdgeRuntime.waitUntil(handle(payload).catch((e) => console.error("dispatcher handle error:", e)));
    return new Response(JSON.stringify({ success: true, queued: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("dispatcher error:", e);
    return new Response(JSON.stringify({ success: false, error: e?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

