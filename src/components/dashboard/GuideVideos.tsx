import VideoGuide from "./VideoGuide";
import buyStep1 from "@/assets/guides/buy-1-choose-network.jpg";
import buyStep2 from "@/assets/guides/buy-2-select-package.jpg";
import buyStep3 from "@/assets/guides/buy-3-enter-number.jpg";
import buyStep4 from "@/assets/guides/buy-4-open-cart.jpg";
import buyStep5 from "@/assets/guides/buy-5-proceed-pay.jpg";
import momoStep1 from "@/assets/guides/momo-1-open-wallet.jpg";
import momoStep2 from "@/assets/guides/momo-2-send-money.jpg";
import momoStep3 from "@/assets/guides/momo-3-claim.jpg";
import complaintStep1 from "@/assets/guides/complaint-1-new.jpg";
import complaintStep2 from "@/assets/guides/complaint-2-submit.jpg";
export default function GuideVideos() {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">📖 Quick Guides</h3>

      <VideoGuide
        title="How to Buy Data"
        emoji="🛒"
        accentColor="#3b82f6"
        steps={[
          { image: buyStep1, caption: "Choose the network you want to buy from." },
          { image: buyStep2, caption: "Select the package you want to buy." },
          { image: buyStep3, caption: "Enter the number to receive the data, then tap Add to Cart." },
          { image: buyStep4, caption: "Click the cart icon at the top to open your cart." },
          { image: buyStep5, caption: "Tap Proceed to Pay to complete placing your order — make sure your wallet has enough balance." },
        ]}
      />

      <VideoGuide
        title="How to Deposit (Mobile Money)"
        emoji="💰"
        accentColor="#22c55e"
        steps={[
          { image: momoStep1, caption: "On the Dashboard, tap the Wallet button to open Wallet Top-up." },
          { image: momoStep2, caption: "Copy the MoMo number, send the money, then tap I've Sent the Money." },
          { image: momoStep3, caption: "Enter the 11-digit Transaction ID from your SMS and tap Claim Payment — your wallet is credited immediately." },
        ]}
      />


      <VideoGuide
        title="How to File a Complaint"
        emoji="⚠️"
        accentColor="#f59e0b"
        steps={[
          { image: complaintStep1, caption: "Open Complaints and tap New Complaint." },
          { image: complaintStep2, caption: "Fill in the required details and tap Submit Complaint." },
        ]}
      />

    </div>
  );
}
