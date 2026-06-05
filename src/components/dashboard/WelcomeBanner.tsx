import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreBranding } from "@/hooks/useStoreBranding";
import { CalendarDays, Clock } from "lucide-react";
import { format } from "date-fns";

export default function WelcomeBanner() {
  const { profile } = useAuth();
  const storeBrand = useStoreBranding();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const firstName = profile?.full_name?.split(" ")[0] || "User";

  const storeName = storeBrand?.full_name || "Donmac Data Hub";

  return (
    <div className="rounded-xl gradient-primary p-4 text-primary-foreground">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">👋</span>
        <span className="font-bold text-sm">
          Welcome to {storeName}, {firstName}!
        </span>
      </div>
      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="w-4 h-4 opacity-80" />
          <span className="text-xs opacity-90">{format(now, "EEEE, MMM dd, yyyy")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 opacity-80" />
          <span className="text-xs opacity-90 tabular-nums">{format(now, "hh:mm:ss a")}</span>
        </div>
      </div>
    </div>
  );
}
