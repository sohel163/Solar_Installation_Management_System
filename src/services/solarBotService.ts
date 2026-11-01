// ============================================================
// SolarBot — Domain-Aware AI Assistant & Chat Service
// Supports live OpenAI server proxy calls with a robust,
// comprehensive domain-expert fallback engine.
// Never exposes API keys in frontend code.
// ============================================================

import { getDB, mutate } from "./store";
import type { Customer, ServiceTicket, SiteSurvey, TechnicianProfile, SolarPackage } from "@/types";
import { createCustomer, createSurvey, createTicket } from "./api";
import { estimateAnnualSavings, recommendCapacity } from "@/lib/calculations/finance";
import { formatINR } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  text: string;
  timestamp: string;
  actionCard?: {
    type: "calculator" | "technician_list" | "confirmation" | "success" | "auth_required";
    data?: any;
  };
  source?: "live" | "expert_rules";
}

export interface UserSessionInfo {
  isLoggedIn: boolean;
  role?: string;
  name?: string;
  email?: string;
  customerId?: string;
}

// Conversation context memory
let conversationHistory: { role: "user" | "assistant"; content: string }[] = [];
let chatTranscript: ChatMessage[] = [];
let lastKnownTopic: string | null = null;

export function clearConversationHistory() {
  conversationHistory = [];
  chatTranscript = [];
  lastKnownTopic = null;
}

/**
 * Full chat transcript — kept at module level so the conversation SURVIVES
 * the chat panel being closed or minimized (previously every message was lost).
 */
export function getChatTranscript(): ChatMessage[] {
  return chatTranscript;
}

export function saveChatTranscript(msgs: ChatMessage[]) {
  chatTranscript = msgs;
}

const OPENAI_PROXY_URL = import.meta.env.VITE_OPENAI_PROXY_URL;

/**
 * Call the secure server-side AI proxy if configured.
 * Does not expose keys in the frontend bundle.
 * Includes a circuit breaker: if the proxy is down / out of quota,
 * stop retrying it for a few minutes so every message isn't slowed.
 */
let liveAiCooldownUntil = 0;

async function callLiveProxy(userPrompt: string, systemPrompt: string): Promise<string | null> {
  if (!OPENAI_PROXY_URL) return null;
  if (Date.now() < liveAiCooldownUntil) return null; // proxy known-bad right now
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const res = await fetch(OPENAI_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: "raw_chat",
        payload: {
          message: userPrompt,
          system: systemPrompt,
          history: conversationHistory.slice(-6),
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      // Proxy down / quota exhausted — retry again only after a cooldown.
      liveAiCooldownUntil = Date.now() + 3 * 60 * 1000;
      return null;
    }
    liveAiCooldownUntil = 0;
    const data = await res.json();
    return typeof data.text === "string" && data.text.trim().length > 0 ? data.text.trim() : null;
  } catch {
    liveAiCooldownUntil = Date.now() + 3 * 60 * 1000;
    return null;
  }
}

/**
 * Main query processor: handles natural language questions,
 * authenticates private customer requests, computes accurate savings,
 * and manages interactive workflows.
 */
