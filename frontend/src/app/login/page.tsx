"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Lock, Mail, AlertCircle, Loader2, UserCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Passw0rd!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login({ email, password });
      login(res.access_token, res.user);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("Passw0rd!");
    setLoading(true);
    setError(null);
    try {
      const res = await api.login({ email: demoEmail, password: "Passw0rd!" });
      login(res.access_token, res.user);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-500 mx-auto flex items-center justify-center font-black text-xl text-white shadow-lg shadow-brand-500/20">
          SH
        </div>
        <h1 className="text-2xl font-black text-white">Sign In to Sports Hub</h1>
        <p className="text-xs text-slate-400">Access your document vault, registered events, and court bookings.</p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-300 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Demo Quick Login Buttons */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5 text-brand-400" />
          <span>1-Click Demo Profiles (Pass: Passw0rd!)</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            onClick={() => handleQuickLogin("athlete@demo.com")}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-left border border-slate-700 transition"
          >
            <div className="font-bold text-white">Alex (Athlete)</div>
            <div className="text-[10px] text-slate-400">ID only (needs Medical)</div>
          </button>
          <button
            onClick={() => handleQuickLogin("athlete2@demo.com")}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-left border border-slate-700 transition"
          >
            <div className="font-bold text-white">Sarah (Athlete)</div>
            <div className="text-[10px] text-slate-400">All Docs Verified</div>
          </button>
          <button
            onClick={() => handleQuickLogin("organizer@demo.com")}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-left border border-slate-700 transition"
          >
            <div className="font-bold text-white">Marcus (Organizer)</div>
            <div className="text-[10px] text-slate-400">Scheduler & Verifier</div>
          </button>
          <button
            onClick={() => handleQuickLogin("referee@demo.com")}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-left border border-slate-700 transition"
          >
            <div className="font-bold text-white">David (Referee)</div>
            <div className="text-[10px] text-slate-400">Live Match Scorer</div>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Email</label>
          <div className="relative">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="athlete@demo.com"
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-medium focus:outline-none focus:border-brand-500"
            />
            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Password</label>
          <div className="relative">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-medium focus:outline-none focus:border-brand-500"
            />
            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 font-bold text-sm text-white shadow-lg shadow-brand-600/30 transition flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>Sign In</span>
        </button>

        <div className="text-center pt-2 text-slate-400">
          Don't have an account?{" "}
          <a href="/register" className="font-bold text-brand-400 hover:underline">
            Register athlete profile
          </a>
        </div>
      </form>
    </div>
  );
}

