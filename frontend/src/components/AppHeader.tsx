"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, LogOut, UserCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  userEmail?: string;
  rightSlot?: React.ReactNode;
}

export default function AppHeader({
  title,
  subtitle = "Ramakrishna Mission Seva Pratishthan",
  backHref,
  backLabel = "Dashboard",
  userEmail,
  rightSlot
}: AppHeaderProps) {
  const router = useRouter();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallPrompt(null);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="no-print sticky top-0 z-40 border-b border-teal-900/15 bg-teal-800 text-white shadow-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{backLabel}</span>
            </Link>
          ) : (
            <img
              src="/icons/icon-180.png"
              alt="RKMSP Logo"
              className="h-10 w-10 rounded-lg bg-white p-0.5 object-contain shadow-sm"
            />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">{title}</h1>
            <p className="truncate text-xs text-teal-100/90">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {rightSlot}
          {installPrompt && (
            <button
              type="button"
              onClick={handleInstall}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300/40 bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600 transition"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Install App</span>
            </button>
          )}
          {userEmail && (
            <>
              <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-teal-50">
                <UserCheck className="h-3.5 w-3.5" />
                {userEmail}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Logout</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
