"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Download, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { istTodayStr, parseUTC } from "@/lib/constants";
import AppHeader from "@/components/AppHeader";
import AuthGuard from "@/components/AuthGuard";

const REQUIRED_SLOTS_MEDICINE = ["Patient Photo", "IPD Chart", "Drug Chart", "TPRB Chart"];

interface EnhancementItem {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patient: any;
  status: "dueNow" | "dueLaterToday" | "notToday" | "dischargePending";
  subLabel: string;
  totalEnhancements: number;
  lastText: string;
  dueText: string;
  nextDueMs: number;
  missingToday: string[];
}

export default function EnhancementPage() {
  const [items, setItems] = useState<EnhancementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openBackdate, setOpenBackdate] = useState<Record<string, boolean>>({});
  const [backdateVal, setBackdateVal] = useState<Record<string, string>>({});
  const [backdateMsg, setBackdateMsg] = useState<Record<string, string>>({});

  async function loadTracker() {
    setLoading(true);
    const { data: fetchedPatients, error: pErr } = await supabase
      .from("Patients")
      .select("*")
      .eq("is_discharged", false)
      .eq("patient_category", "Medicine");

    if (pErr || !fetchedPatients) {
      setLoading(false);
      return;
    }

    const todayStr = istTodayStr();
    const regDateByMrd: Record<string, string> = {};

    if (fetchedPatients.length > 0) {
      const { data: regPhotos } = await supabase
        .from("daily_photos")
        .select("mrd, photo_date")
        .eq("photo_type", "Registration Photos")
        .in(
          "mrd",
          fetchedPatients.map((p) => p.mrd)
        );
      (regPhotos || []).forEach((r) => {
        if (!r.photo_date) return;
        if (!regDateByMrd[r.mrd] || r.photo_date < regDateByMrd[r.mrd]) {
          regDateByMrd[r.mrd] = r.photo_date;
        }
      });
    }

    const patients = fetchedPatients.filter((p) => {
      const regDate = regDateByMrd[p.mrd];
      return !regDate || regDate < todayStr;
    });

    const activeMrds = patients.map((p) => p.mrd);
    if (activeMrds.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const [{ data: logs }, { data: dischargePhotos }, { data: todaysPhotos }] = await Promise.all([
      supabase
        .from("enhancement_log")
        .select("mrd, marked_at, marked_by")
        .in("mrd", activeMrds)
        .order("marked_at", { ascending: true }),
      supabase
        .from("daily_photos")
        .select("mrd, uploaded_at")
        .eq("photo_type", "Discharge Photo")
        .in("mrd", activeMrds),
      supabase
        .from("daily_photos")
        .select("mrd, photo_type")
        .in("mrd", activeMrds)
        .eq("photo_date", todayStr)
    ]);

    const dischargeMap: Record<string, string> = {};
    (dischargePhotos || []).forEach((dp) => {
      if (!dischargeMap[dp.mrd] || dp.uploaded_at > dischargeMap[dp.mrd]) {
        dischargeMap[dp.mrd] = dp.uploaded_at;
      }
    });

    const capturedTodayByMrd: Record<string, Set<string>> = {};
    (todaysPhotos || []).forEach((ph) => {
      if (!capturedTodayByMrd[ph.mrd]) capturedTodayByMrd[ph.mrd] = new Set();
      capturedTodayByMrd[ph.mrd].add(ph.photo_type);
    });

    const now = new Date();
    const istTime = (d: Date) =>
      d.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
    const istDateShort = (d: Date) =>
      d.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });

    const results: EnhancementItem[] = patients.map((p) => {
      const pLogs = (logs || []).filter((l) => l.mrd === p.mrd);
      const lastLog = pLogs.length > 0 ? pLogs[pLogs.length - 1] : null;
      const capturedToday = capturedTodayByMrd[p.mrd] || new Set<string>();
      const missingToday = REQUIRED_SLOTS_MEDICINE.filter((s) => !capturedToday.has(s));

      if (dischargeMap[p.mrd]) {
        const dt = parseUTC(dischargeMap[p.mrd]);
        return {
          patient: p,
          status: "dischargePending",
          subLabel: "Discharge photo captured",
          totalEnhancements: pLogs.length,
          lastText: `Discharge photo captured on ${dt.toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })}`,
          dueText: "Not needed",
          nextDueMs: Infinity,
          missingToday
        };
      }

      if (!lastLog) {
        return {
          patient: p,
          status: "dueNow",
          subLabel: "Never enhanced",
          totalEnhancements: 0,
          lastText: "Never enhanced",
          dueText: "Next due: Now (never enhanced before)",
          nextDueMs: -Infinity,
          missingToday
        };
      }

      const lastTime = parseUTC(lastLog.marked_at);
      const nextDue = new Date(lastTime.getTime() + 48 * 3600 * 1000);
      const lastText = `Last enhanced: ${lastTime.toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })} by ${lastLog.marked_by}`;
      const nextDueText = `${istTime(nextDue)}, ${istDateShort(nextDue)}`;

      if (nextDue <= now) {
        return {
          patient: p,
          status: "dueNow",
          subLabel: "Overdue",
          totalEnhancements: pLogs.length,
          lastText,
          dueText: `Next due: ${nextDueText} (overdue)`,
          nextDueMs: nextDue.getTime(),
          missingToday
        };
      }

      if (nextDue.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === todayStr) {
        return {
          patient: p,
          status: "dueLaterToday",
          subLabel: "Due Later Today",
          totalEnhancements: pLogs.length,
          lastText,
          dueText: `Next due: ${nextDueText}`,
          nextDueMs: nextDue.getTime(),
          missingToday
        };
      }

      return {
        patient: p,
        status: "notToday",
        subLabel: "Not due today",
        totalEnhancements: pLogs.length,
        lastText,
        dueText: `Next due: ${nextDueText}`,
        nextDueMs: nextDue.getTime(),
        missingToday
      };
    });

    setItems(results);
    setLoading(false);
  }

  useEffect(() => {
    loadTracker();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") loadTracker();
    }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  async function markEnhanced(mrd: string, email: string) {
    const { error } = await supabase.from("enhancement_log").insert([{ mrd, marked_by: email }]);
    if (error) {
      alert("Error: " + error.message);
      return;
    }
    loadTracker();
  }

  async function submitBackdate(mrd: string, email: string) {
    const val = backdateVal[mrd];
    if (!val) {
      setBackdateMsg({ ...backdateMsg, [mrd]: "Pick a date and time first." });
      return;
    }
    const chosen = new Date(val);
    if (isNaN(chosen.getTime()) || chosen.getTime() > Date.now()) {
      setBackdateMsg({ ...backdateMsg, [mrd]: "Pick a valid past date/time." });
      return;
    }
    const { error } = await supabase.from("enhancement_log").insert([
      { mrd, marked_by: `${email} (backdated)`, marked_at: chosen.toISOString() }
    ]);
    if (error) {
      setBackdateMsg({ ...backdateMsg, [mrd]: "Error: " + error.message });
      return;
    }
    setOpenBackdate({ ...openBackdate, [mrd]: false });
    loadTracker();
  }

  const dueNow = items.filter((r) => r.status === "dueNow").sort((a, b) => a.nextDueMs - b.nextDueMs);
  const dueLater = items.filter((r) => r.status === "dueLaterToday").sort((a, b) => a.nextDueMs - b.nextDueMs);
  const tucked = items
    .filter((r) => r.status === "notToday" || r.status === "dischargePending")
    .sort((a, b) => a.nextDueMs - b.nextDueMs);

  function downloadCsv() {
    if (dueNow.length === 0 && dueLater.length === 0) {
      alert("No patients due today.");
      return;
    }
    const byWard = (a: EnhancementItem, b: EnhancementItem) => {
      const w = (a.patient.ward || "").localeCompare(b.patient.ward || "");
      return w !== 0 ? w : (a.patient.name || "").localeCompare(b.patient.name || "");
    };
    const toRow = (r: EnhancementItem) =>
      [r.patient.ward || "", r.patient.bed_no || "", r.patient.mrd || "", r.patient.name || "", r.dueText]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(",");

    const lines = ["Ward,Bed,MRD,Name,Due"];
    lines.push(`"DUE NOW (${dueNow.length})",,,,`);
    [...dueNow].sort(byWard).forEach((r) => lines.push(toRow(r)));
    lines.push(`"DUE LATER TODAY (${dueLater.length})",,,,`);
    [...dueLater].sort(byWard).forEach((r) => lines.push(toRow(r)));

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `due-today-enhancement-medicine-${istTodayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderCard(r: EnhancementItem, email: string) {
    const p = r.patient;
    const border =
      r.status === "dueNow"
        ? "border-l-4 border-l-rose-600"
        : r.status === "dueLaterToday"
        ? "border-l-4 border-l-amber-500"
        : "border-l-4 border-l-emerald-600";

    return (
      <div key={p.mrd} className={`clinical-card p-4 ${border}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href={`/patient?mrd=${encodeURIComponent(p.mrd)}`} className="text-base font-bold text-teal-800 hover:underline">
            {p.name} <span className="font-mono text-xs font-normal text-slate-500">(MRD: {p.mrd})</span>
          </Link>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            {r.subLabel}
          </span>
        </div>

        <p className="mt-1 text-xs text-slate-600">Ward: {p.ward || "-"} | {p.patient_category || "-"}</p>
        <p className={`mt-1 text-xs font-semibold ${r.status === "dueNow" ? "text-rose-700" : r.status === "dueLaterToday" ? "text-amber-700" : "text-slate-600"}`}>
          {r.dueText}
        </p>

        <div className="mt-1.5 text-xs">
          {r.missingToday.length === 0 ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> All 4 slots captured today
            </span>
          ) : (
            <span className="font-semibold text-rose-700">Missing today: {r.missingToday.join(", ")}</span>
          )}
        </div>

        <p className="mt-1 text-xs text-slate-500">{r.lastText} &bull; Total marked: {r.totalEnhancements}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {r.status === "dueNow" ? (
            <button type="button" onClick={() => markEnhanced(p.mrd, email)} className="btn-teal py-1.5 text-xs">
              Mark Enhanced
            </button>
          ) : (
            <button type="button" disabled className="btn-outline py-1.5 text-xs opacity-50">
              {r.status === "dischargePending" ? "No longer needed" : "Not due yet"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpenBackdate({ ...openBackdate, [p.mrd]: !openBackdate[p.mrd] })}
            className="btn-outline py-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Add Missed Enhancement
          </button>
        </div>

        {openBackdate[p.mrd] && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="mb-1 block text-xs font-semibold text-slate-700">When was it actually done?</label>
            <input
              type="datetime-local"
              className="clinical-input mb-2"
              value={backdateVal[p.mrd] || ""}
              onChange={(e) => setBackdateVal({ ...backdateVal, [p.mrd]: e.target.value })}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => submitBackdate(p.mrd, email)} className="btn-teal py-1.5 text-xs">
                Save
              </button>
              <button
                type="button"
                onClick={() => setOpenBackdate({ ...openBackdate, [p.mrd]: false })}
                className="btn-outline py-1.5 text-xs"
              >
                Cancel
              </button>
            </div>
            {backdateMsg[p.mrd] && <p className="mt-1 text-xs text-rose-600">{backdateMsg[p.mrd]}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <AuthGuard>
      {({ email }) => (
        <div className="min-h-screen bg-[#F4F7F8]">
          <AppHeader
            title="Enhancement Tracker"
            subtitle="48-Hour Medicine Enhancement Schedule"
            backHref="/patients"
            backLabel="Patient List"
            userEmail={email}
          />

          <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
            <div className="clinical-card mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="text-sm font-medium text-slate-700">
                {loading
                  ? "Loading tracker..."
                  : `${dueNow.length} due now, ${dueLater.length} due later today, ${items.length} active medicine patients.`}
              </p>
              <button type="button" onClick={downloadCsv} className="btn-teal py-2 text-xs">
                <Download className="h-3.5 w-3.5" />
                Download Pending CSV
              </button>
            </div>

            {!loading && (
              <div className="space-y-6">
                <section>
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-rose-700">
                    <Clock className="h-4 w-4" /> Due Now ({dueNow.length})
                  </h2>
                  <div className="space-y-3">
                    {dueNow.length ? dueNow.map((r) => renderCard(r, email)) : <p className="text-xs text-slate-500">Nothing due right now.</p>}
                  </div>
                </section>

                <section>
                  <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-amber-700">
                    Due Later Today ({dueLater.length})
                  </h2>
                  <div className="space-y-3">
                    {dueLater.length ? dueLater.map((r) => renderCard(r, email)) : <p className="text-xs text-slate-500">Nothing else due today.</p>}
                  </div>
                </section>

                {tucked.length > 0 && (
                  <details className="clinical-card p-4">
                    <summary className="cursor-pointer text-sm font-bold text-slate-700">
                      Not needed today ({tucked.length})
                    </summary>
                    <div className="mt-3 space-y-3">{tucked.map((r) => renderCard(r, email))}</div>
                  </details>
                )}
              </div>
            )}
          </main>
        </div>
      )}
    </AuthGuard>
  );
}
