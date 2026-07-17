import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreBranding } from "@/hooks/useStoreBranding";
import { CalendarDays, Clock } from "lucide-react";
import { format } from "date-fns";

function getGreeting(date: Date) {
  const h = date.getHours();
  if (h < 12) return { text: "Good morning", emoji: "🌅" };
  if (h < 17) return { text: "Good afternoon", emoji: "☀️" };
  if (h < 21) return { text: "Good evening", emoji: "🌆" };
  return { text: "Good night", emoji: "🌙" };
}

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
  const greeting = getGreeting(now);

  return (
    <div className="rounded-xl gradient-primary p-4 text-primary-foreground">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{greeting.emoji}</span>
        <span className="font-bold text-sm">
          {greeting.text}, {firstName}! Welcome to {storeName}
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
