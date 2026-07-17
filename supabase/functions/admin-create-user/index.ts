import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const readableError = (error: unknown, fallback = "Failed to create user") => {
  if (!error) return fallback;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  const record = error as Record<string, unknown>;
  for (const key of ["message", "msg", "error_description", "error", "code", "statusText"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  const details = Object.fromEntries(
    Object.getOwnPropertyNames(error as object).map((key) => [key, record[key]]),
  );
  const serialized = JSON.stringify(details);
  return serialized && serialized !== "{}" ? serialized : fallback;
};

const findAuthUserByEmail = async (admin: ReturnType<typeof createClient>, email: string) => {
  const target = email.trim().toLowerCase();
  const perPage = 100;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("List users error:", readableError(error));
      return null;
    }

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === target);
    if (user) return user;
    if (data.users.length < perPage) return null;
  }

  return null;
};

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
    const metadata = { full_name, phone, user_type, tier: user_type };
    const existingUser = await findAuthUserByEmail(admin, email);
    let userId = existingUser?.id;

    if (existingUser) {
      const { data: updated, error: updateErr } = await admin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: metadata,
      });

      if (updateErr) {
        console.error("Admin UpdateUser error:", readableError(updateErr), updateErr);
        return new Response(JSON.stringify({ error: readableError(updateErr, "Failed to update existing user") }), { status: 400, headers: jsonHeaders });
      }

      userId = updated.user?.id ?? existingUser.id;
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      });

      if (createErr) {
        console.error("Admin CreateUser error:", readableError(createErr), createErr);
        const foundAfterFailure = await findAuthUserByEmail(admin, email);

        if (!foundAfterFailure) {
          return new Response(JSON.stringify({ error: readableError(createErr) }), { status: 400, headers: jsonHeaders });
        }

        const { data: updated, error: updateErr } = await admin.auth.admin.updateUserById(foundAfterFailure.id, {
          password,
          email_confirm: true,
          user_metadata: metadata,
        });

        if (updateErr) {
          console.error("Admin UpdateUser after create failure error:", readableError(updateErr), updateErr);
          return new Response(JSON.stringify({ error: readableError(updateErr, "Failed to update existing user") }), { status: 400, headers: jsonHeaders });
        }

        userId = updated.user?.id ?? foundAfterFailure.id;
      } else {
        userId = created.user?.id;
      }
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Could not resolve created user" }), { status: 400, headers: jsonHeaders });
    }

    const { error: profileErr } = await admin.from("profiles").upsert(
      {
        id: userId,
        user_id: userId,
        full_name,
        email,
        phone,
        tier: user_type,
        wallet_balance: 0,
        is_blocked: false,
      },
      { onConflict: "user_id" },
    );
    if (profileErr) {
      console.error("Profile upsert error:", profileErr.message);
      return new Response(JSON.stringify({ error: profileErr.message }), { status: 400, headers: jsonHeaders });
    }

    const { error: roleErr } = await admin.from("user_roles").upsert(
      { user_id: userId, role: "user" },
      { onConflict: "user_id,role" },
    );
    if (roleErr) console.warn("Role upsert skipped:", roleErr.message);

    return new Response(JSON.stringify({ success: true, user_id: userId, profile_verified: true }), { status: 200, headers: jsonHeaders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: jsonHeaders });
  }
});
