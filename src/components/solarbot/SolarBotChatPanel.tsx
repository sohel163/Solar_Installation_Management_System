import { useState, useRef, useEffect } from "react";
import {
  X, Minus, Trash2, Send, Bot, User, Sparkles, RefreshCw, AlertCircle, CheckCircle2, ChevronRight
} from "lucide-react";
import { useNavigate } from "react-router";
import type {
  ChatMessage,
  UserSessionInfo,
} from "@/services/solarBotService";
import {
  processSolarBotQuery,
  clearConversationHistory,
  getChatTranscript,
  saveChatTranscript,
  executeSubmitEnquiry,
  executeRequestSurvey,
  executeCreateTicket,
} from "@/services/solarBotService";
import {
  CalculatorCard,
  TechnicianListCard,
  ConfirmationCard,
  AuthRequiredCard,
} from "./SolarBotActionCards";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onMinimize: () => void;
  session: UserSessionInfo | null;
}

const INITIAL_WELCOME = `Hello! 👋 Welcome to SunPower.

I'm SolarBot, your personal solar assistant. ☀️

I can help you choose the right solar system, estimate your savings, understand pricing and subsidies, track your installation, and solve common solar problems.

What would you like to know today?`;

const SUGGESTED_QUESTIONS = [
  "Calculate my solar savings.",
  "Check installation prices.",
  "Learn about government subsidies.",
  "What does this app do?",
  "How do I log in to this website?",
  "What is net metering?",
  "Where can I see quotations?",
  "Find a nearby solar technician.",
];

/**
 * Minimal safe rich-text renderer for bot replies: **bold**, `code`,
 * and *italic* — no dangerouslySetInnerHTML, so no injection risk.
 */
function renderRich(text: string) {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g);
  return tokens.map((tok, i) => {
    if (tok.startsWith("**") && tok.endsWith("**")) {
      return <strong key={i} className="font-semibold text-white">{tok.slice(2, -2)}</strong>;
    }
    if (tok.startsWith("`") && tok.endsWith("`") && tok.length > 1) {
      return <code key={i} className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[10.5px] text-emerald-300">{tok.slice(1, -1)}</code>;
    }
    if (tok.startsWith("*") && tok.endsWith("*") && tok.length > 1 && !tok.startsWith("**")) {
      return <em key={i} className="opacity-90">{tok.slice(1, -1)}</em>;
    }
    return <span key={i}>{tok}</span>;
  });
}