export async function processSolarBotQuery(
  rawInput: string,
  session: UserSessionInfo | null,
): Promise<ChatMessage> {
  const input = rawInput.trim();
  const lower = input.toLowerCase();
  const db = getDB();
  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Record user turn in context history
  conversationHistory.push({ role: "user", content: input });
  if (conversationHistory.length > 10) conversationHistory = conversationHistory.slice(-10);

  // 1. Check for specific action triggers or workflows
  // -------------------------------------------------------------
  // A. Savings Calculator request
  if (
    lower.includes("calculate my solar savings") ||
    lower.includes("savings calculator") ||
    lower.includes("estimate savings") ||
    lower.includes("calculate savings") ||
    lower.includes("solar savings") ||
    lower.includes("how much can i save") ||
    lower.includes("how much will i save") ||
    (lower.includes("save") && lower.includes("bill"))
  ) {
    return {
      id: "bot-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      sender: "bot",
      timestamp,
      text: "I can help you calculate your solar generation, estimated electricity bill savings, and payback period! ☀️\n\nYou can use our quick interactive calculator below or tell me your monthly electricity bill (e.g. 'My bill is ₹3,000/month').",
      actionCard: {
        type: "calculator",
        data: {
          defaultBill: 3000,
          packages: db.solar_packages,
        },
      },
      source: "expert_rules",
    };
  }

  // B. Technician Locator request
  if (
    lower.includes("find a nearby solar technician") ||
    lower.includes("nearby technician") ||
    lower.includes("technician near me") ||
    lower.includes("find a technician") ||
    lower.includes("find technician") ||
    lower.includes("technicians") ||
    lower.includes("technician") && lower.includes("around") ||
    lower.includes("local service person")
  ) {
    const availableTechs = db.technicians.filter((t) => t.is_active);
    return {
      id: "bot-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      sender: "bot",
      timestamp,
      text: `We have ${availableTechs.length} verified solar technicians registered in our service network across Hyderabad and surrounding regions. Here are our top specialists:`,
      actionCard: {
        type: "technician_list",
        data: {
          technicians: availableTechs.slice(0, 4),
        },
      },
      source: "expert_rules",
    };
  }

  // C. Track Installation / Private customer data request
  const isTrackingRequest =
    (lower.includes("track") && (lower.includes("installation") || lower.includes("project") || lower.includes("order") || lower.includes("status"))) ||
    lower.includes("installation status") ||
    lower.includes("track my installation") ||
    lower.includes("my project") ||
    lower.includes("my solar project");

  if (isTrackingRequest) {
    if (!session || !session.isLoggedIn) {
      return {
        id: "bot-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        sender: "bot",
        timestamp,
        text: "🔒 **Authentication Required**\n\nTo view your confidential installation progress, equipment reservations, or scheduled dates, please sign in with your customer account.",
        actionCard: {
          type: "auth_required",
          data: { reason: "view installation status" },
        },
        source: "expert_rules",
      };
    }

    if (session.role === "customer" && session.customerId) {
      const proj = db.installation_projects.find((p) => p.customer_id === session.customerId);
      if (!proj) {
        return {
          id: "bot-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
          sender: "bot",
          timestamp,
          text: `Hello ${session.name}! I checked your account, but there are no active installation projects currently linked to customer ID \`${session.customerId}\`. Would you like to schedule a site survey?`,
          source: "expert_rules",
        };
      }

      const crew = db.installation_crews.find((c) => c.id === proj.crew_id);
      return {
        id: "bot-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        sender: "bot",
        timestamp,
        text: `📍 **Project Status: ${proj.number}**\n\n` +
          `• **Package:** ${proj.package_name} (${proj.capacity_kw} kW ${proj.installation_type})\n` +
          `• **Current Stage:** **${proj.status.replace(/_/g, " ").toUpperCase()}**\n` +
          `• **Equipment Dispatch:** ${proj.equipment_status === "dispatched" ? "✅ Dispatched to site" : "⏳ " + proj.equipment_status}\n` +
          `• **Installation Crew:** ${crew ? crew.name + " (" + crew.phone + ")" : "Assigning soon"}\n` +
          `• **Scheduled Window:** ${proj.scheduled_start ? `${proj.scheduled_start} to ${proj.scheduled_end}` : "Awaiting final date lock"}`,
        source: "expert_rules",
      };
    }

    // Staff / Admin tracking
    return {
      id: "bot-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      sender: "bot",
      timestamp,
      text: `Staff mode: We have ${db.installation_projects.length} installation projects recorded in SunPower (${db.installation_projects.filter((p) => p.status === "in_progress").length} currently in progress). You can manage them in the **Installations** menu.`,
      source: "expert_rules",
    };
  }

  // D. Check Warranties (Private)
  if (lower.includes("warranty") && (lower.includes("my") || lower.includes("claim") || lower.includes("certificate"))) {
    if (!session || !session.isLoggedIn) {
      return {
        id: "bot-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        sender: "bot",
        timestamp,
        text: "🔒 **Authentication Required**\n\nTo view your registered equipment serial numbers and active warranty certificates, please log in as a customer.",
        actionCard: { type: "auth_required", data: { reason: "access warranty certificates" } },
        source: "expert_rules",
      };
    }
    if (session.customerId) {
      const custWarranties = db.warranties.filter((w) => w.customer_id === session.customerId);
      if (custWarranties.length === 0) {
        return {
          id: "bot-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
          sender: "bot",
          timestamp,
          text: `You currently have 0 active warranty certificates registered. Warranties are activated automatically once the post-installation quality inspection is completed.`,
          source: "expert_rules",
        };
      }
      const list = custWarranties
        .map((w) => `• **${w.product_name}** (${w.warranty_type})\n  Serial: \`${w.serial_number}\` | Valid until: ${w.end_date}`)
        .join("\n\n");
      return {
        id: "bot-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        sender: "bot",
        timestamp,
        text: `🛡️ **Your Registered Warranties:**\n\n${list}\n\nYou can download official PDF warranty certificates directly in your Customer Portal.`,
        source: "expert_rules",
      };
    }
  }

  // 2. Try Live AI Proxy (if available and configured)
  // -------------------------------------------------------------
  const systemPrompt = `You are "SolarBot", the intelligent AI solar assistant for SunPower (Hyderabad, Telangana, India).
Tone: Friendly, highly competent, professional, helpful, and concise.
Rules:
- Give accurate information regarding solar rooftop panels (1kW to 10kW), on-grid vs off-grid systems, inverters, and warranties.
- Currency is Indian Rupees (INR / ₹).
- Central Government Subsidy (PM Surya Ghar Muft Bijli Yojana): 1kW = ₹30,000, 2kW = ₹60,000, 3kW+ = ₹78,000 maximum. Official portal: pmsuryaghar.gov.in.
- For private customer data (orders, invoices, warranties), tell users they must log in.
- Safety first: never instruct users to touch live wiring or open inverter covers.
- Keep answers concise (max 3 short paragraphs or clean bullet points).`;

  const liveResponse = await callLiveProxy(input, systemPrompt);
  if (liveResponse) {
    conversationHistory.push({ role: "assistant", content: liveResponse });
    return {
      id: "bot-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      sender: "bot",
      timestamp,
      text: liveResponse,
      source: "live",
    };
  }

  // 3. Robust Expert Knowledge Fallback Engine
  // -------------------------------------------------------------
  const answer = getExpertDomainResponse(input, lower, db);
  conversationHistory.push({ role: "assistant", content: answer.text });
  // Remember the active conversation topic so short follow-ups ("tell me more",
  // "and the cost?") keep the context like a real AI assistant would.
  const topic = topicOf(lower);
  if (topic) lastKnownTopic = topic;
  return {
    id: "bot-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    sender: "bot",
    timestamp,
    text: answer.text,
    actionCard: answer.actionCard,
    source: "expert_rules",
  };
}

