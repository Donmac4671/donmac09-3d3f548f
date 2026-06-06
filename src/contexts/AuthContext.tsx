import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  agent_code: string;
  wallet_balance: number;
  is_blocked: boolean;
  tier: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  isReseller: boolean;
  isReferredCustomer: boolean;
  referredStoreId: string | null;
  referredStoreSlug: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any; data?: any }>;
  signUp: (email: string, password: string, fullName: string, phone: string, resellerCode?: string) => Promise<{ error: any; data?: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isReseller, setIsReseller] = useState(false);
  const [isReferredCustomer, setIsReferredCustomer] = useState(false);
  const [referredStoreId, setReferredStoreId] = useState<string | null>(null);
  const [referredStoreSlug, setReferredStoreSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clearStoredSession = () => {
    if (typeof window === "undefined") return;

    const clearFromStorage = (storage: Storage) => {
      Object.keys(storage)
        .filter(
          (key) =>
            key === "supabase.auth.token" ||
            (key.startsWith("sb-") && key.includes("auth-token"))
        )
        .forEach((key) => storage.removeItem(key));
    };

    clearFromStorage(window.localStorage);
    clearFromStorage(window.sessionStorage);
  };

  const isAnonymousSession = (authUser: User) => {
    const provider = (authUser.app_metadata as { provider?: string } | undefined)?.provider;
    return provider === "anonymous" || (authUser as User & { is_anonymous?: boolean }).is_anonymous === true;
  };

  const attributeStoreReferral = async () => {
    if (typeof window === "undefined") return;
    try {
      const slug = window.localStorage.getItem("donmac_store_slug");
      if (!slug) return;
      await supabase.rpc("register_store_referral", { p_slug: slug });
      window.localStorage.removeItem("donmac_store_slug");
    } catch (err) {
      console.warn("Store referral attribution skipped:", err);
    }
  };

  const fetchProfile = async (authUser: User) => {
    try {
      let { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (profileError) {
        console.error("Profile fetch error:", profileError.message);
      }

      setProfile((profileData as Profile) ?? null);

      const [rolesRes, storeRes, referralRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", authUser.id),
        supabase.from("reseller_stores").select("id").eq("user_id", authUser.id).maybeSingle(),
        supabase.from("store_referrals").select("id, store_id, reseller_stores(slug)").eq("user_id", authUser.id).maybeSingle()
      ]);

      if (rolesRes.error) console.error("Role fetch error:", rolesRes.error.message);
      setIsAdmin(rolesRes.data?.some((r) => r.role === "admin") ?? false);
      setIsReseller(Boolean(storeRes.data));
      setIsReferredCustomer(Boolean(referralRes.data));
      setReferredStoreId((referralRes.data as any)?.store_id ?? null);
      setReferredStoreSlug((referralRes.data as any)?.reseller_stores?.slug ?? null);
    } catch (error) {
      console.error("Auth profile load failed:", error);
      setProfile(null);
      setIsAdmin(false);
      setIsReseller(false);
      setIsReferredCustomer(false);
      setReferredStoreId(null);
      setReferredStoreSlug(null);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user);
  };

  useEffect(() => {
    let isMounted = true;

    const setSafeState = (updater: () => void) => {
      if (isMounted) updater();
    };

    const hydrate = async (sessionUser: User | null) => {
      if (!isMounted) return;

      if (sessionUser && isAnonymousSession(sessionUser)) {
        await supabase.auth.signOut({ scope: "global" }).catch(() => undefined);
        clearStoredSession();
        setSafeState(() => {
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          setIsReseller(false);
          setIsReferredCustomer(false);
          setReferredStoreId(null);
          setReferredStoreSlug(null);
          setLoading(false);
        });
        return;
      }

      setSafeState(() => {
        setUser(sessionUser);
        setLoading(false);
      });

      if (sessionUser) {
        await attributeStoreReferral();
        void fetchProfile(sessionUser);
      } else {
        setSafeState(() => {
          setProfile(null);
          setIsAdmin(false);
          setIsReseller(false);
          setIsReferredCustomer(false);
          setReferredStoreId(null);
          setReferredStoreSlug(null);
        });
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void hydrate(session?.user ?? null);
    });

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          await hydrate(null);
          return;
        }

        const validationResult = await Promise.race([
          supabase.auth.getUser(),
          new Promise<{ data: { user: null }; error: Error }>((resolve) => {
            setTimeout(() => {
              resolve({ data: { user: null }, error: new Error("User validation timed out") });
            }, 3000);
          }),
        ]);

        const validatedUser = validationResult.data?.user;

        if (validationResult.error && !validatedUser) {
          await supabase.auth.signOut({ scope: "global" }).catch(() => undefined);
          clearStoredSession();
          await hydrate(null);
          return;
        }

        await hydrate(validatedUser ?? session.user);
      } catch (error) {
        console.error("Session initialization failed:", error);
        setSafeState(() => setLoading(false));
      }
    };

    void initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { error, data };
  };

  const signUp = async (email: string, password: string, fullName: string, phone: string, resellerCode?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { 
          full_name: fullName, 
          phone,
          user_type: 'customer',
          reseller_code: resellerCode || null
        },
      },
    });
    
    // If user was created successfully, manually create profile and role
    if (data?.user && !error) {
      // Create profile
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: data.user.id,
          user_id: data.user.id,
          full_name: fullName,
          email: email,
          phone: phone,
          wallet_balance: 0,
          is_blocked: false,
          tier: 'customer',
          agent_code: null,
          referral_code: null,
          topup_reference_code: null
        });
      
      if (profileError) {
        console.error("Profile creation error:", profileError);
      }
      
      // Create user role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: data.user.id,
          role: 'user'
        });
      
      if (roleError) {
        console.error("Role creation error:", roleError);
      }
      
      // If there's a reseller code, link the customer
      if (resellerCode && !profileError) {
        // Find reseller by agent_code
        const { data: resellerData } = await supabase
          .from("profiles")
          .select("id")
          .eq("agent_code", resellerCode)
          .eq("tier", "reseller")
          .single();
        
        if (resellerData) {
          await supabase
            .from("customer_reseller_links")
            .insert({
              customer_id: data.user.id,
              reseller_id: resellerData.id
            });
        }
      }
    }
    
    return { error, data };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (error) {
      console.error("Sign out failed:", error);
    } finally {
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      setIsReseller(false);
      setIsReferredCustomer(false);
      setReferredStoreId(null);
      setReferredStoreSlug(null);
      clearStoredSession();
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, isReseller, isReferredCustomer, referredStoreId, referredStoreSlug, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
