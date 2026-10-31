"use client";

import React, { useState } from "react";
import { api, PaymentIntent } from "@/lib/api";
import { CreditCard, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  purpose: "BOOKING" | "REGISTRATION";
  refId: string;
  title: string;
  amountPaise: number;
  onSuccess: () => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  purpose,
  refId,
  title,
  amountPaise,
  onSuccess,
}: PaymentModalProps) {
  const [gateway, setGateway] = useState<"mock" | "stripe" | "razorpay" | "phonepe">("mock");
  const [loading, setLoading] = useState(false);
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  if (!isOpen) return null;

  const amountRupees = (amountPaise / 100).toFixed(2);

  const handleCreateIntent = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.createPaymentIntent(purpose, refId, gateway);
      setIntent(res);
    } catch (err: any) {
      setError(err.message || "Could not initialize payment.");
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateMockPayment = async () => {
    if (!intent) return;
    setLoading(true);
    setError(null);
    try {
      await api.completeMockPayment(intent.payment_id);
      setPaymentSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Mock payment simulation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Secure Checkout</h3>
            <p className="text-xs text-slate-400">{title}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-800/60 flex items-center gap-2.5 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {paymentSuccess ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h4 className="text-xl font-bold text-white">Payment Confirmed!</h4>
            <p className="text-xs text-slate-400">Your registration/booking has been locked and confirmed.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 flex justify-between items-center">
              <div>
                <span className="text-xs text-slate-400 block">Total Due</span>
                <span className="text-xs font-semibold uppercase text-brand-400">{purpose}</span>
              </div>
              <div className="text-2xl font-black text-white">
                ₹{amountRupees}
              </div>
            </div>

            {!intent ? (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                  Select Payment Gateway
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "mock", label: "Mock Demo", badge: "Instant" },
                    { id: "stripe", label: "Stripe", badge: "Cards" },
                    { id: "razorpay", label: "Razorpay", badge: "UPI/Net" },
                  ].map((gw) => (
                    <button
                      key={gw.id}
                      onClick={() => setGateway(gw.id as any)}
                      className={`p-3 rounded-xl border text-center transition ${
                        gateway === gw.id
                          ? "border-brand-500 bg-brand-950/40 text-brand-300 ring-2 ring-brand-500/30"
                          : "border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="text-xs font-bold text-white">{gw.label}</div>
                      <div className="text-[10px] text-slate-400">{gw.badge}</div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleCreateIntent}
                  disabled={loading}
                  className="w-full mt-2 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 font-bold text-sm text-white shadow-lg shadow-brand-600/30 transition flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Proceed to Payment</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 text-xs space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Order Ref:</span>
                    <span className="font-mono text-white">{intent.order_id}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Gateway:</span>
                    <span className="uppercase font-semibold text-brand-400">{intent.gateway}</span>
                  </div>
                </div>

                {gateway === "mock" ? (
                  <button
                    onClick={handleSimulateMockPayment}
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-sm text-white shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>Simulate Successful Payment</span>
                  </button>
                ) : (
                  <a
                    href={intent.checkout_url_or_token || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-center font-bold text-sm text-white shadow-lg shadow-brand-600/30 transition"
                  >
                    Open Gateway Checkout
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

