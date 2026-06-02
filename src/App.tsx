import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import FloatingCartButton from "@/components/global/FloatingCartButton";
import LiveChatWidget from "@/components/global/LiveChatWidget";
import RealtimeNotifications from "@/components/global/RealtimeNotifications";
import EnableNotificationsBanner from "@/components/global/EnableNotificationsBanner";
import SiteMessagePopup from "@/components/global/SiteMessagePopup";
import SiteMessageBanner from "@/components/global/SiteMessageBanner";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Orders from "./pages/Orders";
import Transactions from "./pages/Transactions";
import TopUps from "./pages/TopUps";
import Cart from "./pages/Cart";
import TopUpWallet from "./pages/TopUpWallet";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Complaints from "./pages/Complaints";
import ResetPassword from "./pages/ResetPassword";
import Flyer from "./pages/Flyer";
import MyStore from "./pages/MyStore";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function RecoveryRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(location.search);
    const isRecoveryLink =
      hashParams.get("type") === "recovery" ||
      searchParams.get("type") === "recovery" ||
      Boolean(searchParams.get("code"));

    if (isRecoveryLink && location.pathname !== "/reset-password") {
      navigate(
        {
          pathname: "/reset-password",
          search: location.search,
          hash: location.hash,
        },
        { replace: true },
      );
    }
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CartProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <RecoveryRedirect />
            <RealtimeNotifications />
            <EnableNotificationsBanner />
            <SiteMessagePopup />

            <FloatingCartButton />
            <LiveChatWidget />
            <Routes>
              <Route
                path="/"
                element={
                  <PublicRoute>
                    <Landing />
                  </PublicRoute>
                }
              />
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicRoute>
                    <Register />
                  </PublicRoute>
                }
              />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders"
                element={
                  <ProtectedRoute>
                    <Orders />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/transactions"
                element={
                  <ProtectedRoute>
                    <Transactions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/topups"
                element={
                  <ProtectedRoute>
                    <TopUps />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/cart"
                element={
                  <ProtectedRoute>
                    <Cart />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/top-up-wallet"
                element={
                  <ProtectedRoute>
                    <TopUpWallet />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/complaints"
                element={
                  <ProtectedRoute>
                    <Complaints />
                  </ProtectedRoute>
                }
              />
              <Route path="/flyer" element={<Flyer />} />
              <Route
                path="/mystore"
                element={
                  <ProtectedRoute>
                    <MyStore />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
