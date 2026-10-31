"use client";

import React, { useState, useEffect } from "react";
import { api, Court, SlotAvailability, Booking } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PaymentModal } from "@/components/PaymentModal";
import {
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Loader2,
  ShieldAlert
} from "lucide-react";

export default function CourtBookingsPage() {
  const { user } = useAuth();
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState<string>("");
  const [targetDate, setTargetDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [slots, setSlots] = useState<SlotAvailability[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<"book" | "my_bookings">("book");

  // Booking action states
  const [bookingLoading, setBookingLoading] = useState(false);
  const [selectedSlotForPayment, setSelectedSlotForPayment] = useState<Booking | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    api.listCourts().then((data) => {
      setCourts(data);
      if (data.length > 0 && !selectedCourtId) {
        setSelectedCourtId(data[0].id);
      }
    }).catch(console.error);
  }, []);

  const fetchAvailability = async () => {
    if (!selectedCourtId || !targetDate) return;
    setLoadingSlots(true);
    setActionError(null);
    try {
      const avail = await api.getCourtAvailability(selectedCourtId, targetDate);
      setSlots(avail);
    } catch (err: any) {
      setActionError(err.message || "Failed to load availability");
    } finally {
      setLoadingSlots(false);
    }
  };

  const fetchMyBookings = async () => {
    if (!user) return;
    try {
      const data = await api.getMyBookings();
      setMyBookings(data);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAvailability();
  }, [selectedCourtId, targetDate]);

  useEffect(() => {
    if (activeTab === "my_bookings") {
      fetchMyBookings();
    }
  }, [activeTab, user]);

  const handleSlotClick = async (slot: SlotAvailability) => {
    if (!user) {
      alert("Please sign in to book a court slot.");
      return;
    }
    if (!slot.is_available) return;

    setBookingLoading(true);
    setActionError(null);
    try {
      const newBooking = await api.createBooking(selectedCourtId, slot.slot_start, slot.slot_end);
      setSelectedSlotForPayment(newBooking);
      setPaymentModalOpen(true);
    } catch (err: any) {
      setActionError(err.message || "Failed to reserve slot. Double booking or conflict detected.");
      fetchAvailability();
    } finally {
      setBookingLoading(false);
    }
  };

  const selectedCourt = courts.find((c) => c.id === selectedCourtId);

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-white">Court Bookings</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time hourly court reservation with Redis concurrency locking and instant payments.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab("book")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === "book" ? "bg-brand-600 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Book Court
          </button>
          <button
            onClick={() => setActiveTab("my_bookings")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === "my_bookings" ? "bg-brand-600 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            My Bookings {myBookings.length > 0 && `(${myBookings.length})`}
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-4 rounded-xl bg-red-950/70 border border-red-800 text-xs text-red-300 flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {activeTab === "book" ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Court selection list */}
          <div className="space-y-3 lg:col-span-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Select Venue / Court
            </label>
            <div className="space-y-2">
              {courts.map((court) => {
                const active = court.id === selectedCourtId;
                return (
                  <button
                    key={court.id}
                    onClick={() => setSelectedCourtId(court.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition ${
                      active
                        ? "bg-slate-900 border-brand-500 shadow-lg shadow-brand-500/10 ring-1 ring-brand-500"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] uppercase font-bold text-brand-400">{court.sport_name}</span>
                      <span className="text-xs font-black text-emerald-400">
                        ₹{(court.hourly_price / 100).toFixed(0)}/hr
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white mt-1">{court.name}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      <span className="truncate">{court.venue}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time slot grid */}
          <div className="lg:col-span-3 rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-base font-extrabold text-white">
                  {selectedCourt ? selectedCourt.name : "Choose a court"}
                </h3>
                <p className="text-xs text-slate-400">Select an hourly slot to reserve and proceed to payment.</p>
              </div>

              {/* Date Picker */}
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {loadingSlots ? (
              <div className="py-20 text-center">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin mx-auto" />
                <p className="text-xs text-slate-400 mt-2">Checking real-time slot locks...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {slots.map((s, idx) => {
                  const startTimeStr = new Date(s.slot_start).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  });
                  const endTimeStr = new Date(s.slot_end).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  });

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSlotClick(s)}
                      disabled={!s.is_available || bookingLoading}
                      className={`p-3.5 rounded-xl border text-center transition flex flex-col justify-between ${
                        s.is_available
                          ? "bg-slate-800/80 border-slate-700 hover:border-emerald-500 hover:bg-emerald-950/20 text-white cursor-pointer group"
                          : "bg-slate-900/40 border-slate-800/60 text-slate-600 cursor-not-allowed opacity-60"
                      }`}
                    >
                      <div className="text-xs font-bold text-white group-hover:text-emerald-400">
                        {startTimeStr} - {endTimeStr}
                      </div>
                      <div className="mt-2 text-[10px] font-semibold">
                        {s.is_available ? (
                          <span className="text-emerald-400 font-bold">Available</span>
                        ) : (
                          <span className="text-red-400/80">Booked</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* My Bookings Tab */
        <div className="space-y-4">
          {!user ? (
            <div className="text-center py-12 text-xs text-slate-400">Please sign in to view your bookings.</div>
          ) : myBookings.length === 0 ? (
            <div className="text-center py-16 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <CalendarIcon className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-white">No Bookings Yet</div>
              <p className="text-xs text-slate-400">Pick a court from the booking grid to reserve a slot.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myBookings.map((b) => {
                const startStr = new Date(b.slot_start).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <div key={b.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-brand-400">
                          {b.court?.sport_name || "Court"}
                        </span>
                        <h4 className="text-sm font-extrabold text-white">{b.court?.name || "Court Booking"}</h4>
                      </div>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          b.payment_status === "CONFIRMED"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {b.payment_status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{startStr}</span>
                    </div>

                    {b.payment_status === "PENDING" && (
                      <button
                        onClick={() => {
                          setSelectedSlotForPayment(b);
                          setPaymentModalOpen(true);
                        }}
                        className="w-full py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-bold text-white flex items-center justify-center gap-1.5"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Pay & Confirm Slot</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Payment Modal */}
      {selectedSlotForPayment && (
        <PaymentModal
          isOpen={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            fetchAvailability();
          }}
          purpose="BOOKING"
          refId={selectedSlotForPayment.id}
          title={`Booking at ${selectedCourt?.name || "Court"}`}
          amountPaise={selectedCourt?.hourly_price || 50000}
          onSuccess={() => {
            fetchAvailability();
            fetchMyBookings();
          }}
        />
      )}
    </div>
  );
}

