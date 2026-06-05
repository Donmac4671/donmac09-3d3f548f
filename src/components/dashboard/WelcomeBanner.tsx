import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarDays, Clock } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export default function WelcomeBanner() {
  const { profile, user } = useAuth();
  const [now, setNow] = useState(new Date());
  const [storeName, setStoreName] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Check if user is a customer (has a reseller link)
    const fetchStoreName = async () => {
      if (!user) return;
      
      // Check if user is linked to a reseller
      const { data: linkData } = await supabase
        .from("customer_reseller_links")
        .select("reseller_id")
        .eq("customer_id", user.id)
        .maybeSingle();
      
      if (linkData) {
        // Get reseller's store name
        const { data: storeData } = await supabase
          .from("reseller_stores")
          .select("full_name")
          .eq("user_id", linkData.reseller_id)
          .single();
        
        if (storeData) {
          setStoreName(storeData.full_name);
        }
      }
    };
    
    fetchStoreName();
  }, [user]);

  const firstName = profile?.full_name?.split(" ")[0] || "User";
  const displayName = storeName || "DonMacDataHub";

  return (
    <div className="rounded-xl gradient-primary p-4 text-primary-foreground">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">👋</span>
        <span className="font-bold text-sm">
          Welcome to {displayName}, {firstName}!
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
