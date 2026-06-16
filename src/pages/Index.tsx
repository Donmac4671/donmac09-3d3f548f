import DashboardLayout from "@/components/layout/DashboardLayout";
import StatsCards from "@/components/dashboard/StatsCards";
import WalletTopUp from "@/components/dashboard/WalletTopUp";
import ClaimPayment from "@/components/dashboard/ClaimPayment";
import DataBundles from "@/components/dashboard/DataBundles";

import PromoCountdown from "@/components/dashboard/PromoCountdown";
import WelcomeBanner from "@/components/dashboard/WelcomeBanner";
import SiteMessageBanner from "@/components/global/SiteMessageBanner";

import { useCanonical } from "@/hooks/useCanonical";

export default function Index() {
  useCanonical("/dashboard");
  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        <WelcomeBanner />
        <SiteMessageBanner />
        <PromoCountdown />
        <StatsCards />
        <WalletTopUp />
        <ClaimPayment />
        <DataBundles />
        <MashupAirtime />
        
      </div>
    </DashboardLayout>
  );
}
