"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getStoredAuth, logoutAuth } from "@/lib/auth";

export interface GuardSession {
  userId: string;
  email: string;
  isAdmin: boolean;
  fullName: string;
}

interface AuthGuardProps {
  children: (session: GuardSession) => React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [sessionInfo, setSessionInfo] = useState<GuardSession | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    let timer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await logoutAuth();
        alert("You were logged out due to 30 minutes of inactivity.");
        router.push("/");
      }, 30 * 60 * 1000);
    };

    async function verifySession() {
      const mongoAuth = getStoredAuth();
      if (mongoAuth) {
        setSessionInfo({
          userId: mongoAuth.user.id,
          email: mongoAuth.user.email,
          isAdmin: !!mongoAuth.user.is_admin,
          fullName: mongoAuth.user.fullName || mongoAuth.user.email
        });
        setChecking(false);
        resetTimer();
        return;
      }

      // Fallback check for any active Supabase session
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setSessionInfo({
          userId: data.session.user.id,
          email: data.session.user.email || "",
          isAdmin: false,
          fullName: data.session.user.email || ""
        });
        setChecking(false);
        resetTimer();
        return;
      }

      router.replace("/");
    }

    verifySession();

    const events = ["mousemove", "keydown", "touchstart", "click", "scroll"];
    events.forEach((evt) => document.addEventListener(evt, resetTimer));

    return () => {
      clearTimeout(timer);
      events.forEach((evt) => document.removeEventListener(evt, resetTimer));
    };
  }, [router]);

  if (checking || !sessionInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F7F8]">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-teal-700" />
          <span className="text-sm font-medium text-slate-700">Verifying clinical session...</span>
        </div>
      </div>
    );
  }

  return <>{children(sessionInfo)}</>;
}
