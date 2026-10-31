"use client";

import React, { useState, useEffect } from "react";
import { API_BASE, api, Match } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Activity,
  Radio,
  Plus,
  Minus,
  CheckCircle2,
  Trophy,
  Loader2,
  ShieldCheck
} from "lucide-react";

export default function LiveScoresPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "LIVE" | "FINISHED">("ALL");

  const canEdit = user?.role === "referee" || user?.role === "organizer";

  // Load initial matches
  useEffect(() => {
    api
      .getLiveMatches()
      .then((data) => setMatches(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // WebSocket Connection
  useEffect(() => {
    const wsUrl = API_BASE.replace(/^http/, "ws") + "/ws/live";
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWS = () => {
      try {
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          setConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event === "SCORE_UPDATE" && data.match) {
              const updatedMatch: Match = data.match;
              setMatches((prev) => {
                const idx = prev.findIndex((m) => m.id === updatedMatch.id);
                if (idx !== -1) {
                  const copy = [...prev];
                  copy[idx] = updatedMatch;
                  return copy;
                }
                return [updatedMatch, ...prev];
              });
            }
          } catch {
            // ignore non-json
          }
        };

        socket.onclose = () => {
          setConnected(false);
          reconnectTimeout = setTimeout(connectWS, 3000);
        };

        socket.onerror = () => {
          setConnected(false);
          socket?.close();
        };
      } catch {
        setConnected(false);
      }
    };

    connectWS();

    return () => {
      clearTimeout(reconnectTimeout);
      socket?.close();
    };
  }, []);

  const handleScoreChange = async (match: Match, deltaA: number, deltaB: number, newStatus?: string) => {
    const scoreA = Math.max(0, match.score_a + deltaA);
    const scoreB = Math.max(0, match.score_b + deltaB);
    const status = newStatus || (match.status === "SCHEDULED" ? "LIVE" : match.status);

    try {
      await api.updateMatchScore(match.id, scoreA, scoreB, status);
      // Optimistic local update
      setMatches((prev) =>
        prev.map((m) => (m.id === match.id ? { ...m, score_a: scoreA, score_b: scoreB, status: status as any } : m))
      );
    } catch (err: any) {
      alert(err.message || "Failed to update score.");
    }
  };

  const filteredMatches = matches.filter((m) => {
    if (filter === "ALL") return true;
    return m.status === filter;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header with live status */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8 shadow-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-2">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>REAL-TIME WEBSOCKET FEED</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Live Match Scoreboard</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time court match scoring updates pushed via FastAPI native WebSockets.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border ${
              connected
                ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/80"
                : "bg-amber-950/40 text-amber-400 border-amber-800/80"
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}
            />
            <span>{connected ? "Connected to Live Feed" : "Connecting..."}</span>
          </div>

          {canEdit && (
            <span className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Referee Controls Active
            </span>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        {(["ALL", "LIVE", "FINISHED"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              filter === tab
                ? "bg-brand-600 text-white shadow-md shadow-brand-600/30"
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            {tab === "ALL" ? "All Matches" : tab === "LIVE" ? "Live Now" : "Completed"}
          </button>
        ))}
      </div>

      {/* Matches Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin mx-auto" />
          <p className="text-xs text-slate-400 mt-2">Loading match feed...</p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <Activity className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="text-sm font-bold text-white">No Matches Found</div>
          <p className="text-xs text-slate-400">Scheduled tournament games will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredMatches.map((match) => {
            const isLive = match.status === "LIVE";
            const isFinished = match.status === "FINISHED";

            return (
              <div
                key={match.id}
                className={`rounded-2xl border p-6 space-y-4 shadow-xl transition-all duration-200 ${
                  isLive
                    ? "bg-slate-900/90 border-brand-500 shadow-brand-500/10 ring-1 ring-brand-500/50"
                    : "bg-slate-900 border-slate-800"
                }`}
              >
                {/* Status bar */}
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-400">Court {match.court_number}</span>
                  <span
                    className={`font-black text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      isLive
                        ? "bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse"
                        : isFinished
                        ? "bg-slate-800 text-slate-400 border border-slate-700"
                        : "bg-brand-500/20 text-brand-400 border border-brand-500/30"
                    }`}
                  >
                    {match.status}
                  </span>
                </div>

                {/* Scoreboard display */}
                <div className="flex items-center justify-between py-4 px-6 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  {/* Team A */}
                  <div className="text-left flex-1">
                    <h3 className="text-base font-extrabold text-white leading-tight">{match.team_a}</h3>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Team A</span>
                  </div>

                  {/* Scores */}
                  <div className="px-6 flex items-center gap-3 text-3xl font-black tracking-tight text-white">
                    <span className={match.score_a > match.score_b ? "text-emerald-400" : "text-white"}>
                      {match.score_a}
                    </span>
                    <span className="text-slate-600 text-xl font-light">:</span>
                    <span className={match.score_b > match.score_a ? "text-emerald-400" : "text-white"}>
                      {match.score_b}
                    </span>
                  </div>

                  {/* Team B */}
                  <div className="text-right flex-1">
                    <h3 className="text-base font-extrabold text-white leading-tight">{match.team_b}</h3>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Team B</span>
                  </div>
                </div>

                {/* Referee Scoring Controls */}
                {canEdit && (
                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                      Referee Score Controls
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      {/* Team A controls */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleScoreChange(match, -1, 0)}
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleScoreChange(match, 1, 0)}
                          className="px-2.5 py-1.5 rounded-lg bg-brand-600 text-white font-bold text-xs hover:bg-brand-500 flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Pt (A)</span>
                        </button>
                      </div>

                      {/* Status Toggle */}
                      <button
                        onClick={() =>
                          handleScoreChange(
                            match,
                            0,
                            0,
                            match.status === "FINISHED" ? "LIVE" : "FINISHED"
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold"
                      >
                        {match.status === "FINISHED" ? "Reopen Match" : "Finish Match"}
                      </button>

                      {/* Team B controls */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleScoreChange(match, 0, 1)}
                          className="px-2.5 py-1.5 rounded-lg bg-brand-600 text-white font-bold text-xs hover:bg-brand-500 flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Pt (B)</span>
                        </button>
                        <button
                          onClick={() => handleScoreChange(match, 0, -1)}
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

