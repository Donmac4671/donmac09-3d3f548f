import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const readableError = (error: unknown, fallback = "Failed to create user") => {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  const record = error as Record<string, unknown>;
  const msg = typeof record.message === "string" && record.message.trim() ? record.message : "";
  const name = typeof record.name === "string" ? record.name : "";
  if (name === "AuthRetryableFetchError") {
    return "The auth service could not create this account right now. If the email already exists, use the existing account or reset its password, then create the reseller store.";
  }
  if (msg) return name && name !== "Error" ? `${name}: ${msg}` : msg;
  for (const key of ["msg", "error_description", "error", "code", "statusText"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  if (name) return name;
  return fallback;
};

const isAuthRetryableError = (error: unknown) => {
  const record = error as Record<string, unknown> | null;
  return record?.name === "AuthRetryableFetchError";
};

const isWeakPasswordError = (error: unknown) => {
  const record = error as Record<string, unknown> | null;
  return record?.name === "AuthWeakPasswordError" || record?.code === "weak_password";
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createUserWithRetry = async (
  admin: ReturnType<typeof createClient>,
  payload: { email: string; password: string; email_confirm: boolean; user_metadata: Record<string, string> },
) => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await admin.auth.admin.createUser(payload);
    if (!error) return { data, error: null as unknown };
    lastError = error;
    const name = (error as { name?: string })?.name ?? "";
    if (name !== "AuthRetryableFetchError") break;
    await sleep(500 * (attempt + 1));
  }
  return { data: null, error: lastError };
};

const updateAuthUser = async (
  admin: ReturnType<typeof createClient>,
  userId: string,
  password: string,
  metadata: Record<string, string>,
) => {
  const { data, error } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (!error) return { data, error: null as unknown, passwordUpdated: true };

  if (!isWeakPasswordError(error)) return { data: null, error, passwordUpdated: false };

  console.warn("Password rejected for existing user; keeping current password:", readableError(error));
  const retry = await admin.auth.admin.updateUserById(userId, {
    email_confirm: true,
    user_metadata: metadata,
  });

  return { data: retry.data, error: retry.error, passwordUpdated: false };
};

const findAuthUserByEmail = async (admin: ReturnType<typeof createClient>, email: string) => {
  const target = email.trim().toLowerCase();

  // Direct DB lookup via SECURITY DEFINER RPC - reliable regardless of listUsers pagination/state.
  try {
    const { data: rpcId, error: rpcErr } = await admin.rpc("get_auth_user_id_by_email", { p_email: target });
    if (!rpcErr && rpcId) {
      const { data: got, error: getErr } = await admin.auth.admin.getUserById(rpcId as string);
      if (!getErr && got?.user) return got.user;
    } else if (rpcErr) {
      console.warn("get_auth_user_id_by_email rpc error:", readableError(rpcErr));
    }
  } catch (err) {
    console.warn("get_auth_user_id_by_email lookup failed:", readableError(err));
  }

  // Fallback: paginate listUsers.
  const perPage = 200;
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

const signUpUserFallback = async (
  supabaseUrl: string,
  anonKey: string,
  email: string,
  password: string,
  metadata: Record<string, string>,
) => {
  const signupClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await signupClient.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });

  if (error) return { userId: null, error };

  const user = data.user;
  if (!user?.id || (Array.isArray(user.identities) && user.identities.length === 0)) {
    return {
      userId: null,
      error: new Error("This email may already be registered. Try a different email or reset that user's password."),
    };
  }

  return { userId: user.id, error: null };
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
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: caller }, error: userError } = await admin.auth.getUser(token);
    const callerId = caller?.id;
    if (userError || !callerId) {
      console.warn("Admin create user unauthorized:", readableError(userError, "Missing or expired session"));
      return new Response(
        JSON.stringify({ error: "Admin session expired. Please sign out, sign back in, and try again." }),
        { status: 401, headers: jsonHeaders },
      );
    }

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
    let passwordUpdated = true;

    if (existingUser) {
      const { data: updated, error: updateErr, passwordUpdated: didUpdatePassword } = await updateAuthUser(
        admin,
        existingUser.id,
        password,
        metadata,
      );

      if (updateErr) {
        console.error("Admin UpdateUser error:", readableError(updateErr), updateErr);
        return new Response(JSON.stringify({ error: readableError(updateErr, "Failed to update existing user") }), { status: 400, headers: jsonHeaders });
      }

      passwordUpdated = didUpdatePassword;
      userId = updated.user?.id ?? existingUser.id;
    } else {
      const { data: created, error: createErr } = await createUserWithRetry(admin, {
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      });

      if (createErr) {
        console.error("Admin CreateUser error:", readableError(createErr), createErr);
        const foundAfterFailure = await findAuthUserByEmail(admin, email);

        if (!foundAfterFailure) {
          console.warn("Admin create failed; trying signup fallback for:", email);
          const fallback = await signUpUserFallback(supabaseUrl, anonKey, email, password, metadata);

          if (!fallback.userId) {
            const createMessage = readableError(createErr);
            const fallbackMessage = readableError(fallback.error, "Signup fallback failed");
            const status = isAuthRetryableError(createErr) ? 503 : 400;
            return new Response(
              JSON.stringify({ error: `${createMessage}. ${fallbackMessage}` }),
              { status, headers: jsonHeaders },
            );
          }

          const { error: confirmErr } = await admin.auth.admin.updateUserById(fallback.userId, {
            email_confirm: true,
            user_metadata: metadata,
          });

          if (confirmErr) {
            console.error("Admin confirm fallback user error:", readableError(confirmErr), confirmErr);
            return new Response(JSON.stringify({ error: readableError(confirmErr, "User was created but could not be confirmed") }), { status: 400, headers: jsonHeaders });
          }

          userId = fallback.userId;
        } else {
          const { data: updated, error: updateErr, passwordUpdated: didUpdatePassword } = await updateAuthUser(
            admin,
            foundAfterFailure.id,
            password,
            metadata,
          );

          if (updateErr) {
            console.error("Admin UpdateUser after create failure error:", readableError(updateErr), updateErr);
            return new Response(JSON.stringify({ error: readableError(updateErr, "Failed to update existing user") }), { status: 400, headers: jsonHeaders });
          }

          passwordUpdated = didUpdatePassword;
          userId = updated.user?.id ?? foundAfterFailure.id;
        }
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

    return new Response(
      JSON.stringify({ success: true, user_id: userId, profile_verified: true, password_updated: passwordUpdated }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: jsonHeaders });
  }
});
