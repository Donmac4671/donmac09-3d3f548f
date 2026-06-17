import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: userError } = await userClient.auth.getUser();
    const callerId = caller?.id;
    if (userError || !callerId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", callerId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: jsonHeaders });

    const body = await req.json().catch(() => ({}));
    console.log("Request body:", JSON.stringify(body));

    const full_name = String(body.full_name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const password = String(body.password ?? "");

    if (!full_name || !email || !phone || !password) {
      console.error("Missing fields:", { full_name, email, phone, password_provided: !!password });
      return new Response(JSON.stringify({ error: "All fields are required" }), { status: 400, headers: jsonHeaders });
    }
    if (!/^\d{10}$/.test(phone)) {
      return new Response(JSON.stringify({ error: "Phone must be 10 digits" }), { status: 400, headers: jsonHeaders });
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), { status: 400, headers: jsonHeaders });
    }

    const user_type = String(body.user_type ?? "reseller");
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone, user_type, tier: user_type },
    });

    if (createErr) {
      console.error("Supabase Admin CreateUser error:", createErr.message);
      return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: jsonHeaders });
    }

    const userId = created.user?.id;

    // Small poll to ensure trigger has finished creating the profile
    // before we return success to the admin UI.
    let profileCreated = false;
    for (let i = 0; i < 5; i++) {
      const { data: p } = await admin.from("profiles").select("id").eq("user_id", userId).maybeSingle();
      if (p) {
        profileCreated = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!profileCreated) {
      console.warn(`Profile for ${userId} not created within 2.5s`);
    }

    return new Response(JSON.stringify({ success: true, user_id: userId, profile_verified: profileCreated }), { status: 200, headers: jsonHeaders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: jsonHeaders });
  }
});
