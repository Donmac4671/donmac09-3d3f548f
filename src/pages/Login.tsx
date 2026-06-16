import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Mail, Lock, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCanonical } from "@/hooks/useCanonical";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function Login() {
  useCanonical("/login");
  const [searchParams] = useSearchParams();

  // Get store info from localStorage (set by Storefront)
  const [storeBrand, setStoreBrand] = useState<{ full_name: string } | null>(null);
  const storeSlug = localStorage.getItem("donmac_store_slug");
  const [loadingBrand, setLoadingBrand] = useState(true);

  useEffect(() => {
    if (storeSlug) {
      supabase
        .from("reseller_stores")
        .select("full_name")
        .eq("slug", storeSlug)
        .single()
        .then(({ data }) => {
          if (data) {
            setStoreBrand(data);
          }
          setLoadingBrand(false);
        });
    } else {
      setLoadingBrand(false);
    }
  }, [storeSlug]);

  const displayName = storeBrand?.full_name || "Donmac Data Hub";
  const initial = displayName.charAt(0).toUpperCase() || "D";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [verificationMode, setVerificationMode] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const { signIn, user, profile, loading: authLoading, referredStoreSlug, isReseller } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Handle redirection based on auth state and referral status
  useEffect(() => {
    if (authLoading || !user || !profile) return;

    const localSlug = typeof window !== "undefined" ? localStorage.getItem("donmac_store_slug") : null;
    const targetSlug = referredStoreSlug || localSlug;

    // Customer arriving from a reseller's storefront → send them to that store
    if (targetSlug && profile.tier !== "reseller" && profile.tier !== "agent" && !isReseller) {
      navigate(`/${targetSlug}`, { replace: true });
      return;
    }
    // Reseller without a store yet → onboarding
    if (profile.tier === "reseller" && !isReseller) {
      navigate("/mystore", { replace: true });
      return;
    }
    navigate("/dashboard", { replace: true });
  }, [user, profile, authLoading, referredStoreSlug, isReseller, navigate, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!rememberMe) {
      sessionStorage.setItem("donmac_no_persist", "1");
    } else {
      sessionStorage.removeItem("donmac_no_persist");
    }

    const { error } = await signIn(email, password);
    if (error) {
      setLoading(false);
      if (error.message.toLowerCase().includes("confirmed")) {
        setVerificationMode(true);
        toast({ title: "Email Not Verified", description: "Please enter the verification code sent to your email." });
      } else {
        toast({
          title: "Login Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    }
    // Success is handled by the useEffect above
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length < 6) {
      toast({ title: "Invalid Code", description: "Please enter the full code.", variant: "destructive" });
      return;
    }
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: otpCode,
      type: "signup",
    });

    setLoading(false);
    if (error) {
      toast({ title: "Verification Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Email Verified!", description: "You can now sign in." });
      setVerificationMode(false);
      setOtpCode("");
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: cleanEmail,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Code Resent", description: "Please check your email for the new code." });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: "Error", description: "Please enter your email", variant: "destructive" });
      return;
    }
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {});

    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setShowCodeInput(true);
      toast({ title: "Code Sent", description: "Check your email for the verification code." });
    }
  };

  const verifyResetCode = async () => {
    if (!resetCode || resetCode.length !== 8) {
      toast({
        title: "Invalid Code",
        description: "Please enter the 8-digit code from your email.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: resetCode,
      type: "recovery",
    });
    setLoading(false);

    if (error) {
      toast({ title: "Invalid Code", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Code Verified", description: "You can now reset your password." });
      navigate("/reset-password");
    }
  };

  if (loadingBrand) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-2xl">D</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground font-bold text-2xl">{initial}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{displayName}</h1>
          <p className="text-muted-foreground mt-1">{forgotMode ? "Reset your password" : "Sign in to your account"}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
          {verificationMode ? (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-semibold mb-2">Verify your email</h2>
                <p className="text-sm text-muted-foreground">
                  Enter the code sent to <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={8}
                    value={otpCode}
                    onChange={(val) => setOtpCode(val)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                      <InputOTPSlot index={6} />
                      <InputOTPSlot index={7} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <Button type="submit" className="w-full gradient-primary border-0" size="lg" disabled={loading || otpCode.length < 6}>
                  {loading ? "Verifying..." : "Verify & Sign In"}
                </Button>
              </form>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="w-full text-sm text-primary font-medium hover:underline"
                >
                  Resend verification code
                </button>
                <button
                  type="button"
                  onClick={() => setVerificationMode(false)}
                  className="w-full text-sm text-muted-foreground flex items-center justify-center gap-1 hover:text-foreground"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to Sign In
                </button>
              </div>
            </div>
          ) : forgotMode ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              {!showCodeInput ? (
                <>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full gradient-primary border-0" size="lg" disabled={loading}>
                    {loading ? "Sending..." : "Send Verification Code"}
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Verification Code</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Enter verification code from email"
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                        className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        maxLength={8}
                        autoFocus
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Enter the code sent to {email}</p>
                  </div>
                  <Button
                    type="button"
                    onClick={verifyResetCode}
                    className="w-full gradient-primary border-0"
                    size="lg"
                    disabled={loading || resetCode.length !== 8}
                  >
                    {loading ? "Verifying..." : "Verify Code & Reset Password"}
                  </Button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setForgotMode(false);
                  setResetSent(false);
                  setShowCodeInput(false);
                  setResetCode("");
                }}
                className="w-full text-center text-sm text-primary hover:underline"
              >
                Back to Sign In
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-foreground">Password</label>
                    <button
                      type="button"
                      onClick={() => setForgotMode(true)}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="rememberMe" checked={rememberMe} onCheckedChange={(c) => setRememberMe(!!c)} />
                  <label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer select-none">
                    Remember me
                  </label>
                </div>
                <Button type="submit" className="w-full gradient-primary border-0" size="lg" disabled={loading}>
                  {loading ? "Signing In..." : "Sign In"}
                </Button>
              </form>

            </>
          )}
        </div>
        <div className="mt-4 rounded-xl border border-border bg-card p-3 text-center">
          <a
            href="https://whatsapp.com/channel/0029VbBdxs77oQhkjJiqqO1y"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity shadow-sm"
            style={{ backgroundColor: "#25D366" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Join Channel
          </a>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">© 2026 Donmac Data Hub. All rights reserved.</p>
      </div>
    </div>
  );
}
