"use client";

import React, { useState, useEffect } from "react";
import Link from "next/navigation";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { api, Notification } from "@/lib/api";
import {
  Trophy,
  ShieldCheck,
  Calendar,
  Activity,
  Bot,
  Settings,
  Bell,
  Menu,
  X,
  User as UserIcon,
  LogOut,
  ChevronDown
} from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const { user, logout, quickSwitch } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [switchDropdown, setSwitchDropdown] = useState(false);

  useEffect(() => {
    if (user) {
      api.getMyNotifications().then((notifs) => {
        const unread = notifs.filter((n) => !n.read).length;
        setUnreadCount(unread);
      }).catch(() => {});
    } else {
      setUnreadCount(0);
    }
  }, [user, pathname]);

  const navLinks = [
    { href: "/", label: "Events", icon: Trophy },
    { href: "/vault", label: "Vault", icon: ShieldCheck },
    { href: "/bookings", label: "Courts", icon: Calendar },
    { href: "/live", label: "Live Scores", icon: Activity },
    { href: "/care", label: "Injury AI", icon: Bot },
    ...(user?.role === "organizer" || user?.role === "referee" ? [{ href: "/organizer", label: "Organizer Hub", icon: Settings }] : []),
  ];

  const demoAccounts = [
    { label: "Alex (Athlete - ID verified)", email: "athlete@demo.com", role: "Athlete" },
    { label: "Sarah (Athlete - All docs)", email: "athlete2@demo.com", role: "Athlete" },
    { label: "Marcus (Organizer)", email: "organizer@demo.com", role: "Organizer" },
    { label: "David (Referee)", email: "referee@demo.com", role: "Referee" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800 text-white backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-500 flex items-center justify-center font-black text-xl tracking-wider text-white shadow-lg shadow-brand-500/20">
                SH
              </div>
              <div>
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-brand-400 bg-clip-text text-transparent">
                  Sports Hub
                </span>
                <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  MVP
                </span>
              </div>
            </a>
          </div>

          {/* Desktop Nav Items */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-brand-600 text-white shadow-sm"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </a>
              );
            })}
          </div>

          {/* Right items (Notifications, Demo Switcher, User) */}
          <div className="hidden md:flex items-center gap-3">
            {/* Quick Demo Switcher */}
            <div className="relative">
              <button
                onClick={() => setSwitchDropdown(!switchDropdown)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition"
              >
                <span>Demo As: {user ? user.role : "Guest"}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {switchDropdown && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-800 border border-slate-700 shadow-xl py-1 z-50">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                    Switch Test Account
                  </div>
                  {demoAccounts.map((acc) => (
                    <button
                      key={acc.email}
                      onClick={async () => {
                        await quickSwitch(acc.email);
                        setSwitchDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex flex-col hover:bg-slate-700/70 transition ${
                        user?.email === acc.email ? "bg-brand-900/40 text-brand-300" : "text-slate-200"
                      }`}
                    >
                      <span className="font-semibold">{acc.label}</span>
                      <span className="text-[10px] text-slate-400">{acc.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notification Bell */}
            {user && (
              <a
                href="/notifications"
                className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </a>
            )}

            {/* User Profile / Auth Button */}
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-700">
                <div className="text-right">
                  <div className="text-xs font-semibold text-white leading-tight">{user.name}</div>
                  <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                    {user.role}
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <a
                  href="/login"
                  className="px-3 py-1.5 text-sm font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
                >
                  Login
                </a>
                <a
                  href="/register"
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-500 transition shadow-sm"
                >
                  Register
                </a>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            {user && (
              <a href="/notifications" className="relative p-2 text-slate-300">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </a>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900 px-4 pt-3 pb-6 space-y-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  isActive ? "bg-brand-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{link.label}</span>
              </a>
            );
          })}

          <div className="pt-4 border-t border-slate-800">
            <div className="text-xs font-bold uppercase text-slate-400 mb-2">Switch Demo Account</div>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  onClick={async () => {
                    await quickSwitch(acc.email);
                    setMobileMenuOpen(false);
                  }}
                  className={`text-left p-2 rounded-lg text-xs border ${
                    user?.email === acc.email
                      ? "border-brand-500 bg-brand-950/50 text-brand-300 font-bold"
                      : "border-slate-700 bg-slate-800 text-slate-300"
                  }`}
                >
                  <div>{acc.label.split("(")[0]}</div>
                  <div className="text-[10px] text-slate-400">{acc.role}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            {user ? (
              <div className="flex items-center justify-between w-full">
                <div>
                  <div className="text-sm font-bold text-white">{user.name}</div>
                  <div className="text-xs text-emerald-400 font-semibold uppercase">{user.role}</div>
                </div>
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600/20 text-red-400 hover:bg-red-600/30"
                >
                  <LogOut className="w-3.5 h-3.5" /> Logout
                </button>
              </div>
            ) : (
              <div className="flex gap-2 w-full">
                <a
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center py-2 rounded-lg text-sm font-medium bg-slate-800 text-white"
                >
                  Login
                </a>
                <a
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center py-2 rounded-lg text-sm font-medium bg-brand-600 text-white"
                >
                  Register
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

