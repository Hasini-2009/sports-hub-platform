import "./globals.css";
import React from "react";
import { AuthProvider } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";

export const metadata = {
  title: "Sports Hub Platform | Super-App for Athletes, Coaches & Organizers",
  description: "Discover sports events, verified document vault, court booking, live scores, AI injury prevention and conflict-free scheduler.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col selection:bg-brand-500 selection:text-white">
        <AuthProvider>
          <Navbar />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
            <div className="max-w-7xl mx-auto px-4">
              Sports Hub Platform MVP • Built with FastAPI, Next.js 14, OR-Tools, ChromaDB & WebSockets.
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}

