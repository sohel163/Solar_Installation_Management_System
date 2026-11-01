import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import {
  SunMedium,
  Sparkles,
  Zap,
  ShieldCheck,
  Wrench,
  ArrowRight,
  Calculator,
  CheckCircle2,
  PhoneCall,
  MapPin,
  Bot,
  LayoutDashboard,
  HeartHandshake,
  LogIn,
  UserPlus,
  LogOut,
  IndianRupee,
  Layers,
  Award,
} from "lucide-react";
import { AnimatedSolarSky } from "@/components/AnimatedSolarSky";
import { SunPowerLogo } from "@/components/SunPowerLogo";
import { useSession, logout } from "@/hooks/useSession";
import { formatINR } from "@/lib/utils";
import { Button } from "@/components/ui";

export default function LandingPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [monthlyBill, setMonthlyBill] = useState<number>(3500);

  // Reactive calculations based on Indian average solar irradiation (~4.5 peak sun hours, ~₹8/unit)
  const calc = useMemo(() => {
    const tariff = 8; // average ₹ per kWh in India
    const monthlyUnits = Math.round(monthlyBill / tariff);
    // 1 kW generates approx 120 units (kWh) per month (4 units/kW/day * 30)
    const rawKw = monthlyUnits / 120;
    const recommendedKw = Math.max(1, Math.min(15, Math.round(rawKw * 2) / 2));
    const monthlyGenerationUnits = Math.round(recommendedKw * 120);
    const monthlySavings = Math.round(Math.min(monthlyBill, monthlyGenerationUnits * tariff * 0.9));
    const annualSavings = monthlySavings * 12;
    const lifetimeSavings25Y = annualSavings * 25;
    const roofAreaSqFt = Math.round(recommendedKw * 100);

    // Approximate system cost & Central Government Subsidy (PM Surya Ghar scheme)
    let approxCost = 0;
    let subsidy = 0;
    if (recommendedKw <= 1) {
      approxCost = 75000;
      subsidy = 30000;
    } else if (recommendedKw <= 2) {
      approxCost = 145000;
      subsidy = 60000;
    } else if (recommendedKw <= 3) {
      approxCost = 210000;
      subsidy = 78000;
    } else {
      approxCost = Math.round(recommendedKw * 65000);
      subsidy = 78000; // capped at 3 kW for residential
    }

    const netCost = Math.max(0, approxCost - subsidy);
    const paybackYears = (netCost / Math.max(1, annualSavings)).toFixed(1);

    return {
      monthlyUnits,
      recommendedKw,
      monthlyGenerationUnits,
      monthlySavings,
      annualSavings,
      lifetimeSavings25Y,
      roofAreaSqFt,
      approxCost,
      subsidy,
      netCost,
      paybackYears,
    };
  }, [monthlyBill]);

  const openBot = (prefill?: string) => {
    window.dispatchEvent(
      new CustomEvent("solarbot-ask", {
        detail: { question: prefill || "Calculate my solar savings and recommend a system for my home." },
      }),
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white">
      {/* 1. TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3 group">
            <SunPowerLogo size="md" variant="dark" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-white">SunPower</span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                  Cloud PV
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Intelligent Solar Operations</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <a href="#calculator" className="hover:text-amber-300 transition flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5 text-amber-400" /> Savings Calculator
            </a>
            <a href="#packages" className="hover:text-emerald-300 transition flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-emerald-400" /> Packages
            </a>
            <a href="#journey" className="hover:text-lime-300 transition flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-lime-400" /> Installation Journey
            </a>
            <Link to="/technicians" className="hover:text-cyan-300 transition flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-cyan-400" /> Nearby Service Persons
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            {session ? (
              <div className="flex items-center gap-2.5">
                {session.role === "customer" ? (
                  <Link
                    to="/portal"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-lime-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:brightness-110 shadow-md transition"
                  >
                    <HeartHandshake className="h-4 w-4" /> My Solar Portal
                  </Link>
                ) : (
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-lime-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:brightness-110 shadow-md transition"
                  >
                    <LayoutDashboard className="h-4 w-4" /> Operations Dashboard
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                  title="Sign Out"
                  className="rounded-xl border border-white/10 p-2 text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/10 hover:border-white/30 transition"
                >
                  <LogIn className="h-3.5 w-3.5 text-slate-400" /> Sign In
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-lime-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:brightness-110 shadow-lg shadow-emerald-950/40 transition"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Create Account
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION WITH ANIMATED SKY & VILLA */}
      <section className="relative w-full overflow-hidden border-b border-white/10">
        <AnimatedSolarSky
          className="h-[520px] sm:h-[580px] lg:h-[640px] w-full"
          showControls={true}
          autoPlay={true}
        >
          {/* Hero Content Overlay */}
          <div className="absolute inset-0 z-10 flex flex-col justify-center px-4 sm:px-6 lg:px-8 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent pointer-events-none">
            <div className="mx-auto max-w-4xl text-center pointer-events-auto">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-slate-950/70 px-4 py-1.5 text-xs font-bold text-amber-300 backdrop-blur-md shadow-xl mb-4">
                <Sparkles className="h-4 w-4 text-amber-400 animate-spin [animation-duration:10s]" />
                <span>Next-Gen Rooftop Solar Intelligence & Management</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight drop-shadow-xl">
                Harness Clean Solar Power.
                <span className="block mt-1 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-lime-300 to-amber-300">
                  Save ₹80,000+ Every Year.
                </span>
              </h1>

              <p className="mt-4 text-sm sm:text-base text-slate-200 max-w-2xl mx-auto drop-shadow-md leading-relaxed">
                From initial 3D rooftop survey and transparent quotation to rapid installation, PM Surya Ghar subsidy approval, and lifetime performance monitoring.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="#calculator"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-lime-400 px-6 py-3.5 text-sm font-bold text-slate-950 hover:brightness-110 shadow-xl shadow-emerald-950/60 transition cursor-pointer"
                >
                  <Calculator className="h-4 w-4" /> Calculate My Savings
                </a>

                <button
                  type="button"
                  onClick={() => openBot("Hello SolarBot! Can you recommend the best rooftop solar system for my home and explain the PM Surya Ghar subsidy?")}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-400/50 bg-slate-950/80 px-6 py-3.5 text-sm font-bold text-amber-300 backdrop-blur-md hover:bg-slate-900 hover:border-amber-400 shadow-xl transition cursor-pointer"
                >
                  <Bot className="h-4 w-4 text-amber-400" /> Chat with SolarBot AI
                </button>
              </div>

              {/* Live Feature Highlights */}
              <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
                <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 backdrop-blur-md text-center">
                  <p className="text-xl font-extrabold text-amber-300">Up to ₹78,000</p>
                  <p className="text-[11px] text-slate-300 mt-0.5">Government Subsidy</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 backdrop-blur-md text-center">
                  <p className="text-xl font-extrabold text-emerald-400">3 – 4 Years</p>
                  <p className="text-[11px] text-slate-300 mt-0.5">Rapid ROI Payback</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 backdrop-blur-md text-center">
                  <p className="text-xl font-extrabold text-lime-300">25 Years</p>
                  <p className="text-[11px] text-slate-300 mt-0.5">Panel Performance Warranty</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 backdrop-blur-md text-center">
                  <p className="text-xl font-extrabold text-cyan-300">24/7 AI</p>
                  <p className="text-[11px] text-slate-300 mt-0.5">SolarBot Assistant</p>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSolarSky>
      </section>

      {/* 3. INTERACTIVE SOLAR SAVINGS CALCULATOR */}
      <section id="calculator" className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-950">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 mb-3">
              <Calculator className="h-3.5 w-3.5" /> Instant Solar Estimator
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white">How Much Can You Save With Solar?</h2>
            <p className="mt-2 text-sm text-slate-400 max-w-xl mx-auto">
              Select your current monthly electricity bill to calculate the recommended system size, generation units, government subsidies, and payback timeline.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-12 rounded-3xl border border-white/15 bg-gradient-to-br from-slate-900 to-slate-950 p-6 sm:p-8 shadow-2xl">
            {/* Input Slider Side */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Monthly Electricity Bill
                </label>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black text-amber-400">
                    {formatINR(monthlyBill)}
                  </span>
                  <span className="text-xs text-slate-400">/ month</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Approx. {calc.monthlyUnits} electricity units consumed monthly
                </p>

                <div className="mt-6">
                  <input
                    type="range"
                    min={1000}
                    max={20000}
                    step={250}
                    value={monthlyBill}
                    onChange={(e) => setMonthlyBill(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                  />
                  <div className="mt-2 flex justify-between text-[11px] font-semibold text-slate-500">
                    <span>₹1,000/mo</span>
                    <span>₹10,000/mo</span>
                    <span>₹20,000/mo</span>
                  </div>
                </div>

                <div className="mt-8 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Recommended Capacity</span>
                    <span className="font-bold text-emerald-400">{calc.recommendedKw} kW Rooftop PV</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Approx. Required Roof Area</span>
                    <span className="font-bold text-slate-200">~{calc.roofAreaSqFt} sq. ft.</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Estimated Monthly Generation</span>
                    <span className="font-bold text-slate-200">{calc.monthlyGenerationUnits} Units (kWh)</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">PM Surya Ghar Subsidy</span>
                    <span className="font-bold text-lime-400">Up to {formatINR(calc.subsidy)}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  openBot(
                    `My electricity bill is ${formatINR(monthlyBill)}/month. The calculator suggested a ${calc.recommendedKw} kW system with ${formatINR(calc.annualSavings)} annual savings. How do I proceed?`,
                  )
                }
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-lime-400 px-5 py-3 text-xs font-bold text-slate-950 hover:brightness-110 shadow-lg shadow-emerald-950/40 transition cursor-pointer"
              >
                <Bot className="h-4 w-4" /> Get Custom Quotation with SolarBot
              </button>
            </div>

            {/* Results Output Cards */}
            <div className="lg:col-span-7 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-5 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    Estimated Annual Savings
                  </span>
                  <p className="mt-2 text-2xl sm:text-3xl font-black text-white">
                    {formatINR(calc.annualSavings)}
                  </p>
                </div>
                <p className="text-[11px] text-emerald-300/80 mt-2">
                  ≈ {formatINR(calc.monthlySavings)} saved every single month on your electric bill.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 p-5 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                    25-Year Lifetime Savings
                  </span>
                  <p className="mt-2 text-2xl sm:text-3xl font-black text-amber-300">
                    {formatINR(calc.lifetimeSavings25Y)}
                  </p>
                </div>
                <p className="text-[11px] text-amber-200/80 mt-2">
                  Cumulative power generated throughout panel lifecycle.
                </p>
              </div>

              <div className="rounded-2xl border border-lime-500/30 bg-lime-950/30 p-5 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-lime-400">
                    Central Govt Subsidy
                  </span>
                  <p className="mt-2 text-2xl sm:text-3xl font-black text-white">
                    {formatINR(calc.subsidy)}
                  </p>
                </div>
                <p className="text-[11px] text-lime-200/80 mt-2">
                  Credited directly to your bank account via the National Portal.
                </p>
              </div>

              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/30 p-5 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                    Estimated Payback Period
                  </span>
                  <p className="mt-2 text-2xl sm:text-3xl font-black text-cyan-300">
                    {calc.paybackYears} Years
                  </p>
                </div>
                <p className="text-[11px] text-cyan-200/80 mt-2">
                  All solar power produced after year {Math.ceil(Number(calc.paybackYears))} is 100% free profit.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. POPULAR SOLAR PACKAGES */}
      <section id="packages" className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-900 border-t border-white/10">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-lime-500/30 bg-lime-500/10 px-3 py-1 text-xs font-bold text-lime-400 mb-3">
              <Layers className="h-3.5 w-3.5" /> High-Efficiency Systems
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white">Standard Solar System Packages</h2>
            <p className="mt-2 text-sm text-slate-400 max-w-xl mx-auto">
              Tier-1 Mono-PERC Bifacial panels, hybrid inverters, galvanized mounting structures, and complete lightning protection.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* 3 kW Package */}
            <div className="rounded-2xl border border-white/15 bg-slate-950 p-6 flex flex-col justify-between hover:border-emerald-500/50 transition shadow-xl">
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Most Popular</span>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">On-Grid</span>
                </div>
                <h3 className="text-xl font-extrabold text-white mt-2">3 kW Residential Solar</h3>
                <p className="text-xs text-slate-400 mt-1">Ideal for 2–3 BHK homes with monthly bills around ₹2,500 – ₹3,500.</p>

                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-2xl font-black text-white">₹1,95,000</p>
                  <p className="text-xs text-emerald-400 font-semibold mt-0.5">Net after ₹78,000 subsidy: ~₹1,17,000</p>
                </div>

                <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> 6 × 545W Mono PERC Half-Cut Panels
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> 3.3 kW Smart String Inverter (WiFi)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> ~360 Units Generation / Month
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> 25-Year Performance Warranty
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => openBot("I want to know more about the 3 kW Residential Solar package, pricing, and installation timeline.")}
                className="mt-8 w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 transition cursor-pointer"
              >
                Enquire for 3 kW
              </button>
            </div>

            {/* 5 kW Package */}
            <div className="rounded-2xl border-2 border-emerald-500 bg-gradient-to-b from-slate-900 to-slate-950 p-6 flex flex-col justify-between shadow-2xl relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-950">
                Recommended For Large Homes
              </div>
              <div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs font-bold text-lime-400 uppercase tracking-wider">Premium Choice</span>
                  <span className="rounded-full bg-lime-500/20 px-2 py-0.5 text-[10px] font-bold text-lime-300">Hybrid / Backup</span>
                </div>
                <h3 className="text-xl font-extrabold text-white mt-2">5 kW Hybrid Solar Array</h3>
                <p className="text-xs text-slate-400 mt-1">For 3–4 BHK villas with 1–2 Air Conditioners and power-cut backup.</p>

                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-2xl font-black text-white">₹3,20,000</p>
                  <p className="text-xs text-lime-400 font-semibold mt-0.5">Net after ₹78,000 subsidy: ~₹2,42,000</p>
                </div>

                <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-lime-400 shrink-0" /> 10 × 550W TopCon Bifacial Panels
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-lime-400 shrink-0" /> 5 kW Hybrid Inverter + Battery Ready
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-lime-400 shrink-0" /> ~600 Units Generation / Month
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-lime-400 shrink-0" /> Zero electricity bills in summer
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => openBot("Tell me about the 5 kW Hybrid Solar Array with battery backup and subsidy details.")}
                className="mt-8 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-lime-400 py-2.5 text-xs font-bold text-slate-950 hover:brightness-110 shadow-lg shadow-emerald-950/60 transition cursor-pointer"
              >
                Enquire for 5 kW
              </button>
            </div>

            {/* 10 kW Commercial Package */}
            <div className="rounded-2xl border border-white/15 bg-slate-950 p-6 flex flex-col justify-between hover:border-amber-500/50 transition shadow-xl">
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Commercial & Estates</span>
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">3-Phase High Yield</span>
                </div>
                <h3 className="text-xl font-extrabold text-white mt-2">10 kW Commercial Rooftop</h3>
                <p className="text-xs text-slate-400 mt-1">For schools, hospitals, commercial buildings, and luxury estates.</p>

                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-2xl font-black text-white">₹5,90,000</p>
                  <p className="text-xs text-amber-400 font-semibold mt-0.5">Accelerated depreciation tax benefits</p>
                </div>

                <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0" /> 18 × 560W Bifacial High-Yield Panels
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0" /> 10 kW 3-Phase Commercial Inverter
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0" /> ~1,200 Units Generation / Month
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0" /> Remote telemetry & automated alerts
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => openBot("I am interested in a 10 kW commercial solar installation. Can you explain the ROI and process?")}
                className="mt-8 w-full rounded-xl border border-amber-500/40 bg-amber-500/10 py-2.5 text-xs font-bold text-amber-300 hover:bg-amber-500 hover:text-slate-950 transition cursor-pointer"
              >
                Enquire for 10 kW
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. 6-STAGE CUSTOMER JOURNEY */}
      <section id="journey" className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-950 border-t border-white/10">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white">How Your Installation Works</h2>
            <p className="mt-2 text-sm text-slate-400">Tracked in real-time in your SunPower Customer Portal.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                step: "01",
                title: "Site Survey & Shading Analysis",
                desc: "Certified engineers visit your roof to measure dimensions, azimuth, tilt, and obstacles.",
              },
              {
                step: "02",
                title: "Custom 3D CAD & Quotation",
                desc: "Receive an itemized equipment quote, guaranteed payback schedule, and DISCOM application.",
              },
              {
                step: "03",
                title: "Equipment Prep & Serial Tracking",
                desc: "Tier-1 panels and smart inverters are dispatched from warehouse with serial-level barcodes.",
              },
              {
                step: "04",
                title: "Rapid Rooftop Installation",
                desc: "Skilled installation crew finishes structure mounting and electrical wiring in under 48 hours.",
              },
              {
                step: "05",
                title: "DISCOM Net-Meter & Subsidy",
                desc: "Bi-directional meter is energized, and your PM Surya Ghar central subsidy is processed.",
              },
              {
                step: "06",
                title: "25-Year Service & Monitoring",
                desc: "Live generation tracking, automated cleaning reminders, and on-demand certified technicians.",
              },
            ].map((j) => (
              <div key={j.step} className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 hover:border-emerald-500/40 transition">
                <span className="text-2xl font-black text-emerald-400 font-mono">{j.step}</span>
                <h4 className="text-sm font-bold text-white mt-2">{j.title}</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{j.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. FIND A NEARBY TECHNICIAN CTA */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-950 border-t border-white/10">
        <div className="mx-auto max-w-4xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-bold text-cyan-300 border border-cyan-500/30 mb-2">
              <MapPin className="h-3.5 w-3.5" /> Certified Field Technicians
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white">Need a Site Inspection or Maintenance?</h3>
            <p className="text-xs text-slate-300 mt-1">
              Find solar technicians near your location across Hyderabad, Bengaluru, Chennai, and other cities.
            </p>
          </div>

          <Link
            to="/technicians"
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-xs font-bold text-slate-950 hover:bg-cyan-300 shadow-lg shadow-cyan-950/50 transition shrink-0"
          >
            <MapPin className="h-4 w-4" /> Find Nearby Service Persons
          </Link>
        </div>
      </section>

      {/* 7. FOOTER — theme band */}
      <footer className="mt-auto border-t border-brand-100 bg-brand-50/70">
        <div className="px-4 py-10">
          <div className="mx-auto w-full max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4 px-1 text-xs text-brand-900/80">
            <div className="flex items-center gap-2.5">
              <SunPowerLogo size="xs" variant="bare" />
              <span className="font-semibold">SunPower</span>
              <span className="opacity-80">— From First Lead to Lifetime Solar Service</span>
            </div>
            <div className="flex flex-wrap justify-center gap-4 font-semibold">
              <Link to="/login" className="hover:opacity-70 transition">Sign In</Link>
              <Link to="/login" className="hover:opacity-70 transition">Create Account</Link>
              <Link to="/technicians" className="hover:opacity-70 transition">Nearby Service Persons</Link>
              <Link to="/dashboard" className="hover:opacity-70 transition">Operations Dashboard</Link>
              <Link to="/portal" className="hover:opacity-70 transition">Customer Portal</Link>
            </div>
            <p className="opacity-80">© 2026 SunPower Solutions. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

