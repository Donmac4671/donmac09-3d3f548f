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

  // Helper function to get store slug from URL only when it's a store-specific path
  const getStoreSlugFromUrl = () => {
    if (typeof window === "undefined") return null;
    try {
      const pathname = window.location.pathname;
      // Remove leading and trailing slashes and split
      const segments = pathname.replace(/^\/|\/$/g, '').split('/');
      
      // Check if the path matches /:slug/login or /:slug/register
      // The pattern should be: [slug, 'login'] or [slug, 'register']
      if (segments.length === 2) {
        const possibleSlug = segments[0];
        const possibleAction = segments[1];
        // Only return the slug if the second segment is 'login' or 'register'
        if ((possibleAction === 'login' || possibleAction === 'register') && possibleSlug) {
          // Make sure the slug isn't actually a reserved path
          const reservedPaths = ['login', 'register', 'dashboard', 'admin', 'reset-password', 'flyer', 'api-docs', 'mystore'];
          if (!reservedPaths.includes(possibleSlug)) {
            return possibleSlug;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  const attributeStoreReferral = async () => {
    if (typeof window === "undefined") return;
    try {
      const slugFromUrl = getStoreSlugFromUrl();
      const slug = slugFromUrl || window.localStorage.getItem(STOREFRONT_KEY);
      if (!slug) return;
      await supabase.rpc("register_store_referral", { p_slug: slug });
      window.localStorage.removeItem(STOREFRONT_KEY);
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

      // Self-heal: if the auth.users trigger didn't create a profile row,
      // ask the server to provision it now so the dashboard / profile page
      // don't get stuck on an infinite loader.
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

      const [rolesRes, storeRes, referralRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", authUser.id),
        supabase.from("reseller_stores").select("id").eq("user_id", authUser.id).maybeSingle(),
        supabase.from("store_referrals").select("id, store_id, reseller_stores(slug)").eq("user_id", authUser.id).maybeSingle()
      ]);

      if (rolesRes.error) console.error("Role fetch error:", rolesRes.error.message);
      // Set referral / role state BEFORE profile so route guards and
      // CustomerLockout see the reseller link in the same render that
      // gets the profile (avoids a flash-of-no-referral that signs the
      // customer out or pushes them to the main dashboard).
      setIsAdmin(rolesRes.data?.some((r) => r.role === "admin") ?? false);
      setIsReseller(Boolean(storeRes.data));
      setIsReferredCustomer(Boolean(referralRes.data));
      setReferredStoreId((referralRes.data as any)?.store_id ?? null);
      setReferredStoreSlug((referralRes.data as any)?.reseller_stores?.slug ?? null);
      setProfile((profileData as Profile) ?? null);

      // AFTER profile is set, check if we need to redirect to a store
      // Check for redirect from sessionStorage (set during signin/signup)
      try {
        const redirectSlug = sessionStorage.getItem("redirect_to_store");
        if (redirectSlug && !isAdmin && !storeRes.data) {
          // Don't redirect admins/resellers
          // Store the slug in localStorage to maintain the referral
          localStorage.setItem(STOREFRONT_KEY, redirectSlug);
          // We'll let the ProtectedRoute handle the actual navigation
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
    
    // After successful sign in, check if there's a stored store slug
    if (!error && data.user) {
      try {
        const slugFromUrl = getStoreSlugFromUrl();
        const storeSlug = slugFromUrl || localStorage.getItem(STOREFRONT_KEY);
        if (storeSlug) {
          // Store it in sessionStorage so we can redirect after profile loads
          sessionStorage.setItem("redirect_to_store", storeSlug);
          localStorage.setItem(STOREFRONT_KEY, storeSlug);
        }
      } catch { /* ignore */ }
    }
    
    return { error, data };
  };

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    const cleanEmail = email.trim().toLowerCase();
    
    const slugFromUrl = getStoreSlugFromUrl();
    const storeSlug = slugFromUrl || (typeof window !== "undefined" ? localStorage.getItem(STOREFRONT_KEY) : null);
    
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
    
    // If signup successful and we have a store slug, store it for redirect
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
      // Clear any pending redirects
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
