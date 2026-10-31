"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, Event, EligibilityResult, Registration } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PaymentModal } from "@/components/PaymentModal";
import {
  Trophy,
  Calendar,
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldCheck,
  CreditCard,
  ArrowLeft,
  Loader2
} from "lucide-react";

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params.id as string;
  const router = useRouter();
  const { user } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadEventData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const ev = await api.getEvent(eventId);
      setEvent(ev);

      if (user) {
        try {
          const elig = await api.checkEligibility(eventId);
          setEligibility(elig);
        } catch (e) {
          // ignore eligibility if unauth
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load event.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      loadEventData();
    }
  }, [eventId, user]);

  const handleRegister = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const reg = await api.registerForEvent(eventId);
      setRegistration(reg);
      if (reg.status === "PENDING_PAYMENT") {
        setPaymentModalOpen(true);
      } else {
        alert("Registration Confirmed!");
        loadEventData();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Registration failed.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-xl font-bold">Event Not Found</h2>
        <a href="/" className="inline-flex items-center gap-2 text-brand-400 hover:underline text-sm font-semibold">
          <ArrowLeft className="w-4 h-4" /> Back to Discover
        </a>
      </div>
    );
  }

  const feeFormatted = event.entry_fee === 0 ? "Free Entry" : `₹${(event.entry_fee / 100).toFixed(0)}`;
  const dateFormatted = new Date(event.date_time).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <a href="/" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition">
        <ArrowLeft className="w-4 h-4" /> Back to Tournaments
      </a>

      {/* Main Event Header */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
              {event.sport_name}
            </span>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white mt-3">{event.title}</h1>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Entry Fee</span>
            <span className="text-2xl font-black text-emerald-400">{feeFormatted}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-800 text-xs text-slate-300">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-brand-400 shrink-0" />
            <span>{dateFormatted}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <MapPin className="w-4 h-4 text-brand-400 shrink-0" />
            <span>{event.venue}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-brand-400 shrink-0" />
            <span>Capacity: {event.registered_count || 0} / {event.capacity} Registered</span>
          </div>
        </div>
      </div>

      {/* Eligibility Checklist & Registration Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Eligibility Checklist */}
        <div className="md:col-span-2 rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-400" />
              <span>Eligibility Requirements</span>
            </h2>
            {eligibility && (
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  eligibility.eligible
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                }`}
              >
                {eligibility.eligible ? "Eligible to Register" : "Requirements Incomplete"}
              </span>
            )}
          </div>

          {!user ? (
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300 space-y-2">
              <p>Please log in with your athlete account to check your automated vault eligibility.</p>
              <a href="/login" className="inline-block font-bold text-brand-400 hover:underline">
                Sign in to check eligibility →
              </a>
            </div>
          ) : !eligibility ? (
            <div className="py-4 text-center text-xs text-slate-400">Loading eligibility checks...</div>
          ) : (
            <div className="space-y-3">
              {eligibility.checks.map((chk, i) => (
                <div
                  key={i}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 transition ${
                    chk.passed
                      ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-300"
                      : "bg-red-950/20 border-red-800/40 text-red-300"
                  }`}
                >
                  {chk.passed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="text-xs font-bold uppercase tracking-wider">{chk.requirement}</div>
                    <div className="text-xs opacity-90 mt-0.5">{chk.message}</div>
                    {!chk.passed && (chk.requirement === "ID" || chk.requirement === "MEDICAL" || chk.requirement === "WAIVER") && (
                      <a
                        href="/vault"
                        className="inline-block mt-2 text-[11px] font-bold text-brand-400 hover:text-brand-300 underline"
                      >
                        Upload to Document Vault →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Registration Card */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <h3 className="text-base font-bold text-white">Tournament Registration</h3>
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Tournament Fee:</span>
                <span className="font-bold text-white">{feeFormatted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Slots:</span>
                <span className="font-bold text-white">{event.registered_count || 0}/{event.capacity}</span>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          <div>
            {registration && registration.status === "PENDING_PAYMENT" ? (
              <button
                onClick={() => setPaymentModalOpen(true)}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-sm text-white shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                <span>Complete Payment Now</span>
              </button>
            ) : registration && registration.status === "CONFIRMED" ? (
              <div className="w-full py-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-center font-bold text-sm text-emerald-400 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>You are Registered!</span>
              </div>
            ) : (
              <button
                onClick={handleRegister}
                disabled={actionLoading || (eligibility && !eligibility.eligible)}
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${
                  eligibility && !eligibility.eligible
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                    : "bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/30"
                }`}
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {eligibility && !eligibility.eligible ? "Requirements Not Met" : "Register Now"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {registration && (
        <PaymentModal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          purpose="REGISTRATION"
          refId={registration.id}
          title={`Entry Fee for ${event.title}`}
          amountPaise={event.entry_fee}
          onSuccess={() => {
            loadEventData();
          }}
        />
      )}
    </div>
  );
}

