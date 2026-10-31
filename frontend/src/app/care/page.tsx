"use client";

import React, { useState, useEffect, useRef } from "react";
import { API_BASE, api } from "@/lib/api";
import {
  Bot,
  Send,
  Sparkles,
  ShieldAlert,
  BookOpen,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RotateCcw
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

export default function InjuryCarePage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I am your Sports Hub Clinical Assistant. Ask me about acute injury management (PEACE & LOVE), warm-up protocols, return-to-play progressions, or prevention drills.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sport, setSport] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [health, setHealth] = useState<{ status: string; ollama_reachable: boolean; chromadb_reachable: boolean; model: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getInjuryHealth().then(setHealth).catch(console.error);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streaming]);

  const quickPrompts = [
    "What is the PEACE & LOVE protocol for acute injuries?",
    "How to manage an acute lateral ankle sprain?",
    "What are the emergency red flags for concussion?",
    "Warm-up routine for badminton and court sports",
    "How to rehabilitate a hamstring strain?",
  ];

  const handleSend = async (userQuestion?: string) => {
    const q = userQuestion || input;
    if (!q.trim() || streaming) return;

    const newMessages: Message[] = [...messages, { role: "user", content: q }];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Placeholder for assistant stream
    const assistantIndex = newMessages.length;
    setMessages((prev) => [...prev, { role: "assistant", content: "", sources: [] }]);

    try {
      const response = await fetch(`${API_BASE}/api/v1/injury/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          sport: sport || undefined,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to receive stream from injury service");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulatedText = "";
      let finalSources: string[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        const lines = chunkText.split("\n").filter((l) => l.trim().length > 0);

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.token) {
              accumulatedText += parsed.token;
              setMessages((prev) => {
                const copy = [...prev];
                copy[assistantIndex] = {
                  role: "assistant",
                  content: accumulatedText,
                  sources: finalSources,
                };
                return copy;
              });
            }
            if (parsed.done && parsed.sources) {
              finalSources = parsed.sources;
              setMessages((prev) => {
                const copy = [...prev];
                copy[assistantIndex] = {
                  role: "assistant",
                  content: accumulatedText,
                  sources: finalSources,
                };
                return copy;
              });
            }
          } catch {
            // non-json line ignore
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[assistantIndex] = {
          role: "assistant",
          content: `Error: ${err.message || "Failed to reach assistant."}`,
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in flex flex-col h-[calc(100vh-140px)]">
      {/* Header with Health Badge */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Injury AI Assistant & RAG Care</span>
              <Sparkles className="w-4 h-4 text-brand-400" />
            </h1>
            <p className="text-xs text-slate-400">Persistent ChromaDB sports medicine clinical retrieval.</p>
          </div>
        </div>

        {health && (
          <div className="flex items-center gap-2 text-[11px] font-semibold bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700">
            <span
              className={`w-2 h-2 rounded-full ${
                health.ollama_reachable ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              }`}
            />
            <span className="text-slate-300">
              {health.ollama_reachable ? `Ollama (${health.model})` : "RAG Direct Retrieval"}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-400">ChromaDB OK</span>
          </div>
        )}
      </div>

      {/* Medical Safety Banner */}
      <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <span>
          Safety Mandate: This tool provides sports science evidence and protocols. It does not provide medical diagnosis.
          Seek immediate emergency care for loss of consciousness, severe deformity, or chest pain.
        </span>
      </div>

      {/* Chat Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto rounded-2xl bg-slate-900/60 border border-slate-800 p-4 sm:p-6 space-y-4">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-brand-600 text-white shadow-md rounded-br-none"
                  : "bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-none shadow-md"
              }`}
            >
              <div className="whitespace-pre-wrap">{m.content}</div>

              {m.sources && m.sources.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-700/60 text-[10px] text-slate-400 space-y-1">
                  <div className="font-bold uppercase tracking-wider text-brand-300 flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    <span>Evidence Sources Retrieved:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {m.sources.map((src) => (
                      <span key={src} className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700">
                        {src}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {streaming && (
          <div className="flex justify-start">
            <div className="p-3 rounded-2xl bg-slate-800 border border-slate-700 text-xs text-brand-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-400 animate-ping" />
              <span>Formulating clinical advice...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
        {quickPrompts.map((qp, i) => (
          <button
            key={i}
            onClick={() => handleSend(qp)}
            disabled={streaming}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white hover:border-slate-500 whitespace-nowrap transition disabled:opacity-50"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={sport}
          onChange={(e) => setSport(e.target.value)}
          placeholder="Sport (e.g. Football)"
          className="w-36 px-3 py-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
        />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Describe symptom or question (e.g. rolled ankle, knee pop, tennis elbow)..."
          className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
        />
        <button
          onClick={() => handleSend()}
          disabled={streaming || !input.trim()}
          className="px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 font-bold text-white shadow-lg shadow-brand-600/30 transition flex items-center justify-center disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

