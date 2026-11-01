import { useState } from "react";
import { useNavigate } from "react-router";
import { SunMedium, Eye, EyeOff, LogIn, UserPlus, ShieldCheck, UserCheck, Sparkles, Database } from "lucide-react";
import { Button, Input, Label, Select, DemoPill } from "@/components/ui";
import {
  DEMO_USERS,
  login as persistSession,
  authenticate,
  registerAccount,
  getRegisteredUsers,
} from "@/services/auth";
import { setSession } from "@/hooks/useSession";
import { useToast } from "@/components/toast";
import { DEMO_MODE } from "@/services";
import { SunPowerLogo } from "@/components/SunPowerLogo";
import { AnimatedSolarSky } from "@/components/AnimatedSolarSky";
import { isSupabaseConfigured } from "@/services/supabase";
import type { Role } from "@/types";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("customer");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Hyderabad");

  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  const navigate = useNavigate();

  // Retrieve any previously registered local users
  const [registeredUsers, setRegisteredUsers] = useState(() => getRegisteredUsers());

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!/.+@.+\..+/.test(email)) return setError("Please enter a valid email address.");
    if (password.length < 4) return setError("Password must be at least 4 characters.");

    setBusy(true);

    try {
      const session = await authenticate(email, password);
      setSession(session);
      toast.success(
        `Welcome back, ${session.name}!`,
        isSupabaseConfigured ? "Authenticated via Supabase PostgreSQL" : "Signed in with local database",
      );
      navigate(session.role === "customer" ? "/portal" : "/dashboard");
    } catch (err: any) {
      setError(err.message || "Sign in failed. Please check your credentials.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) return setError("Please enter your full name.");
    if (!/.+@.+\..+/.test(email)) return setError("Please enter a valid email address.");
    if (password.length < 6) return setError("Password must be at least 6 characters long.");

    setBusy(true);

    try {
      const session = await registerAccount({
        name: fullName.trim(),
        email: email.trim(),
        password,
        role,
        phone: phone.trim() || undefined,
        city: city.trim() || undefined,
      });

      setRegisteredUsers(getRegisteredUsers());
      setSession(session);
      toast.success(
        `Account created successfully! Welcome, ${session.name}.`,
        role === "customer" ? "Rooftop solar profile created in database." : `Staff role: ${role}`,
      );
      navigate(session.role === "customer" ? "/portal" : "/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to create account. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatedSolarSky className="min-h-screen" showControls={false} showHud={false} autoPlay>
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-white/40 bg-white/94 shadow-2xl backdrop-blur-xl m-4 md:m-6 md:grid md:grid-cols-2">
        {/* Brand side */}
        <div className="hidden flex-col justify-between bg-emerald-950/80 bg-gradient-to-br from-emerald-950/80 via-emerald-900/70 to-brand-900/80 p-8 text-white backdrop-blur-md md:flex border-r border-white/10">
          <div>
            <div className="flex items-center gap-3">
              <SunPowerLogo size="lg" variant="glass" />
              <div>
                <p className="text-lg font-bold tracking-tight text-white">SunPower</p>
                <p className="text-xs text-brand-200">Solar Operations Platform</p>
              </div>
            </div>
            <p className="mt-8 text-2xl font-bold leading-snug text-white">
              From First Lead to Lifetime Solar Service.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-emerald-100/90">
              Manage enquiries, site surveys, quotations, inventory, serial-numbered equipment,
              installations, warranties, service, payments and analytics — in one connected platform.
            </p>

            <div className="mt-8 space-y-2 rounded-xl border border-white/10 bg-white/5 p-3.5 text-xs text-emerald-100">
              <div className="flex items-center gap-2 font-semibold text-amber-300">
                <Database className="h-4 w-4" />
                <span>{isSupabaseConfigured ? "Connected to Supabase PostgreSQL" : "Integrated with Local Database"}</span>
              </div>
              <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                {isSupabaseConfigured
                  ? "Real-time cloud database active with Row-Level Security policies."
                  : "Zero-credential local database active. Accounts and customer profiles persist in your browser."}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-emerald-200/70 border-t border-white/10 pt-4">
            <span>© 2026 SunPower Solutions</span>
            <span>Live Solar Rooftop View</span>
          </div>
        </div>

        {/* Form side */}
        <div className="p-8 bg-white/95 flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 md:hidden">
                <SunPowerLogo size="xs" variant="light" />
                <p className="text-base font-bold text-slate-900">SunPower</p>
              </div>

              {isSupabaseConfigured ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Cloud Database
                </span>
              ) : (
                <DemoPill />
              )}
            </div>

            {/* Mode Switcher Tabs */}
            <div className="mb-5 flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(""); setRegisteredUsers(getRegisteredUsers()); }}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition cursor-pointer ${
                  mode === "signin"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(""); }}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === "signup"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <UserPlus className="h-3.5 w-3.5 text-emerald-600" />
                <span>Create Account</span>
              </button>
            </div>

            {/* 1. SIGN IN FORM */}
            {mode === "signin" && (
              <div>
                <h1 className="text-lg font-bold text-slate-900">Sign in to SunPower</h1>
                <p className="mt-0.5 text-[12.5px] text-slate-500">Access operations dashboard or customer portal.</p>

                <form onSubmit={handleSignIn} className="mt-4 space-y-3">
                  <div>
                    <Label required>Email</Label>
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@example.com or admin@demo.solarops"
                      autoComplete="username"
                    />
                  </div>

                  <div>
                    <Label required>Password</Label>
                    <div className="relative">
                      <Input
                        type={show ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="pr-9"
                      />
                      <button
                        type="button"
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        onClick={() => setShow(!show)}
                        tabIndex={-1}
                      >
                        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}

                  <Button type="submit" size="lg" className="w-full shadow-md mt-1" disabled={busy}>
                    <LogIn className="h-4 w-4" /> {busy ? "Authenticating…" : "Sign In"}
                  </Button>
                </form>

                {/* Quick Fill Accounts List */}
                <div className="mt-5 border-t border-slate-100 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Quick demo accounts (SuperAdmin, Staff & Customer)
                  </p>
                  <div className="mt-2 space-y-1 max-h-36 overflow-y-auto">
                    {/* Registered users */}
                    {registeredUsers.map((u) => (
                      <button
                        key={u.email}
                        type="button"
                        onClick={() => { setEmail(u.email); setPassword(u.password || "demo1234"); }}
                        className="flex w-full items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/50 px-2.5 py-1.5 text-left text-[11.5px] hover:border-emerald-400 hover:bg-emerald-50 transition cursor-pointer"
                      >
                        <span className="truncate">
                          <span className="font-semibold text-emerald-950">{u.name}</span>
                          <span className="ml-1.5 text-emerald-700 font-mono text-[10px]">({u.email})</span>
                        </span>
                        <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[9.5px] font-bold uppercase text-emerald-800">
                          {u.role}
                        </span>
                      </button>
                    ))}

                    {/* Pre-seeded demo accounts */}
                    {DEMO_USERS.map((u) => (
                      <button
                        key={u.email}
                        type="button"
                        onClick={() => { setEmail(u.email); setPassword("demo1234"); }}
                        className="flex w-full items-center justify-between rounded-lg border border-slate-200/80 bg-white/80 px-2.5 py-1.5 text-left text-[11.5px] hover:border-brand-400 hover:bg-brand-50/70 transition cursor-pointer"
                      >
                        <span className="truncate">
                          <span className="font-semibold text-slate-700">{u.name}</span>
                          <span className="ml-1.5 text-slate-400 font-mono text-[10px]">({u.email})</span>
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9.5px] font-bold capitalize text-slate-500">
                          {u.role}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 2. CREATE NEW ACCOUNT FORM */}
            {mode === "signup" && (
              <div>
                <h1 className="text-lg font-bold text-slate-900">Create New Account</h1>
                <p className="mt-0.5 text-[12.5px] text-slate-500">Register as a customer or team member.</p>

                <form onSubmit={handleSignUp} className="mt-4 space-y-3">
                  <div>
                    <Label required>Full Name</Label>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Vikram Sharma"
                      autoComplete="name"
                      required
                    />
                  </div>

                  <div>
                    <Label required>Email Address</Label>
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vikram@example.com"
                      autoComplete="email"
                      required
                    />
                  </div>

                  <div>
                    <Label required>Password (min 6 characters)</Label>
                    <div className="relative">
                      <Input
                        type={show ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        required
                        className="pr-9"
                      />
                      <button
                        type="button"
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        onClick={() => setShow(!show)}
                        tabIndex={-1}
                      >
                        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Role Selector — strictly 3 simplified roles: Customer, Staff, SuperAdmin */}
                  <div>
                    <Label required>Account Type / Role</Label>
                    <Select
                      value={role}
                      onChange={(e) => setRole(e.target.value as Role)}
                    >
                      <option value="customer">Customer (Home or Business Rooftop Owner)</option>
                      <option value="staff">Staff (Field Technician / Operations Engineer)</option>
                      <option value="superadmin">SuperAdmin (Operations Manager)</option>
                    </Select>
                  </div>

                  {/* Customer specific fields */}
                  {role === "customer" && (
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2.5 border border-slate-200 text-xs">
                      <div>
                        <Label>Phone (Optional)</Label>
                        <Input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 98000 00000"
                        />
                      </div>
                      <div>
                        <Label>City</Label>
                        <Input
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="Hyderabad"
                        />
                      </div>
                    </div>
                  )}

                  {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}

                  <Button type="submit" size="lg" className="w-full shadow-md mt-1" disabled={busy}>
                    <UserCheck className="h-4 w-4" /> {busy ? "Creating Account…" : "Create Account & Sign In"}
                  </Button>
                </form>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            {mode === "signin" ? (
              <p className="text-xs text-slate-500">
                Don't have an account yet?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("signup"); setError(""); }}
                  className="font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  Create new account
                </button>
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Already registered?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("signin"); setError(""); }}
                  className="font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  Sign in here
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </AnimatedSolarSky>
  );
}