/** Maps a query to a conversation topic id (for multi-turn follow-ups). */
function topicOf(lower: string): string | null {
  if (includesAny(lower, "saving", "calculator", "payback", "roi")) return "savings";
  if (includesAny(lower, "price", "cost", "package", "pricing", "quotation", "rate", "charge", "budget")) return "pricing";
  if (includesAny(lower, "subsidy", "government", "surya", "yojana", "muft")) return "subsidy";
  if (includesAny(lower, "technician", "locator", "near me", "service person")) return "technicians";
  if (includesAny(lower, "warranty")) return "warranty";
  if (includesAny(lower, "installation", "install", "crew", "commission")) return "installation";
  if (includesAny(lower, "net meter", "net-meter", "metering", "bidirectional", "bi-directional")) return "net_metering";
  if (includesAny(lower, "maintenance", "clean", "troubleshoot", "fault", "inverter")) return "maintenance";
  if (includesAny(lower, "kw", "capacity", "system size", "on-grid", "off-grid", "battery")) return "sizing";
  if (includesAny(lower, "login", "log in", "sign in", "account", "password")) return "login";
  if (includesAny(lower, "app", "website", "module", "page", "feature")) return "website";
  if (includesAny(lower, "payment", "analytics", "report", "kpi", "chart", "insight")) return "reports";
  if (includesAny(lower, "survey")) return "survey";
  return null;
}

/**
 * High-precision domain knowledge engine for comprehensive offline intelligence.
 * Intent matching uses WIDE keyword sets (synonyms & phrasings) so different
 * questions always produce different, relevant answers — including questions
 * about the website/app itself.
 */
function includesAny(lower: string, ...words: string[]): boolean {
  return words.some((word) => lower.includes(word));
}

