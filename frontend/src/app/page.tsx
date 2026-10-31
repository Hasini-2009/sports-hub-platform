"use client";

import React, { useState, useEffect } from "react";
import { api, Event } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Trophy,
  Calendar,
  MapPin,
  Users,
  CheckCircle2,
  Filter,
  Search,
  Sparkles,
  ArrowRight,
  ShieldAlert
} from "lucide-react";

export default function EventsDiscoveryPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sports = ["All", "Badminton", "Football", "Tennis", "Basketball"];

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listEvents({
        sport: selectedSport === "All" || !selectedSport ? undefined : selectedSport,
        search: searchQuery || undefined,
        eligible_only: eligibleOnly,
      });
      setEvents(data);
    } catch (err: any) {
      setError(err.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [selectedSport, eligibleOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEvents();
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-slate-900 via-brand-950/60 to-slate-900 border border-slate-800 p-8 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-bold tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            <span>INSTANT ELIGIBILITY & 1-CLICK REGISTRATION</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Discover Sports Events & Compete
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Verify your Document Vault once, unlock eligible tournaments automatically, book match courts, and follow live game scores.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Sports Pill Filters */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {sports.map((sp) => {
              const active = (sp === "All" && !selectedSport) || selectedSport === sp;
              return (
                <button
                  key={sp}
                  onClick={() => setSelectedSport(sp === "All" ? "" : sp)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    active
                      ? "bg-brand-600 text-white shadow-md shadow-brand-600/30"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  {sp}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-72">
            <input
              type="text"
              placeholder="Search events, venues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 transition"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </form>
        </div>

        {/* Eligible For Me Toggle */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300">
              Only show events I am eligible for
            </span>
            {!user && (
              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                Requires login
              </span>
            )}
          </div>
          <button
            onClick={() => {
              if (!user) {
                alert("Please log in to use the eligibility filter.");
                return;
              }
              setEligibleOnly(!eligibleOnly);
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              eligibleOnly ? "bg-emerald-600" : "bg-slate-700"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                eligibleOnly ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Events Grid */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-sm text-red-300 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-slate-900/40 border border-slate-800/60 space-y-3">
          <Trophy className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Tournaments Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {eligibleOnly
              ? "You do not currently satisfy the requirements for any events with this filter. Check your Document Vault to verify required credentials."
              : "Try choosing another sport or clear your search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((ev) => {
            const feeText = ev.entry_fee === 0 ? "Free Entry" : `₹${(ev.entry_fee / 100).toFixed(0)}`;
            const dateStr = new Date(ev.date_time).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            const slotsLeft = Math.max(0, ev.capacity - (ev.registered_count || 0));

            return (
              <a
                key={ev.id}
                href={`/events/${ev.id}`}
                className="group relative rounded-2xl bg-slate-900 border border-slate-800 hover:border-brand-500/60 transition-all duration-200 overflow-hidden flex flex-col p-6 shadow-lg hover:shadow-brand-500/10 hover:-translate-y-1"
              >
                {/* Header row */}
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
                    {ev.sport_name}
                  </span>
                  <span className="text-sm font-extrabold text-emerald-400">
                    {feeText}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-lg font-bold text-white group-hover:text-brand-300 transition mb-3 leading-snug">
                  {ev.title}
                </h3>

                {/* Meta details */}
                <div className="space-y-2 text-xs text-slate-400 flex-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>{dateStr}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span className="truncate">{ev.venue}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span>{slotsLeft} of {ev.capacity} slots available</span>
                  </div>
                </div>

                {/* Requirements Badges */}
                {ev.mandatory_requirements && ev.mandatory_requirements.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-800/80">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Requirements
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ev.mandatory_requirements.map((req) => (
                        <span
                          key={req}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700"
                        >
                          {req}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action CTA */}
                <div className="mt-4 pt-3 flex items-center justify-between text-xs font-bold text-brand-400 group-hover:text-brand-300">
                  <span>View & Register</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition" />
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

