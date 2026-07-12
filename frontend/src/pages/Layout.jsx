import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import {
  FlaskConical, LayoutDashboard, Package, ArrowDownToLine, ArrowUpFromLine,
  Boxes, CalendarClock, Sigma, AlertTriangle, PackageX, ShoppingCart,
  LogOut, Beaker, TestTube, Microscope, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const groups = [
  {
    label: "Dashboard",
    items: [{ to: "/", icon: LayoutDashboard, label: "Overview" }],
  },
  {
    label: "Inventory Master",
    items: [
      { to: "/items/MDS", icon: FlaskConical, label: "Items — MDS" },
      { to: "/items/VPD", icon: Beaker, label: "Items — VPD" },
      { to: "/items/Media", icon: TestTube, label: "Items — Media" },
    ],
  },
  {
    label: "Transactions",
    items: [
      { to: "/stock-entry", icon: ArrowDownToLine, label: "Stock Entry" },
      { to: "/issue", icon: ArrowUpFromLine, label: "Issue" },
    ],
  },
  {
    label: "Reports",
    items: [
      { to: "/current-stock", icon: Boxes, label: "Current Stock" },
      { to: "/monthly-utilisation", icon: CalendarClock, label: "Monthly Utilisation" },
      { to: "/indent-next-year", icon: Sigma, label: "Indent Next Year" },
    ],
  },
  {
    label: "Alerts & Orders",
    items: [
      { to: "/supply-order", icon: ShoppingCart, label: "Supply Order" },
      { to: "/short-expiry", icon: AlertTriangle, label: "Short Expiry" },
      { to: "/low-stock", icon: Package, label: "Low Stock" },
      { to: "/nil-stock", icon: PackageX, label: "NIL Stock" },
    ],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const handleLogout = async () => {
    await logout();
    nav("/login");
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-200 flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-indigo-950 text-white grid place-items-center">
            <Microscope size={16} />
          </div>
          <div>
            <div className="font-heading font-bold text-sm text-slate-900">Stock Register</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">MDS · VPD · Media</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {groups.map((g) => (
            <div key={g.label} className="mb-3">
              <div className="px-5 mb-1 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                {g.label}
              </div>
              {g.items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  data-testid={`nav-${it.to.replace(/[^a-z0-9]/gi, "-")}`}
                  end={it.to === "/"}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-5 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-indigo-50 text-indigo-950 border-l-2 border-indigo-950 font-medium"
                        : "text-slate-600 hover:bg-slate-50 border-l-2 border-transparent"
                    }`
                  }
                >
                  <it.icon size={15} />
                  <span>{it.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-950 grid place-items-center text-xs font-bold">
              {user?.name?.[0] || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">{user?.name}</div>
              <div className="text-xs text-slate-500 truncate capitalize">{user?.role}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              data-testid="logout-btn"
              onClick={handleLogout}
              aria-label="Logout"
            >
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-x-auto">
        <Outlet />
      </main>
    </div>
  );
}