function getExpertDomainResponse(
  input: string,
  lower: string,
  db: ReturnType<typeof getDB>,
): { text: string; actionCard?: ChatMessage["actionCard"] } {
  // 0. SAFETY: serial-number / inventory questions shouldn't be swallowed by
  //    the generic app-help or login intents below.
  const serialQuestion = includesAny(lower, "serial", "inventory", "stock", "equipment unit");

  // 0A. GREETINGS — quick friendly chat opener
  if (
    /^(hi+|hii+|hello+|hey+|yo|hola|namaste|namaskaram|good morning|good afternoon|good evening|greetings)\b/.test(lower) ||
    lower === "hi" || lower === "hey" || lower === "hello"
  ) {
    return {
      text:
        `👋 Hello! I'm **SolarBot**, your solar expert at SunPower Solutions ☀️\n\n` +
        `Ask me anything — for example:\n` +
        `• *"How much can I save with solar?"* (I'll generate a live estimate)\n` +
        `• *"What is net metering?"* or *"Which kW system suits my home?"*\n` +
        `• *"What does this website do?"* or *"How do I log in?"* — full walkthroughs of every module\n\n` +
        `I'm all ears! 🌞`,
    };
  }

  // 0B. WHO ARE YOU / ARE YOU AI
  if (
    includesAny(lower, "who are you", "what are you", "your name", "about yourself", "about you", "are you ai", "are you a bot", "are you human", "real ai")
  ) {
    return {
      text:
        `🤖 **I'm SolarBot — the built-in assistant of this SunPower platform.**\n\n` +
        `I run on an **Solar-domain expert knowledge engine** written directly into this app: pricing rules, subsidy tables, installation SOPs, safety procedures, plus a live map of everything this website can do.\n\n` +
        `**Two modes (labelled honestly in the chat):**\n` +
        `• Without a live-AI key: I answer using my built-in solar expert rules — instant, offline, reliable.\n` +
        `• With the optional server-proxied AI key: my replies come from a full language model, marked *"Live AI"*.\n\n` +
        `Either way, my numbers (savings, pricing, subsidy) always come from this app's own finance engine — never invented.`,
    };
  }

  // 0C. THANKS / NICE
  if (includesAny(lower, "thank", "thanks", "thx", "great job", "awesome", "well done", "helpful")) {
    return {
      text:
        `😊 Anytime! That's what I'm here for.\n\n` +
        `If you want to keep exploring, try:\n` +
        `• *"Estimate savings for a ₹4,000 bill"* → instant calculator\n` +
        `• *"Show me around the website"* → guided tour of every module\n` +
        `• *"Schedule a site survey"* → I can create a real survey request\n\n` +
        `Or just ask whatever crosses your mind about solar! ☀️`,
    };
  }

  // 1. WEBSITE / APP OVERVIEW — "what does this app do?"
  if (
    includesAny(
      lower,
      "what is this app",
      "what does this app",
      "what can this app",
      "what this app",
      "what is this website",
      "what does this website",
      "what does this site",
      "what is sunpower",
      "features of this",
      "what modules",
      "what pages",
      "what features",
      "list the modules",
      "app does",
      "site does",
      "how does this app",
      "how does this website",
      "what can you do",
    )
  ) {
    return {
      text:
        `☀️ **SunPower — Intelligent Solar Operations Platform**\n\n` +
        `This web app manages the *complete solar journey* for a rooftop-solar company, end-to-end:\n\n` +
        `• **Overview (Dashboard)** — live KPIs and business charts\n` +
        `• **Customers & Leads** — register enquiries, track lead funnel\n` +
        `• **Site Surveys → Quotations** — engineer survey data becomes an instant ₹ quotation with subsidy math\n` +
        `• **Inventory & Serial Numbers** — panels/inverters tracked by unique serials\n` +
        `• **Installations** — crews, checklists, equipment dispatch\n` +
        `• **Warranties** — auto-activated certificates + printable PDFs\n` +
        `• **Service Center & Payments & Subsidies & Analytics** — tickets, money flow, government tables, insights\n` +
        `• **Customer Portal** — customers track their own project, documents & warranties\n\n` +
        `It runs 100% offline in demo mode — no API keys needed. Ask me *"How do I log in?"* or *"Where can I see quotations?"* for a walkthrough!`,
    };
  }

  // 2. INVENTORY / SERIAL NUMBER questions
  if (serialQuestion) {
    return {
      text:
        `📦 **Inventory & Serial-Number Management**\n\n` +
        `• Every panel, inverter and battery enters the Inventory module with a **unique serial number** — duplicates are rejected automatically.\n` +
        `• Staff can **pin-to-pin trace** any serial: which project it was reserved for, when it was dispatched, and which warranty certificate it maps to.\n` +
        `• Equipment moves through states: *in_stock → reserved → dispatched → installed*, all visible on the unit's timeline.\n\n` +
        `To see it live: Inventory → open any unit → check its status chip. To register stock: Inventory → ➕ Register Equipment.`,
    };
  }

  // 3. LOGIN / ACCOUNTS HELP — "how do I log in?"
  if (
    !serialQuestion &&
    includesAny(
      lower,
      "log in",
      "login",
      "log-in",
      "sign in",
      "signin",
      "password",
      "credentials",
      "demo account",
      "demo user",
      "demo login",
      "which email",
      "can not signin",
      "cant sign in",
      "can't log",
      "can't sign",
      "create account",
      "sign up",
      "signup",
      "register me",
    )
  ) {
    return {
      text:
        `🔐 **How to log in to SunPower**\n\n` +
        `1. Click **Sign In** (top-right) — you'll land on the login page.\n` +
        `2. Click any quick demo account row to auto-fill, or type credentials:\n\n` +
        `   • \`admin@demo.solarops\` — **SuperAdmin** (full operations dashboard)\n` +
        `   • \`staff@demo.solarops\` — **Staff** (field/engineer view)\n` +
        `   • \`customer@demo.solarops\` — **Customer** (Ramesh Gupta's portal view)\n\n` +
        `   Password for all demo accounts: \`demo1234\`\n` +
        `3. Or use **Create Account** to register your own (customer / staff / superadmin).\n\n` +
        `🧪 Demo mode: accounts and data are stored in your browser — no real backend or internet needed. After login, logout switching works too (try the Logout button top-right).`,
    };
  }

  // 4. WEBSITE NAVIGATION — "where is X?" / "how do I use this site?"
  if (
    !serialQuestion &&
    includesAny(
      lower,
      "where is",
      "where do i",
      "where can i see",
      "where will i find",
      "which page",
      "which menu",
      "navigate",
      "navigation",
      "sidebar",
      "menu item",
      "go to page",
      "open the page",
      "how do i find",
      "how to find the",
      "use this app",
      "use this site",
      "use this website",
      "how do i use",
      "how to use this",
      "technician locator",
      "locator page",
      "map page",
      "the map",
      "qr",
      "export",
      "print",
      "csv",
      "settings page",
      "portal page",
      "dashboard page",
    )
  ) {
    return {
      text:
        `🧭 **Website map & how to get around:**\n\n` +
        `**Staff pages (sidebar after login):**\n` +
        `• Overview — KPIs & charts (landing page after admin login)\n` +
        `• Customers & Leads → Site Surveys → **Quotations** (with Accept → Convert → Project)\n` +
        `• Inventory (equipment + serials) → Installations → Warranties\n` +
        `• Service Center, Nearby Service Persons, Payments & Expenses, Subsidies, Analytics\n` +
        `• **Settings** — registration info + "**Reset demo data**" + live API status\n\n` +
        `**Customer side:** login as the customer account → **Customer Portal** (project tracker, documents). The **Nearby Service Persons / technician locator** shows a free OpenStreetMap map with \"Use my location\".\n\n` +
        `Everything is reachable from the left sidebar — no deep navigation needed. What would you like to open?`,
    };
  }

  // 5. DEMO MODE / OFFLINE / APIs — "does this need an API key?"
  if (
    includesAny(
      lower,
      "demo mode",
      "demo data",
      "reset demo",
      "reset data",
      "offline",
      "without internet",
      "api key",
      "free api",
      "api used",
      "apis",
      "openstreetmap",
      "supabase",
      "local database",
      "localstorage",
      "does this need",
      "internet required",
    )
  ) {
    return {
      text:
        `🧪 **Demo mode & the free APIs behind this site:**\n\n` +
        `• **Demo mode (default):** all data lives in your browser's localStorage — everything works with **zero API keys and no internet**, and it's labelled honestly in the UI.\n` +
        `• **Free keyless APIs in use:** OpenStreetMap tiles (technician map) + the browser Geolocation API (\"Use my location\").\n` +
        `• **Optional (off by default):** OpenAI via a secure server proxy (key never touches the browser) and Supabase cloud DB — the app clearly shows \"not configured\" in **Settings → Environment capability status** and falls back to rule-based AI.\n` +
        `• ♻️ **Reset anytime:** Settings → *Reset demo data* — restores the original seed records.`,
    };
  }

  // 6. Pricing / Packages questions (subsidy-specific questions are handled by intent 7)
  if (
    !includesAny(lower, "subsidy", "government", "govt", "surya ghar", "yojana") &&
    includesAny(
      lower,
      "price",
      "cost",
      "how much",
      "quotation",
      "rates",
      "charges",
      "expensive",
      "cheaper",
      "budget",
      "package",
      "pricing",
    )
  ) {
    const pkgs = db.solar_packages.filter((p) => p.is_active);
    const lines = pkgs.map((p) => {
      const gross = p.equipment_cost + p.installation_cost + p.additional_cost;
      const tax = (gross * p.tax_percent) / 100;
      const total = gross + tax;
      const subsidy = p.capacity_kw >= 3 ? 78000 : p.capacity_kw === 2 ? 60000 : 30000;
      const net = Math.max(0, total - subsidy);
      return `• **${p.name}** (${p.capacity_kw} kW ${p.system_type === "on_grid" ? "On-Grid" : "Off-Grid"}): Total ~${formatINR(total)} → **Net after subsidy: ~${formatINR(net)}**`;
    });

    return {
      text: `☀️ **Standard Rooftop Solar Packages & Pricing Estimates:**\n\n${lines.join("\n")}\n\n*Note: These are approved baseline estimates including high-efficiency Tier-1 panels, smart inverter, structure, bi-directional net meter support, and standard installation. Final quotation requires a site survey to verify rooftop cabling and structure height.*`,
      actionCard: {
        type: "calculator",
        data: { defaultBill: 3500 },
      },
    };
  }

  // 7. Government Subsidies / PM Surya Ghar
  if (
    includesAny(
      lower,
      "subsidy",
      "subsidies",
      "government",
      "govt",
      "pm surya ghar",
      "surya",
      "muft bijli",
      "yojana",
    )
  ) {
    return {
      text: `🏛️ **PM Surya Ghar: Muft Bijli Yojana — Central Government Subsidy:**\n\n` +
        `The Government of India provides direct bank transfer (DBT) subsidies for residential rooftop solar:\n\n` +
        `• **1 kW System:** **₹30,000** financial assistance\n` +
        `• **2 kW System:** **₹60,000** financial assistance\n` +
        `• **3 kW to 10 kW Systems:** **₹78,000** (maximum central cap)\n\n` +
        `**Eligibility & Steps:**\n` +
        `1. Must be a residential home with dedicated electricity meter.\n` +
        `2. Registered via the National Portal (\`pmsuryaghar.gov.in\`).\n` +
        `3. Installed by an empaneled vendor (like SunPower Solutions).\n` +
        `4. Post net-metering DISCOM inspection, subsidy is credited directly to your bank account within 30 days.\n\n` +
        `Would you like to check how much subsidy your rooftop qualifies for?`,
    };
  }

  // 8. System selection (1kW, 2kW, 3kW, 5kW, on-grid vs off-grid)
  if (
    includesAny(
      lower,
      "find the right",
      "which system",
      "what system",
      "best system",
      "recommend",
      "capacity",
      "size",
      "roof space",
      "kw for",
      "1kw",
      "2kw",
      "3kw",
      "5kw",
      "10kw",
      "on-grid",
      "on grid",
      "ongrid",
      "off-grid",
      "off grid",
      "offgrid",
      "battery",
    )
  ) {
    return {
      text: `🏡 **How to Choose the Right Solar System for Your Home:**\n\n` +
        `• **1 kW (~120 units/month):** Ideal for 1 BHK or small apartments with bills around ₹800–₹1,200. Requires ~100 sq.ft roof space.\n` +
        `• **2 kW (~240 units/month):** Great for 2 BHK homes with 1 AC, refrigerator, and fans (bills around ₹1,800–₹2,500). Requires ~180–200 sq.ft.\n` +
        `• **3 kW (~360 units/month):** Our most popular choice for 3 BHK homes with 2 ACs (bills around ₹2,500–₹3,800). Qualifies for maximum ₹78,000 subsidy.\n` +
        `• **5 kW (~600 units/month):** For large independent villas or heavy daytime loads (bills ₹5,000+). Requires ~450 sq.ft.\n\n` +
        `**On-Grid vs Off-Grid:**\n` +
        `• **On-Grid:** Best ROI (3–4 years payback), lowest cost, exports surplus power to grid via Net Metering. (Recommended if grid is reliable).\n` +
        `• **Off-Grid / Hybrid:** Includes LiFePO4 battery backup for power cuts. Higher investment, but complete energy independence.`,
    };
  }

  // 8B. Payments / Expenses module & payment methods
  if (
    includesAny(
      lower,
      "payment",
      "payments",
      "upi",
      "razorpay",
      "receipt",
      "invoice",
      "emi",
      "netbanking",
      "net banking",
      "bank transfer",
    )
  ) {
    return {
      text:
        `💳 **Payments, Invoices & Money Flow (SunPower)**\n\n` +
        `• Every project's money trail lives in the **Payments & Expenses** page: advance/first payment, milestone payments, final payment, plus expenses the crew booked (transport, structure fitting, DISCOM fees).\n` +
        `• **Payment methods supported** in the records: UPI, bank transfer / NEFT, cheque, and cash — each with a transaction reference for a clean audit trail.\n` +
        `• **Duplicate-protection guard:** the same transaction reference + project + amount can never be recorded twice — the system rejects it with a clear warning.\n` +
        `• Customers can see their own payment history in the **Customer Portal**.\n\n` +
        `*(This demo records payments manually; a Razorpay online gateway integration is documented as a future option in Settings.)*`,
    };
  }

  // 8C. Analytics / reports / KPIs
  if (
    includesAny(
      lower,
      "analytics",
      "reports",
      "report page",
      "charts",
      "insights",
      "kpi",
      "kpis",
      "dashboard shows",
      "business health",
    )
  ) {
    return {
      text:
        `📊 **Analytics & Business Intelligence**\n\n` +
        `The **Analytics** page builds every number LIVE from your operational records — nothing is hard-coded:\n\n` +
        `• **Revenue insights** — quotations accepted vs pending, payment collection progress\n` +
        `• **Operations funnel** — leads → surveys → quotations → active installations → completed → warranties\n` +
        `• **Service performance** — open/tickets resolved, technician workload\n` +
        `• **Inventory health** — serial units in stock vs dispatched, low-stock alerts\n\n` +
        `The executive **Overview** page also computes its KPI cards live (current demo seed: 12 customers, 4 projects, 31 serial units). Free demo: refresh or reset data from **Settings** to see analytics recompute instantly.`,
    };
  }

  // 8D. Warranty coverage length / what's covered
  if (includesAny(lower, "years of warranty", "warranty covers", "warranty period", "25 year", "25-year", "how long is the warranty")) {
    return {
      text:
        `🛡️ **SunPower Warranty Coverage**\n\n` +
        `• **Solar Panels — 25 years** linear performance warranty (~87% output in year 25) + 12-year product warranty\n` +
        `• **Inverter — 5 years** standard, extendable to 10\n` +
        `• **Workmanship — 5 years** on mounting structure & installation quality\n\n` +
        `**How it works in this app:** the moment a project passes its post-installation quality checklist and the customer accepts, warranty certificates are **auto-activated** with serial numbers mapped — printable as PDF certificates from the Warranties page. Warranty claims flow straight into the **Service Center** ticket queue.`,
    };
  }

  // 9. Net Metering — dedicated intent (kept ahead of the generic timeline intent)
  if (
    includesAny(
      lower,
      "net meter",
      "net-meter",
      "net metering",
      "netmeter",
      "metering",
      "bi-directional",
      "bidirectional",
      "export power",
      "sell electricity",
      "surplus power",
      "excess units",
    )
  ) {
    return {
      text:
        `🔁 **Net Metering Explained (How your surplus becomes credit):**\n\n` +
        `1. Your solar system powers your home appliances **directly from sunlight** during the day.\n` +
        `2. Surplus generation is **exported back to the DISCOM grid** through a special **bi-directional (net) meter** that counts both directions.\n` +
        `3. At night you import from the grid as usual — your **meter only bills the NET difference** between what you exported and imported.\n` +
        `4. Monthly bill example (TS NPDCL): solar units exported 320 → consumed 300 → your bill is effectively **₹0** or small credit; surplus credits carry forward for the settlement period.\n\n` +
        `**Where you see it in this app:** the payments/models use a *"bi-directional net meter support"* line-item in every quotation, and the 12-step installation journey includes **Net-Meter Synchronization** at step 7 before handover.\n\n` +
        `*Note: exact credit rules differ per DISCOM (TSSPDCL/NPDCL in Telangana) — the surveyor confirms YOUR final tariff breakdown.*`,
    };
  }

  // 10. Installation process & timeline
  if (
    includesAny(
      lower,
      "installation process",
      "how installation works",
      "how do you install",
      "how will you install",
      "how to install",
      "how long",
      "how many days",
      "when will my",
      "commissioning",
      "steps",
      "timeline",
      "journey",
    )
  ) {
    return {
      text: `⚡ **The SunPower 12-Step Installation Journey:**\n\n` +
        `1. **Site Survey:** Engineer visits your roof for shadow analysis, structure load, and cable routing (1–2 days).\n` +
        `2. **Custom Engineering Design & Quotation:** 3D layout, single-line diagram, and financial breakdown.\n` +
        `3. **DISCOM Feasibility Approval:** Submission to local electricity board for net-metering approval.\n` +
        `4. **Material Dispatch:** High-efficiency Mono PERC panels, galvanized mounting structure, and smart inverter reserved & dispatched.\n` +
        `5. **Rooftop Mounting & Cabling:** Certified technicians install modules, earthing rods, lightning arrester, and AC/DC distribution boxes (takes 1–2 days).\n` +
        `6. **Quality Inspection & Testing:** 25-point safety checklist.\n` +
        `7. **Net-Meter Synchronization:** Bi-directional meter installation and official grid commissioning.\n` +
        `8. **Warranty Activation & Handover:** Official certificate registration for 25-year panel performance!`,
    };
  }

  // 10. Maintenance, Cleaning, & Troubleshooting
  if (
    includesAny(
      lower,
      "maintenance",
      "cleaning",
      "clean my",
      "clean panel",
      "panel cleaning",
      "wash",
      "dusty",
      "dirty",
      "troubleshoot",
      "inverter",
      "red light",
      "low generation",
      "not generating",
      "low output",
      "fault",
      "not working",
      "error",
      "issue with my",
    )
  ) {
    return {
      text: `🔧 **Routine Maintenance & Safe Troubleshooting Guide:**\n\n` +
        `• **Panel Cleaning:** Wash panels every 2 to 4 weeks using clean, soft water and a microfiber sponge. Always clean early in the morning or evening when panels are cool to avoid thermal glass crack.\n` +
        `• **Inverter Warning Codes:**\n` +
        `  - *Red LED / Grid Out:* Check if main grid breaker (MCB) is tripped.\n` +
        `  - *Low Generation:* Check for heavy dust, bird droppings, or new shadow obstructions (tree branches).\n` +
        `  - *Isolation Fault:* Moisture in cable connectors after heavy rain.\n\n` +
        `⚠️ **CRITICAL SAFETY WARNING:** Never attempt to open the inverter enclosure, touch bare DC cables, or inspect wiring yourself. Rooftop solar generates up to 600V–1000V DC. If an error persists, request an authorized technician visit immediately!`,
    };
  }

  // 11. Contact support / Book survey / General enquiry
  if (
    includesAny(
      lower,
      "contact",
      "phone",
      "support",
      "survey",
      "book",
      "call",
      "visit",
      "engineer come",
      "talk to",
      "reach",
    )
  ) {
    return {
      text: `📞 **SunPower Solutions Support & Engineering Center:**\n\n` +
        `• **Hotline:** +91 90000 76527 (Mon–Sat 9:00 AM – 7:00 PM)\n` +
        `• **Email:** support@demo.solarops.ai\n` +
        `• **Headquarters:** Road No. 36, Jubilee Hills, Hyderabad, Telangana 500033\n\n` +
        `You can request a free rooftop site survey right now! Simply share your name, phone number, and city, and I will book an engineer visit for you.`,
    };
  }

  // 13. SHORT FOLLOW-UPS — keep multi-turn context ("tell me more", "and the cost?", "why?")
  if (
    lastKnownTopic &&
    lower.length <= 38 &&
    includesAny(lower, "tell me more", "more", "explain more", "elaborate", "continue", "expand", "detail", "details", "and why", "why", "example", "continue")
  ) {
    const detail = topicFollowUp(lastKnownTopic);
    if (detail) return { text: detail };
  }

  // 14. Default — intelligent, VARIED overview (three rotating variants) including website help
  const activeProjects = db.installation_projects.filter((p) => p.status !== "completed").length;
  const turn = conversationHistory.length % 3;
  if (turn === 1) {
    return {
      text:
        `I'm ready with as much detail as you need! ☀️ Quick pointers to get the best out of me:\n\n` +
        `**Money & estimates** — *"Calculate savings for a ₹3,000 bill"*, *"package prices"*, *"subsidy amount for 3kW"*\n` +
        `**This website** — *"What does this app do?"*, *"How do I log in?"*, *"Where are quotations?"*, *"what are serial numbers used for?"*\n` +
        `**Technical solar** — *"net metering"*, *"on-grid vs off-grid"*, *"inverter red light"*, *"panel cleaning"*\n\n` +
        `Ask in your own words — even short half-sentences work, I keep context across messages.`,
    };
  }
  if (turn === 2) {
    return {
      text:
        `Hmm — I want to answer that precisely. I'm SolarBot, expert in two big areas 🌞\n\n` +
        `**1. Solar rooftop energy** — sizing, pricing, PM Surya Ghar subsidy (₹30k/₹60k/₹78k), net metering, installation timelines, maintenance & safety, warranties.\n` +
        `**2. This SunPower web platform** — all ${12} modules: Leads → Surveys → Quotations → Inventory serials → Installations → Warranties → Service → Payments → Subsidies → Analytics, plus the Customer Portal and the technician locator map.\n\n` +
        `Maybe ask: *"track my installation"* / *"what does the analytics page show?"* / *"how much subsidy do I get?"*`,
    };
  }
  return {
    text:
      `I'm here to assist with all aspects of solar energy at SunPower Solutions! ☀️\n\n` +
      `**Solar topics I know well:**\n` +
      `• **"Calculate my solar savings"** — see how much you save on your electricity bill\n` +
      `• **"Check installation prices"** — cost estimates and subsidy benefits\n` +
      `• **"Learn about government subsidies"** — PM Surya Ghar ₹78,000 details\n` +
      `• **"Find a nearby solar technician"** — locate verified specialists near you\n` +
      `• **"Track my solar installation"** — status of ongoing projects (${activeProjects} active now)\n\n` +
      `**I can also guide you around this website:**\n` +
      `• *"What does this app do?"* — full feature walkthrough\n` +
      `• *"How do I log in?"* — demo accounts & credentials\n` +
      `• *"Where can I see quotations?"* — page-by-page navigation\n\n` +
      `Or ask any solar question — maintenance, net-metering, system sizes…!`,
  };
}

