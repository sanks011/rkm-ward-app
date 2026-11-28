"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface AuthGuardProps {
  children: (session: { userId: string; email: string }) => React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [sessionInfo, setSessionInfo] = useState<{ userId: string; email: string } | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    let timer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await supabase.auth.signOut();
        alert("You were logged out due to 30 minutes of inactivity.");
        router.push("/");
      }, 30 * 60 * 1000);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/");
        return;
      }
      setSessionInfo({
        userId: data.session.user.id,
        email: data.session.user.email || ""
      });
      setChecking(false);
      resetTimer();
    });

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
