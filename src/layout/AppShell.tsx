import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import {
  LayoutDashboard, Users, ClipboardCheck, FileText, Boxes, HardHat, ShieldCheck,
  Wrench, Wallet, Landmark, BarChart3, Settings as Cog, LogOut, Menu, X, SunMedium, HeartHandshake, Sun,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession, logout } from "@/hooks/useSession";
import { DEMO_MODE } from "@/services";
import { DemoPill, Modal } from "@/components/ui";
import { AnimatedSolarSky } from "@/components/AnimatedSolarSky";
import VideoBackdrop from "@/components/VideoBackdrop";
import { SunPowerLogo } from "@/components/SunPowerLogo";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/customers", label: "Customers & Leads", icon: Users },
  { to: "/surveys", label: "Site Surveys", icon: ClipboardCheck },
  { to: "/quotations", label: "Quotations", icon: FileText },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/installations", label: "Installations", icon: HardHat },
  { to: "/warranties", label: "Warranties", icon: ShieldCheck },
  { to: "/service", label: "Service Center", icon: Wrench },
  { to: "/technicians", label: "Nearby Service Persons", icon: MapPin },
  { to: "/payments", label: "Payments & Expenses", icon: Wallet },
  { to: "/subsidies", label: "Subsidies", icon: Landmark },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Cog },
];

export default function AppShell() {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [skyModalOpen, setSkyModalOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="relative z-10 flex min-h-screen">
      {/* Ambient background video (only visible where the theme paints nothing) */}
      <VideoBackdrop />
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} />}
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="flex h-14 items-center gap-2.5 border-b border-slate-100 px-4">
          <SunPowerLogo size="sm" variant="light" />
          <div className="leading-tight">
            <p className="text-sm font-bold text-slate-900">SunPower</p>
            <p className="text-[10px] font-medium text-slate-400">Solar Operations AI</p>
          </div>
          <button className="ml-auto text-slate-400 lg:hidden" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2.5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) => cn(
                "mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                isActive ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800",
              )}
            >
              <n.icon className={cn("h-4 w-4", "shrink-0")} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        {DEMO_MODE && (
          <div className="border-t border-slate-100 p-3">
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              <p className="font-semibold">Demo mode</p>
              <p className="mt-0.5 leading-snug">Local simulated data + demo login. Connect Supabase for production auth.</p>
            </div>
          </div>
        )}
        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 shrink-0 rounded-full bg-brand-100 text-center text-[13px] font-bold leading-8 text-brand-800">
              {session?.name.charAt(0) ?? "U"}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[12px] font-semibold text-slate-700">{session?.name}</p>
              <p className="text-[10px] capitalize text-slate-400">{session?.role}</p>
            </div>
            <button
              title="Logout"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
              onClick={() => { logout(); navigate("/login"); }}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-8 no-print">
          <button className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <p className="hidden text-[12px] text-slate-500 sm:block">From First Lead to Lifetime Solar Service</p>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => setSkyModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-1 text-[11.5px] font-semibold text-amber-900 hover:from-amber-100 hover:to-orange-100 transition shadow-xs"
              title="Open Live Rooftop Solar Sky View"
            >
              <Sun className="h-3.5 w-3.5 text-amber-500 animate-spin [animation-duration:12s]" />
              <span className="hidden sm:inline">Rooftop Sky View</span>
            </button>
            {DEMO_MODE ? <DemoPill /> : <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">Live data</span>}
            <NavLink to="/" className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 sm:inline-flex">
              <SunMedium className="h-3.5 w-3.5 text-emerald-600" /> Website Home
            </NavLink>
            <NavLink to="/portal" className="hidden items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-[11.5px] font-semibold text-brand-800 hover:bg-brand-100 sm:inline-flex">
              <HeartHandshake className="h-3.5 w-3.5" /> Customer Portal
            </NavLink>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Full-view Modal for Animated Rooftop Sky */}
      <Modal
        open={skyModalOpen}
        onClose={() => setSkyModalOpen(false)}
        title="Live Rooftop Solar Villa · Sky & Birds Simulation"
        width="max-w-5xl"
      >
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
          <AnimatedSolarSky
            className="h-[68vh] w-full"
            showControls={true}
            autoPlay={true}
          />
        </div>
      </Modal>
    </div>
  );
}