/** Rich detail for short follow-up messages, based on the running conversation topic. */
function topicFollowUp(topic: string): string | null {
  switch (topic) {
    case "savings":
      return `📈 **More on how your savings are computed:**\n\nThe engine derives everything from YOUR numbers: monthly bill ÷ your DISCOM tariff (₹7.5–₹8.5/unit) → needed units → required kW → annual generation (~1,450 kWh per kW in Hyderabad) × tariff = **gross annual saving**, minus inverter/panel degradation. Real projects (like the demo project PRJ-2026-0001) typically pay back the full investment in **3–4 years**, then 20+ years of nearly free electricity. Want the interactive calculator? Ask *"calculate my solar savings"*!`;
    case "pricing":
      return `💰 **Pricing detail:** each package has three cost layers — equipment (panels, inverter, structure, BOS), installation (labour, grid sync), and additions (lightning arrester, extended wiring). GST applies on the taxable value, and the PM Surya Ghar subsidy is subtracted from the total — so your **net payable ≈ total − subsidy**. Every quotation in this app (e.g. QT-2026-0001) shows that exact math transparently — open one in the Quotations page to see the live breakdown.`;
    case "subsidy":
      return `🏛️ **Subsidy detail:** the central subsidy is a **direct bank transfer** after DISCOM inspection — it does NOT pass through SunPower, so it can't be misused. Your documents (Aadhaar-linked, electricity bill copy, property proof) are filed on the National Portal during step 3 of installation. Bonus: some Telangana discom announcements add small state-level incentives — the survey captures your exact case.`;
    case "technicians":
      return `👷 **Technician network detail:** each of our technicians carries verified specializations (panel mounting, earthing/lightning protection, inverter commissioning, battery systems) mapped to service areas around Hyderabad. In this app they're visible on the **free OpenStreetMap locator** with distance sorting — open *"Nearby Service Persons"* and click **Use my location**. Guests can browse it too (world-readable profile data by design).`;
    case "installation":
      return `🚧 **Installation detail:** crews arrive with pre-reserved serial-numbered equipment (unique panel units scanned at dispatch — no mix-ups), complete a **25-point safety & quality checklist** with photos, and only after it's 100% complete AND customer-accepted can a project be marked complete in this app — the system blocks shortcuts, that's a hard business rule.`;
    case "warranty":
      return `🛡️ **Warranty detail:** each certificate is linked to the **exact serial numbers installed on your roof** — so a claim maps straight to the panel's production batch. Download A4 PDF certificates (with print support) from your Customer Portal. Claims create service tickets pre-filled with the serial — the technician sees your full unit history instantly.`;
    case "net_metering":
      return `🔁 **More net-metering detail:** the DISCOM replaces your one-direction meter with a **bi-directional meter** (govt-approved, small meter rent applies). Reading logic: exported units × PPA credit vs imported units × tariff — billed **net**. Surplus beyond the settlement cycle is compensated per DISCOM policy. In the app, quotation packages include *"bi-directional net meter support"*, and project completion requires the net-meter synchronization step to be closed.`;
    case "maintenance":
      return `🔧 **More maintenance detail:** expected generation loss from dust alone is 5–15% per month in Telangana summers — cleaning recovers nearly all of it. Best cadence: **every 2–4 weeks**, morning or evening only (never hot glass / never dry-scrub). Bird-droppings are the #1 hotspot cause. If you see inverter warnings, DON'T open it (600–1000V DC hazard) — ask me to book a technician and I'll create a real service ticket.`;
    case "sizing":
      return `🏡 **Sizing detail:** rule of thumb — 1 kW ≈ 120 units/month ≈ 100 sq.ft shadow-free roof. But the *right* answer depends on your daytime usage profile (higher self-consumption = better ROI on on-grid). That's exactly what the **site survey** captures: roof area, orientation/shading, appliance load — then the app auto-recommends capacity. Ask *"schedule a site survey"*!`;
    case "login":
      return `🔐 **Login detail:** after sign-in the app routes you by role — SuperAdmin/Staff → the operations dashboard with the full sidebar; Customer → their private portal. The Logout button (top-right) switches accounts cleanly (session event dispatch — no ghost sessions). Forgot to log out on a shared PC? Just log out — the demo session lives in that browser only.`;
    case "website":
      return `🧭 **Website detail:** the whole flow is *connected* — a survey record feeds the quotation builder (live math), an accepted quotation converts to a project (one project per quote, enforced), projects reserve inventory serials, warranty activates after inspection+acceptance, payments track the money trail, and Analytics recomputes everything live. All demo-state lives in your browser; **Settings → Reset demo data** rewinds it anytime.`;
    case "reports":
      return `📊 **Reports detail:** KPIs are computed from the live database on every load — no cached/hard-coded numbers. Charts cover the operations funnel, revenue, service load and inventory health; CSV/JSON exports come from the Settings page. In a production Supabase deployment, the same queries run on real Postgres with Row-Level Security.`;
    case "survey":
      return `📋 **Survey detail:** the engineer logs property type, roof type & area, shading analysis, reading the electricity bill, grid availability and recommended system type — the form enforces realistic data (installable area ≤ roof area). On submission, the recommended capacity feeds directly into the quotation with subsidy math pre-filled. Say *"schedule a site survey"* and I'll create one now!`;
    case "tracking":
    case "tracking_status":
      return `📍 **Tracking detail:** status stages are: ` + "`scheduled → equipment_reserved → equipment_dispatched → in_progress → inspection → completed`" + `. Each transition is timestamped; users see the current stage in the Customer Portal with equipment state and crew contact. Ask *"track my installation"* while logged in for your live project status.`;
    default:
      return null;
  }
}

