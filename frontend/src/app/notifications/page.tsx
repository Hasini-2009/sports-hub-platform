"use client";

import React, { useState, useEffect } from "react";
import { api, Notification } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Bell,
  CheckCircle2,
  Calendar,
  Clock,
  ShieldCheck,
  CreditCard,
  Radio,
  Loader2
} from "lucide-react";

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api.getMyNotifications();
      setNotifications(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, [user]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err: any) {
      console.error(err);
    }
  };

  const getIconForKind = (kind: string) => {
    switch (kind) {
      case "BOOKING_CONFIRMED":
        return <Calendar className="w-5 h-5 text-emerald-400" />;
      case "REGISTRATION_CONFIRMED":
        return <CheckCircle2 className="w-5 h-5 text-brand-400" />;
      case "MATCH_SCHEDULE_UPDATED":
        return <Clock className="w-5 h-5 text-purple-400" />;
      case "MATCH_REMINDER":
        return <Radio className="w-5 h-5 text-amber-400" />;
      default:
        return <Bell className="w-5 h-5 text-slate-400" />;
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <Bell className="w-12 h-12 text-slate-500 mx-auto" />
        <h2 className="text-xl font-bold">Notifications</h2>
        <p className="text-xs text-slate-400">Please sign in to view your tournament and match alerts.</p>
        <a href="/login" className="inline-block px-6 py-2.5 rounded-xl bg-brand-600 font-bold text-xs text-white">
          Sign In
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-brand-400" />
            <span>Activity & Push Notifications</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            FCM / APNs mock and live dispatch stream for confirmations, reminders, and schedules.
          </p>
        </div>
        <button
          onClick={fetchNotifs}
          className="text-xs font-semibold text-brand-400 hover:underline"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin mx-auto" />
          <p className="text-xs text-slate-400 mt-2">Loading alerts...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <Bell className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="text-sm font-bold text-white">No Notifications</div>
          <p className="text-xs text-slate-400">Your registration and court confirmations will arrive here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const timeAgo = new Date(n.sent_at).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <div
                key={n.id}
                className={`p-4 rounded-2xl border transition flex items-start gap-3.5 ${
                  n.read
                    ? "bg-slate-900/40 border-slate-800/60 opacity-80"
                    : "bg-slate-900 border-slate-700/80 shadow-md shadow-brand-500/5 ring-1 ring-brand-500/20"
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  {getIconForKind(n.kind)}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="text-sm font-bold text-white leading-snug">{n.title}</h3>
                    <span className="text-[10px] text-slate-400 shrink-0 font-medium">{timeAgo}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{n.body}</p>
                </div>

                {!n.read && (
                  <button
                    onClick={() => handleMarkAsRead(n.id)}
                    className="text-[10px] font-bold text-brand-400 hover:text-brand-300 hover:underline shrink-0 self-center px-2 py-1"
                  >
                    Mark read
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

