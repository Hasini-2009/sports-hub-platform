"use client";

import React, { useState, useEffect } from "react";
import { api, Event, TimetableResponse, Document as VaultDoc } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Settings,
  Calendar,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Plus,
  Loader2,
  AlertCircle,
  Trophy
} from "lucide-react";

export default function OrganizerHubPage() {
  const { user, quickSwitch } = useAuth();
  const [tab, setTab] = useState<"scheduler" | "verifications" | "create_event">("scheduler");

  // Events list
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  // Scheduler Form State
  const [teamsText, setTeamsText] = useState("Alpha\nBravo\nCharlie\nDelta\nEcho\nFoxtrot");
  const [courtsCount, setCourtsCount] = useState<number>(3);
  const [matchDuration, setMatchDuration] = useState<number>(45);
  const [minRestSlots, setMinRestSlots] = useState<number>(1);
  const [formatType, setFormatType] = useState<"round_robin" | "single_elimination">("round_robin");
  const [timetable, setTimetable] = useState<TimetableResponse | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [schedulerError, setSchedulerError] = useState<string | null>(null);
  const [commitSuccess, setCommitSuccess] = useState(false);

  // Verification Queue
  const [pendingDocs, setPendingDocs] = useState<VaultDoc[]>([]);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // Create Event Form State
  const [newTitle, setNewTitle] = useState("");
  const [newSport, setNewSport] = useState("Badminton");
  const [newVenue, setNewVenue] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newFee, setNewFee] = useState(500);
  const [newCapacity, setNewCapacity] = useState(32);
  const [reqAge, setReqAge] = useState(true);
  const [reqMedical, setReqMedical] = useState(true);
  const [reqID, setReqID] = useState(true);
  const [reqWaiver, setReqWaiver] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);

  const fetchEvents = async () => {
    try {
      const data = await api.listEvents();
      setEvents(data);
      if (data.length > 0 && !selectedEventId) {
        setSelectedEventId(data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPendingDocs = async () => {
    if (user?.role === "organizer") {
      try {
        const data = await api.getPendingVerifications();
        setPendingDocs(data);
      } catch (e) {
        console.error(e);
      }
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchPendingDocs();
  }, [user]);

  const handleGenerateSchedule = async () => {
    const teams = teamsText
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (teams.length < 2) {
      setSchedulerError("Please supply at least 2 teams.");
      return;
    }

    setScheduling(true);
    setSchedulerError(null);
    setCommitSuccess(false);

    try {
      const res = await api.generateSchedule({
        teams,
        courts_count: Number(courtsCount),
        match_duration_mins: Number(matchDuration),
        start_time: new Date().toISOString(),
        min_rest_slots: Number(minRestSlots),
        format: formatType,
      });
      setTimetable(res);
    } catch (err: any) {
      setSchedulerError(err.message || "Schedule generation failed (infeasible constraints).");
    } finally {
      setScheduling(false);
    }
  };

  const handleCommitSchedule = async () => {
    if (!selectedEventId || !timetable) return;
    const teams = teamsText
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    setCommitting(true);
    setSchedulerError(null);
    try {
      await api.commitSchedule(selectedEventId, {
        teams,
        courts_count: Number(courtsCount),
        match_duration_mins: Number(matchDuration),
        start_time: new Date().toISOString(),
        min_rest_slots: Number(minRestSlots),
        format: formatType,
      });
      setCommitSuccess(true);
    } catch (err: any) {
      setSchedulerError(err.message || "Failed to commit matches.");
    } finally {
      setCommitting(false);
    }
  };

  const handleVerifyDoc = async (docId: string) => {
    setVerifyingId(docId);
    try {
      await api.verifyDocument(docId);
      setPendingDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch (err: any) {
      alert(err.message || "Verification failed");
    } finally {
      setVerifyingId(null);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingEvent(true);
    try {
      const reqs: string[] = [];
      if (reqAge) reqs.push("MIN_AGE:18");
      if (reqMedical) reqs.push("MEDICAL");
      if (reqID) reqs.push("ID");
      if (reqWaiver) reqs.push("WAIVER");

      await api.createEvent({
        title: newTitle,
        sport_name: newSport,
        venue: newVenue,
        date_time: new Date(newDate || Date.now()).toISOString(),
        entry_fee: Number(newFee) * 100,
        capacity: Number(newCapacity),
        mandatory_requirements: reqs,
      });

      alert("Tournament created successfully!");
      setNewTitle("");
      setNewVenue("");
      fetchEvents();
      setTab("scheduler");
    } catch (err: any) {
      alert(err.message || "Failed to create event.");
    } finally {
      setCreatingEvent(false);
    }
  };

  if (user?.role !== "organizer" && user?.role !== "referee") {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <Settings className="w-12 h-12 text-slate-500 mx-auto" />
        <h2 className="text-xl font-bold">Organizer Hub Access Required</h2>
        <p className="text-xs text-slate-400">
          This portal is reserved for event organizers and tournament directors.
        </p>
        <button
          onClick={() => quickSwitch("organizer@demo.com")}
          className="px-6 py-2.5 rounded-xl bg-brand-600 font-bold text-xs text-white shadow-lg hover:bg-brand-500 transition"
        >
          Switch to Marcus (Organizer Demo)
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 text-xs font-bold mb-2">
            <Settings className="w-3.5 h-3.5" />
            <span>ORGANIZER COMMAND CENTER</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Tournament Director & AI Scheduler</h1>
        </div>

        {/* Tab pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setTab("scheduler")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              tab === "scheduler" ? "bg-brand-600 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            AI Scheduler
          </button>
          <button
            onClick={() => setTab("verifications")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              tab === "verifications" ? "bg-brand-600 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Doc Verifications ({pendingDocs.length})
          </button>
          <button
            onClick={() => setTab("create_event")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              tab === "create_event" ? "bg-brand-600 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Create Tournament
          </button>
        </div>
      </div>

      {/* TAB 1: AI SCHEDULER */}
      {tab === "scheduler" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Scheduler Parameters Form */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-400" />
              <span>OR-Tools CP-SAT Engine</span>
            </h2>

            {schedulerError && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{schedulerError}</span>
              </div>
            )}

            {commitSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Matches committed and broadcast to participants!</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Target Tournament</label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({ev.sport_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Participating Teams (one per line)
                </label>
                <textarea
                  rows={6}
                  value={teamsText}
                  onChange={(e) => setTeamsText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Courts Count</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={courtsCount}
                    onChange={(e) => setCourtsCount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Min Rest Slots</label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={minRestSlots}
                    onChange={(e) => setMinRestSlots(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Match Duration (m)</label>
                  <input
                    type="number"
                    min={15}
                    step={15}
                    value={matchDuration}
                    onChange={(e) => setMatchDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Format</label>
                  <select
                    value={formatType}
                    onChange={(e) => setFormatType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  >
                    <option value="round_robin">Round Robin</option>
                    <option value="single_elimination">Single Knockout</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleGenerateSchedule}
                disabled={scheduling}
                className="w-full mt-2 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 font-bold text-white shadow-lg shadow-brand-600/30 transition flex items-center justify-center gap-2"
              >
                {scheduling && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{scheduling ? "Optimizing CP-SAT Matrix..." : "Generate Conflict-Free Schedule"}</span>
              </button>
            </div>
          </div>

          {/* Timetable Preview & Commit */}
          <div className="lg:col-span-2 rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-white">Timetable Schedule Preview</h3>
                {timetable && (
                  <p className="text-xs text-slate-400">
                    Total Makespan: {timetable.makespan_minutes} mins • {timetable.total_slots} Slots • {timetable.matches.length} Matches
                  </p>
                )}
              </div>

              {timetable && (
                <button
                  onClick={handleCommitSchedule}
                  disabled={committing}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition"
                >
                  {committing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Commit Matches</span>
                </button>
              )}
            </div>

            {!timetable ? (
              <div className="py-20 text-center text-xs text-slate-500 space-y-2">
                <Sparkles className="w-10 h-10 text-slate-700 mx-auto" />
                <p>Configure team count and courts to generate mathematical timetable.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3">Slot</th>
                      <th className="py-2.5 px-3">Court</th>
                      <th className="py-2.5 px-3">Matchup</th>
                      <th className="py-2.5 px-3">Start Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {timetable.matches.map((m, i) => {
                      const startStr = new Date(m.start_time).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      return (
                        <tr key={i} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-mono text-brand-400">Slot #{m.slot_index + 1}</td>
                          <td className="py-2.5 px-3 text-slate-300">Court {m.court_number}</td>
                          <td className="py-2.5 px-3 font-bold text-white">
                            {m.team_a} <span className="text-slate-500 font-normal">vs</span> {m.team_b}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">{startStr}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DOCUMENT VERIFICATIONS */}
      {tab === "verifications" && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-400" />
              <span>Pending Athlete Document Verifications</span>
            </h2>
            <button
              onClick={fetchPendingDocs}
              className="text-xs font-semibold text-brand-400 hover:underline"
            >
              Refresh Queue
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Rule: Uploaded files are private to athlete owners. Verification approves athlete eligibility across tournament gates.
          </p>

          {pendingDocs.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500/40 mx-auto" />
              <div className="text-sm font-bold text-white">All Clear!</div>
              <p>No athlete documents currently awaiting verification.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-white text-sm">{doc.doc_type}</span>
                      <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-bold">
                        Pending
                      </span>
                    </div>
                    <div className="text-slate-400">
                      User ID: <span className="font-mono text-slate-300">{doc.user_id.slice(0, 12)}...</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Uploaded {new Date(doc.uploaded_at).toLocaleString()}
                    </div>
                  </div>

                  <button
                    onClick={() => handleVerifyDoc(doc.id)}
                    disabled={verifyingId === doc.id}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5"
                  >
                    {verifyingId === doc.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Verify & Grant Clearance</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CREATE TOURNAMENT */}
      {tab === "create_event" && (
        <div className="max-w-2xl mx-auto rounded-2xl bg-slate-900 border border-slate-800 p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-brand-400" />
              <span>Create New Tournament Event</span>
            </h2>
            <p className="text-xs text-slate-400">Define sport, venue, entry fee and mandatory document requirements.</p>
          </div>

          <form onSubmit={handleCreateEvent} className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Tournament Title</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. National Open Championship 2026"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Sport</label>
                <select
                  value={newSport}
                  onChange={(e) => setNewSport(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
                >
                  <option value="Badminton">Badminton</option>
                  <option value="Football">Football</option>
                  <option value="Tennis">Tennis</option>
                  <option value="Basketball">Basketball</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Venue Name</label>
                <input
                  type="text"
                  required
                  value={newVenue}
                  onChange={(e) => setNewVenue(e.target.value)}
                  placeholder="e.g. Metro Sports Complex"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Entry Fee (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={newFee}
                  onChange={(e) => setNewFee(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Max Capacity</label>
                <input
                  type="number"
                  min={2}
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-2">
                Mandatory Eligibility Requirements
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reqAge}
                    onChange={(e) => setReqAge(e.target.checked)}
                    className="rounded text-brand-500"
                  />
                  <span>Minimum Age 18 (MIN_AGE:18)</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reqMedical}
                    onChange={(e) => setReqMedical(e.target.checked)}
                    className="rounded text-brand-500"
                  />
                  <span>Medical Certificate (MEDICAL)</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reqID}
                    onChange={(e) => setReqID(e.target.checked)}
                    className="rounded text-brand-500"
                  />
                  <span>Government ID (ID)</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reqWaiver}
                    onChange={(e) => setReqWaiver(e.target.checked)}
                    className="rounded text-brand-500"
                  />
                  <span>Liability Waiver (WAIVER)</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={creatingEvent}
              className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 font-bold text-sm text-white shadow-lg shadow-brand-600/30 transition flex items-center justify-center gap-2"
            >
              {creatingEvent && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Publish Tournament</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

