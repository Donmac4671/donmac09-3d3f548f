import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShoppingCart, User, Wallet, Menu, LayoutDashboard, ShoppingBag, Receipt, CreditCard, LogOut, Shield, MessageSquare, Crown, Share2, Store } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Orders", icon: ShoppingBag, path: "/orders" },
  { label: "Transactions", icon: Receipt, path: "/transactions" },
  { label: "Top Ups", icon: CreditCard, path: "/topups" },
  { label: "My Store", icon: Store, path: "/mystore" },
  { label: "Complaints", icon: MessageSquare, path: "/complaints" },
  { label: "Profile", icon: User, path: "/profile" },
];

export default function TopBar({ title }: { title: string }) {
  const { itemCount } = useCart();
  const { profile, isAdmin, isReseller, isReferredCustomer, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <header className="flex items-center justify-between px-4 lg:px-6 py-3 bg-card border-b border-border">
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger className="lg:hidden">
            <Menu className="w-5 h-5 text-muted-foreground" />
          </SheetTrigger>
          <SheetContent side="left" className="w-[260px] p-4">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">D</span>
              </div>
              <span className="font-bold text-foreground">Donmac Data Hub</span>
            </div>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                if (item.path === "/mystore" && profile?.tier === "customer" && !isAdmin) return null;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive ? "gradient-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link to="/admin" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === "/admin" ? "gradient-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                }`}>
                  <Shield className="w-4 h-4" /> Admin
                </Link>
              )}
            </nav>
            <button onClick={handleSignOut} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent mt-4">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <LayoutDashboard className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-bold text-foreground">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link to="/cart" className="relative p-2 rounded-lg hover:bg-accent transition-colors">
          <ShoppingCart className="w-5 h-5 text-muted-foreground" />
          {itemCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 gradient-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
              {itemCount}
            </span>
          )}
        </Link>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-accent rounded-lg">
          <Wallet className="w-4 h-4 text-primary" />
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Balance</p>
            <p className="text-sm font-bold text-foreground">{formatCurrency(profile?.wallet_balance ?? 0)}</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="p-2 rounded-lg hover:bg-accent transition-colors">
            <User className="w-5 h-5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="flex items-center gap-3 p-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </span>
              </div>
              <div>
                <p className="font-semibold text-sm">{profile?.full_name || "User"}</p>
                <p className="text-xs text-muted-foreground">{profile?.agent_code}</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile" className="flex items-center gap-2"><User className="w-4 h-4" /> Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/orders" className="flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> Orders</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onSelect={() => {
                void handleSignOut();
              }}
            >
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
