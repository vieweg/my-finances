import { useState, Suspense } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowDownUp,
  Wallet,
  Tag,
  LogOut,
  UserCircle,
  Menu,
  X,
  Users,
  FileText,
  Repeat2,
} from "lucide-react";
import { useSession } from "@/features/auth";
import { CurrencySelector } from "./CurrencySelector";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/transactions", label: "Transactions", icon: ArrowDownUp },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/contracts", label: "Contracts", icon: Repeat2 },
  { to: "/wallets", label: "Wallets", icon: Wallet },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/tags", label: "Tags", icon: Tag },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
    isActive
      ? "bg-blue-50 text-blue-700"
      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
  );

export function AppLayout() {
  const { logout } = useSession();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 flex flex-col w-60 shrink-0 bg-white border-r border-gray-200 z-30 transition-transform duration-200 md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <NavLink key="/" to="/" end={true} reloadDocument>
            <span className="text-lg font-semibold text-gray-900">
              Finances 3.0
            </span>
          </NavLink>
          <button
            onClick={closeSidebar}
            className="p-1 text-gray-500 hover:text-gray-700 md:hidden"
          >
            <X size={18} />
          </button>
        </div>
        <CurrencySelector />

        <nav className="flex flex-col gap-1 flex-1 p-3">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={closeSidebar}
              className={navLinkClass}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200 space-y-1">
          <NavLink
            to="/profile"
            onClick={closeSidebar}
            className={navLinkClass}
          >
            <UserCircle size={18} />
            Profile
          </NavLink>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Mobile header */}
        <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 md:hidden shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1 text-gray-600 hover:text-gray-900"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <span className="text-sm font-semibold text-gray-900">
            Controle Caixa
          </span>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          }>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
