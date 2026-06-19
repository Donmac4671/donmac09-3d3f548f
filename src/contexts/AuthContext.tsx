import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

const STOREFRONT_KEY = "donmac_store_slug";

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
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: any; data?: any }>;
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

  const getStoreSlugFromUrl = () => {
    if (typeof window === "undefined") return null;
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    if (pathSegments.length >= 2) {
      const slug = pathSegments[0];
      const lastSegment = pathSegments[pathSegments.length - 1];
      if (['login', 'register'].includes(lastSegment)) {
        return slug;
      }
    }
    return null;
  };

  const resolveStoreSlug = async (slug: string) => {
    const { data } = await (supabase as any)
      .from("public_reseller_stores")
      .select("id, slug")
      .eq("slug", slug.trim().toLowerCase())
      .eq("is_active", true)
      .maybeSingle();
    return data as { id: string; slug: string } | null;
  };

  const attributeStoreReferral = async () => {
    if (typeof window === "undefined") return;
    try {
      const slug = getStoreSlugFromUrl() || window.localStorage.getItem(STOREFRONT_KEY);
      if (!slug) return;
      await supabase.rpc("register_store_referral", { p_slug: slug });
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

      if (!profileData) {
        try {
          await supabase.rpc("provision_my_profile");
          const retry = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", authUser.id)
            .maybeSingle();
          profileData = retry.data;
        } catch (err) {
          console.error("provision_my_profile failed:", err);
        }
      }

      const [rolesRes, storeRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", authUser.id),
        supabase.from("reseller_stores").select("id").eq("user_id", authUser.id).maybeSingle()
      ]);

      if (rolesRes.error) console.error("Role fetch error:", rolesRes.error.message);
      
      // FIXED: Get referral separately with a cleaner query
      let referralData: { store_id: string } | null = null;
      let referralError = null;
      try {
        const result = await supabase
          .from("store_referrals")
          .select("store_id")
          .eq("user_id", authUser.id)
          .maybeSingle();
        referralData = result.data;
        referralError = result.error;
      } catch (err) {
        console.error("Referral fetch error:", err);
      }

      const pendingStoreSlug = typeof window !== "undefined"
        ? getStoreSlugFromUrl() || window.localStorage.getItem(STOREFRONT_KEY)
        : null;
      if (!referralData && pendingStoreSlug && !rolesRes.data?.some((r) => r.role === "admin") && !storeRes.data) {
        const resolvedStore = await resolveStoreSlug(pendingStoreSlug);
        if (resolvedStore) {
          referralData = { store_id: resolvedStore.id };
        }
      }

      // FIXED: If referral exists, get the store slug separately
      let referredSlug = null;
      if (referralData && !referralError) {
        try {
          const { data: storeData } = await supabase
            .from("reseller_stores")
            .select("slug")
            .eq("id", referralData.store_id)
            .maybeSingle();
          if (storeData) {
            referredSlug = storeData.slug;
          }
        } catch (err) {
          console.error("Store slug fetch error:", err);
        }
      }

      if (!referredSlug && pendingStoreSlug && referralData) {
        referredSlug = pendingStoreSlug.trim().toLowerCase();
      }

      setIsAdmin(rolesRes.data?.some((r) => r.role === "admin") ?? false);
      setIsReseller(Boolean(storeRes.data));
      setIsReferredCustomer(Boolean(referralData));
      setReferredStoreId(referralData?.store_id ?? null);
      setReferredStoreSlug(referredSlug);
      setProfile((profileData as Profile) ?? null);

      // AFTER profile is set, check if we need to redirect to a store
      try {
        let redirectSlug = sessionStorage.getItem("redirect_to_store");
        if (!redirectSlug) {
          redirectSlug = getStoreSlugFromUrl();
        }
        if (!redirectSlug) {
          redirectSlug = localStorage.getItem(STOREFRONT_KEY);
        }
        
        if (redirectSlug && !isAdmin && !storeRes.data) {
          localStorage.setItem(STOREFRONT_KEY, redirectSlug);
        }
      } catch { /* ignore */ }

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
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    
    if (!error && data.user) {
      try {
        let storeSlug = getStoreSlugFromUrl();
        if (!storeSlug) {
          storeSlug = localStorage.getItem(STOREFRONT_KEY);
        }
        if (storeSlug) {
          sessionStorage.setItem("redirect_to_store", storeSlug);
          localStorage.setItem(STOREFRONT_KEY, storeSlug);
        }
      } catch { /* ignore */ }
    }
    
    return { error, data };
  };

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    const cleanEmail = email.trim().toLowerCase();
    
    let storeSlug = typeof window !== "undefined" ? getStoreSlugFromUrl() : null;
    if (!storeSlug && typeof window !== "undefined") {
      storeSlug = localStorage.getItem(STOREFRONT_KEY);
    }
    
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { 
          full_name: fullName, 
          phone,
          referred_by_store: storeSlug || null
        },
      },
    });
    
    if (!error && data.user && storeSlug) {
      try {
        sessionStorage.setItem("redirect_to_store", storeSlug);
        localStorage.setItem(STOREFRONT_KEY, storeSlug);
      } catch { /* ignore */ }
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
      try {
        sessionStorage.removeItem("redirect_to_store");
      } catch { /* ignore */ }
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