export function SolarBotChatPanel({ isOpen, onClose, onMinimize, session }: Props) {
  const navigate = useNavigate();
  // Conversation survives close/minimize: state is restored from the service
  // module-level transcript instead of resetting to just the welcome message.
  const [messagesRaw, setMessagesRaw] = useState<ChatMessage[]>(() => {
    const t = getChatTranscript();
    if (t.length > 0) return t;
    return [
      {
        id: "initial-welcome",
        sender: "bot",
        text: INITIAL_WELCOME,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ];
  });
  // Every update is mirrored into the service transcript.
  const setMessages = (
    update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => {
    setMessagesRaw((prev) => {
      const next = typeof update === "function" ? update(prev) : update;
      saveChatTranscript(next);
      return next;
    });
  };
  const messages = messagesRaw;
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    type: "survey" | "enquiry" | "ticket";
    title: string;
    fields: { label: string; value: string }[];
    execute: () => Promise<void>;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Serializes bot responses in order; messages typed while the bot is
  // "typing" are queued instead of silently dropped.
  const processingRef = useRef<Promise<void>>(Promise.resolve());

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, pendingAction, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? inputText).trim();
    if (!text) return;

    setErrorNotice(null);
    setInputText("");

    // Append user message immediately — even while the bot is responding.
    const userMsg: ChatMessage = {
      id: "usr-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // Queue the bot's turn after any in-flight turns, preserving order.
    processingRef.current = processingRef.current.then(async () => {
      try {
        const botResponse = await processSolarBotQuery(text, session);
        setMessages((prev) => [...prev, botResponse]);
      } catch {
        setErrorNotice("Connection interrupted. Please click below to retry.");
      } finally {
        setIsTyping(false);
      }
    });
    await processingRef.current;
  };

  const handleClearChat = () => {
    if (window.confirm("Clear current conversation with SolarBot?")) {
      clearConversationHistory();
      setMessages([
        {
          id: "welcome-reset-" + Date.now(),
          sender: "bot",
          text: INITIAL_WELCOME,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setPendingAction(null);
      setErrorNotice(null);
    }
  };

  // Workflow Handlers
  const handleRequestSurveyFromCalc = (details: { bill: number; capacityKw: number; savings: number }) => {
    const custName = session?.isLoggedIn && session.name ? session.name : "Guest Visitor";
    const custId = session?.customerId || "cust-01"; // default to first demo customer if guest
    setPendingAction({
      type: "survey",
      title: "Schedule Free Rooftop Site Survey",
      fields: [
        { label: "Customer / Contact", value: custName },
        { label: "Monthly Bill", value: `₹${details.bill}` },
        { label: "System Size", value: `${details.capacityKw} kW System` },
        { label: "Est. Savings", value: `₹${details.savings.toLocaleString()}/year` },
      ],
      execute: async () => {
        const res = await executeRequestSurvey({
          customerId: custId,
          roofAreaSqm: 90,
          monthlyBill: details.bill,
        });
        setPendingAction(null);
        setMessages((prev) => [
          ...prev,
          {
            id: "bot-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
            sender: "bot",
            text: res.message,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      },
    });
  };

  const handleBookTechnician = (tech: any) => {
    const custId = session?.customerId || "cust-01";
    setPendingAction({
      type: "ticket",
      title: `Book Service Visit with ${tech.name}`,
      fields: [
        { label: "Assigned Engineer", value: tech.name },
        { label: "Specialization", value: tech.specializations[0] },
        { label: "Service Area", value: tech.location_name },
        { label: "Customer Account", value: session?.name || "Ramesh Gupta (Demo)" },
      ],
      execute: async () => {
        const res = await executeCreateTicket({
          customerId: custId,
          issueCategory: "Maintenance Inspection",
          description: `Customer booked routine maintenance with ${tech.name} via SolarBot.`,
          preferredTechnician: tech.name,
        });
        setPendingAction(null);
        setMessages((prev) => [
          ...prev,
          {
            id: "bot-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
            sender: "bot",
            text: res.message,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="SolarBot — Your Solar Assistant"
      className="fixed inset-x-2 bottom-4 sm:inset-x-auto sm:right-6 z-50 flex flex-col overflow-hidden rounded-2xl border border-emerald-500/35 bg-slate-950/95 text-slate-100 shadow-2xl backdrop-blur-2xl sm:w-[420px] h-[590px] max-h-[88vh] animate-in fade-in zoom-in-95 duration-200"
    >
      {/* 1. HEADER */}
      <div className="flex items-center justify-between border-b border-emerald-500/20 bg-gradient-to-r from-emerald-950/95 via-slate-950/95 to-slate-950/95 px-4 py-3">
        <div className="flex items-center gap-2.5">
          {/* Avatar Icon */}
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-md">
            <Bot className="h-5 w-5" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-white tracking-tight">SolarBot</h3>
              <span className="rounded bg-amber-400/20 px-1.5 py-0.2 text-[9.5px] font-bold text-amber-300">
                AI Assistant
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Online · Ready to assist
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleClearChat}
            title="Clear conversation"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMinimize}
            title="Minimize"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 2. CHAT MESSAGE STREAM */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scroll-smooth">
        {messages.map((m) => {
          const isUser = m.sender === "user";
          return (
            <div
              key={m.id}
              className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Message Avatar */}
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  isUser
                    ? "bg-brand-700 text-white"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                }`}
              >
                {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-4 w-4" />}
              </div>

              {/* Message Bubble */}
              <div className={`max-w-[85%] text-xs leading-relaxed ${isUser ? "items-end" : "items-start"}`}>
                <div
                  className={`rounded-2xl p-3.5 shadow-sm whitespace-pre-wrap ${
                    isUser
                      ? "rounded-tr-xs bg-emerald-700 text-white font-medium"
                      : "rounded-tl-xs bg-slate-900 border border-white/10 text-slate-200"
                  }`}
                >
                  {isUser ? m.text : renderRich(m.text)}

                  {/* Render Embedded Action Cards */}
                  {m.actionCard?.type === "calculator" && (
                    <CalculatorCard
                      defaultBill={m.actionCard.data?.defaultBill}
                      onRequestSurvey={handleRequestSurveyFromCalc}
                    />
                  )}

                  {m.actionCard?.type === "technician_list" && (
                    <TechnicianListCard
                      technicians={m.actionCard.data?.technicians || []}
                      onBookTechnician={handleBookTechnician}
                    />
                  )}

                  {m.actionCard?.type === "auth_required" && (
                    <AuthRequiredCard
                      reason={m.actionCard.data?.reason}
                      onNavigateLogin={() => {
                        onClose();
                        navigate("/login");
                      }}
                    />
                  )}
                </div>

                <div className={`mt-1 flex items-center gap-1.5 px-1 text-[10px] text-slate-500 ${isUser ? "justify-end" : "justify-start"}`}>
                  <span>{m.timestamp}</span>
                  {m.source === "live" && (
                    <span className="text-amber-400 font-mono">· Live AI</span>
                  )}
                  {m.source === "expert_rules" && (
                    <span>· Solar expert engine</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Pending Confirmation Card */}
        {pendingAction && (
          <ConfirmationCard
            title={pendingAction.title}
            fields={pendingAction.fields}
            onConfirm={pendingAction.execute}
            onCancel={() => setPendingAction(null)}
          />
        )}

        {/* Typing Animation */}
        {isTyping && (
          <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 border border-white/10">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        {/* Error / Retry Bar */}
        {errorNotice && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/60 p-3 text-xs text-rose-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-rose-400" /> {errorNotice}
            </span>
            <button
              type="button"
              onClick={() => handleSend("Tell me about SunPower packages and pricing")}
              className="flex items-center gap-1 rounded bg-rose-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-rose-500"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. SUGGESTED QUESTIONS (Shown if conversation has <= 2 messages) */}
      {messages.length <= 2 && !isTyping && (
        <div className="border-t border-white/10 bg-slate-950/70 p-2.5">
          <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider px-1 mb-1.5 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-amber-400" /> Suggested Questions
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {SUGGESTED_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(q)}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-900/90 hover:bg-emerald-950 hover:border-emerald-500/40 px-2.5 py-1 text-[11px] text-slate-300 hover:text-white transition cursor-pointer"
              >
                <span>{q}</span>
                <ChevronRight className="h-3 w-3 text-slate-500" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. FOOTER INPUT */}
      <div className="border-t border-white/10 bg-slate-950 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask SolarBot anything about solar…"
            className="flex-1 rounded-xl border border-white/15 bg-slate-900/90 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-1.5 text-center text-[10px] text-slate-500">
          SolarBot provides intelligent estimates. Formal quotations require a verified site survey.
        </p>
      </div>
    </div>
  );
}
