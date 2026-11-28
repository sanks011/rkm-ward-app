"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  Loader2,
  Microscope,
  ShieldCheck
} from "lucide-react";
import { getStoredAuth, loginWithMongo } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";

export default function HomePage() {
  const [loadingSession, setLoadingSession] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const stored = getStoredAuth();
    setUserEmail(stored?.user.email || null);
    setLoadingSession(false);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    if (!email.trim() || !password) {
      setAuthError("Please enter both email and password.");
      return;
    }

    setAuthLoading(true);
    try {
      const user = await loginWithMongo(email.trim(), password);
      setUserEmail(user.email);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setAuthLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7F8]">
      <AppHeader
        title="RKMSP Clinical Suite"
        subtitle="Ramakrishna Mission Seva Pratishthan • Ayushman Bharat (PM-JAY)"
        userEmail={userEmail || undefined}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {loadingSession ? (
          <div className="flex justify-center py-20">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
              <Loader2 className="h-5 w-5 animate-spin text-teal-700" />
              <span className="text-sm font-medium text-slate-600">Loading workspace...</span>
            </div>
          </div>
        ) : !userEmail ? (
          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm border-t-4 border-t-teal-700">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Clinical Staff Login</h2>
              <p className="mt-1 text-xs text-slate-500">
                Sign in with your MongoDB hospital account to access ward rounds and patient charts
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700" htmlFor="email">
                  Staff Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  className="clinical-input"
                  placeholder="admin@rkmsp.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className="clinical-input"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {authError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {authError}
                </div>
              )}

              <button type="submit" disabled={authLoading} className="btn-teal w-full py-3">
                {authLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Clinical Modules
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Select a hospital module to manage inpatient rounds, digitalize clinical notes, or review patient records.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <Link
                href="/ward"
                className="group clinical-card flex flex-col justify-between p-6 border-t-4 border-t-teal-700 hover:border-teal-600 hover:shadow-md transition"
              >
                <div>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700 group-hover:bg-teal-700 group-hover:text-white transition">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">WARD MODULE</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    IPD daily progress notes, multilingual voice dictation, NICU/Adult clinical charting, and official signed PDF sheets.
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
                    Inpatient Wards
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 group-hover:translate-x-0.5 transition">
                    Open Module <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>

              <Link
                href="/patients"
                className="group clinical-card flex flex-col justify-between p-6 border-t-4 border-t-sky-700 hover:border-sky-600 hover:shadow-md transition"
              >
                <div>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-700 group-hover:bg-sky-700 group-hover:text-white transition">
                    <ClipboardCheck className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">PATIENT DATA MODULE</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Active census, MRD search, daily 4-slot records, geotagged photo PDFs, voice-digitalized IPD charts, and enhancement tracker.
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
                    Census &amp; Records
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 group-hover:translate-x-0.5 transition">
                    Open Module <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>

              <Link
                href="/diagnostic"
                className="group clinical-card flex flex-col justify-between p-6 border-t-4 border-t-slate-400 hover:border-slate-500 hover:shadow-md transition"
              >
                <div>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-slate-700 group-hover:text-white transition">
                    <Microscope className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">DIAGNOSTIC MODULE</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Pathology, microbiology cultures, and radiology investigation integration with ward progress notes.
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    Coming Soon
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 group-hover:translate-x-0.5 transition">
                    Preview <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        Ramakrishna Mission Seva Pratishthan (RKMSP) &bull; Clinical Suite
      </footer>
    </div>
  );
}
