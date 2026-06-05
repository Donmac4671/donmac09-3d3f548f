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
    
    if (userError || !callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", callerId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: jsonHeaders });
    }

    const body = await req.json().catch(() => ({}));
    console.log("Request body:", JSON.stringify(body));

    const full_name = String(body.full_name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const password = String(body.password ?? "");
    const user_type = String(body.user_type ?? "reseller");
    const agent_code = String(body.agent_code ?? "");

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

    // Create the user in auth
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone, user_type, agent_code },
    });

    if (createErr) {
      console.error("Supabase Admin CreateUser error:", createErr.message);
      return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: jsonHeaders });
    }

    const newUserId = created.user?.id;
    
    if (!newUserId) {
      return new Response(JSON.stringify({ error: "Failed to create user" }), { status: 500, headers: jsonHeaders });
    }

    console.log("User created with ID:", newUserId);

    // Wait for user to be available in auth.users
    let retries = 0;
    let userConfirmed = false;
    
    while (retries < 5 && !userConfirmed) {
      await new Promise(resolve => setTimeout(resolve, 500 * (retries + 1)));
      
      const { data: userCheck, error: checkError } = await admin
        .from('auth.users')
        .select('id')
        .eq('id', newUserId)
        .single();
      
      if (!checkError && userCheck) {
        userConfirmed = true;
        console.log("User confirmed in auth.users");
      }
      retries++;
    }

    // CREATE THE PROFILE RECORD - WITH ALL REQUIRED FIELDS
    const { error: profileError } = await admin
      .from("profiles")
      .insert({
        id: newUserId,
        user_id: newUserId,  // CRITICAL: This was missing!
        full_name: full_name,
        email: email,
        phone: phone,
        agent_code: agent_code || null,
        wallet_balance: 0,
        is_blocked: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tier: user_type,
        referral_code: null,
        topup_reference_code: null
      });

    if (profileError) {
      console.error("Profile creation error:", profileError.message);
      return new Response(JSON.stringify({ error: `Profile creation failed: ${profileError.message}` }), { status: 500, headers: jsonHeaders });
    }

    console.log("Profile created successfully");

    // ASSIGN ROLE IN user_roles TABLE
    const { error: roleError } = await admin
      .from("user_roles")
      .insert({
        user_id: newUserId,
        role: user_type,
        created_at: new Date().toISOString()
      });

    if (roleError) {
      console.error("Role assignment error:", roleError.message);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      user_id: newUserId,
      user_type: user_type,
      message: "User created successfully"
    }), { status: 200, headers: jsonHeaders });
    
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Edge function error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: jsonHeaders });
  }
});
