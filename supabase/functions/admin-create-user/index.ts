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
    const user_type = String(body.user_type ?? "reseller"); // 'reseller' or 'customer'
    const reseller_code = String(body.reseller_code ?? ""); // For customer signup via reseller link

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
      user_metadata: { full_name, phone, user_type },
    });

    if (createErr) {
      console.error("Supabase Admin CreateUser error:", createErr.message);
      return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: jsonHeaders });
    }

    const newUserId = created.user?.id;
    
    if (!newUserId) {
      return new Response(JSON.stringify({ error: "Failed to create user" }), { status: 500, headers: jsonHeaders });
    }

    // CREATE THE PROFILE RECORD
    const { error: profileError } = await admin
      .from("profiles")
      .insert({
        id: newUserId,
        full_name: full_name,
        email: email,
        phone: phone,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      console.error("Profile creation error:", profileError.message);
      // Don't return error - user is created, but log it
    }

    // ASSIGN ROLE IN user_roles TABLE
    const { error: roleError } = await admin
      .from("user_roles")
      .insert({
        user_id: newUserId,
        role: user_type, // 'reseller' or 'customer'
        created_at: new Date().toISOString()
      });

    if (roleError) {
      console.error("Role assignment error:", roleError.message);
    }

    // IF CUSTOMER WITH RESELLER CODE, LINK THEM
    if (user_type === "customer" && reseller_code) {
      // Find reseller by their code
      const { data: resellerData, error: resellerError } = await admin
        .from("profiles")
        .select("id")
        .eq("reseller_code", reseller_code)
        .single();
      
      if (!resellerError && resellerData) {
        // Link customer to reseller
        const { error: linkError } = await admin
          .from("customer_reseller_links")
          .insert({
            customer_id: newUserId,
            reseller_id: resellerData.id,
            created_at: new Date().toISOString()
          });
        
        if (linkError) {
          console.error("Reseller link error:", linkError.message);
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      user_id: newUserId,
      user_type: user_type
    }), { status: 200, headers: jsonHeaders });
    
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Edge function error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: jsonHeaders });
  }
});