/**
 * Execute real workflow: submit new customer enquiry.
 */
export async function executeSubmitEnquiry(input: {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  monthlyBill: number;
}): Promise<{ success: boolean; customerCode?: string; message: string }> {
  try {
    const customer = createCustomer({
      full_name: input.fullName,
      phone: input.phone,
      email: input.email || `${input.fullName.toLowerCase().replace(/\s+/g, ".")}@guest.solarops`,
      address: `${input.city}, Telangana`,
      city: input.city || "Hyderabad",
      state: "Telangana",
      postal_code: "500081",
      customer_type: "residential",
      monthly_units: Math.round(input.monthlyBill / 8),
      monthly_bill: input.monthlyBill,
      lead_source: "SolarBot AI Assistant",
      assigned_to: "Sales Executive — Alicia Dsouza",
      notes: "Enquiry submitted via SolarBot chat widget.",
      lead_status: "new",
    });

    return {
      success: true,
      customerCode: customer.code,
      message: `Enquiry registered successfully with code **${customer.code}**. Our solar engineering team will contact you within 24 business hours!`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Could not register enquiry. Please verify your phone number.",
    };
  }
}

/**
 * Execute real workflow: request a professional site survey.
 */
export async function executeRequestSurvey(input: {
  customerId: string;
  roofAreaSqm: number;
  monthlyBill: number;
}): Promise<{ success: boolean; surveyCode?: string; message: string }> {
  try {
    const today = new Date();
    today.setDate(today.getDate() + 2); // schedule 2 days out
    const surveyDate = today.toISOString().slice(0, 10);

    const survey = createSurvey({
      customer_id: input.customerId,
      survey_date: surveyDate,
      surveyor: "Kiran Babu (Surveyor)",
      property_type: "Independent house",
      roof_type: "RCC concrete",
      roof_area_sqm: input.roofAreaSqm || 90,
      installable_area_sqm: Math.round((input.roofAreaSqm || 90) * 0.75),
      shading: "Minimal shading",
      monthly_units: Math.round(input.monthlyBill / 8),
      monthly_bill: input.monthlyBill,
      required_capacity_kw: recommendCapacity(Math.round(input.monthlyBill / 8)),
      grid_available: true,
      recommended_system_type: "on_grid",
      constraints: "Requested via SolarBot AI Assistant",
      notes: "Customer scheduled survey via online chatbot.",
      status: "scheduled",
    });

    return {
      success: true,
      surveyCode: survey.code,
      message: `Site survey scheduled! Reference: **${survey.code}** for ${surveyDate}. Our surveyor will contact you prior to visiting.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Failed to schedule survey.",
    };
  }
}

/**
 * Execute real workflow: create service ticket.
 */
export async function executeCreateTicket(input: {
  customerId: string;
  issueCategory: string;
  description: string;
  preferredTechnician?: string;
}): Promise<{ success: boolean; ticketNumber?: string; message: string }> {
  try {
    const ticket = createTicket({
      customer_id: input.customerId,
      project_id: null,
      equipment_unit_id: null,
      serial_number: "GENERAL-ROOFTOP",
      issue_category: input.issueCategory,
      description: input.description,
      priority: "medium",
      assigned_technician: input.preferredTechnician || "Mahesh K.",
      created_by: "SolarBot Assistant",
    });

    return {
      success: true,
      ticketNumber: ticket.number,
      message: `Service ticket **${ticket.number}** created successfully. Technician **${ticket.assigned_technician}** has been assigned and will confirm the appointment.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Failed to create service ticket.",
    };
  }
}
