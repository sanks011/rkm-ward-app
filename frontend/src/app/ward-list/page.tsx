"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { istTodayStr } from "@/lib/constants";
import AppHeader from "@/components/AppHeader";
import AuthGuard from "@/components/AuthGuard";

interface PatientRow {
  mrd: string;
  name: string;
  pmjay_id: string | null;
  ward: string | null;
  bed_no: string | null;
  patient_category: string | null;
  los_days: number | null;
  los_start_date: string | null;
  admission_date: string | null;
}

export default function WardListPage() {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatedAt, setGeneratedAt] = useState("");

  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }));
    supabase
      .from("Patients")
      .select("*")
      .eq("is_discharged", false)
      .order("ward", { ascending: true })
      .order("name", { ascending: true })
      .then(({ data }) => {
        setPatients((data as PatientRow[]) || []);
        setLoading(false);
      });
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, PatientRow[]> = {};
    patients.forEach((p) => {
      const w = p.ward || "Unassigned";
      if (!map[w]) map[w] = [];
      map[w].push(p);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [patients]);

  function losBadge(p: PatientRow) {
    if (!p.los_days || p.patient_category === "Medicine" || !p.admission_date) return "-";
    const today = istTodayStr();
    const losStart = p.los_start_date || p.admission_date;
    const dayNo = Math.round((new Date(today).getTime() - new Date(losStart).getTime()) / 86400000) + 1;
    const left = p.los_days - dayNo;
    if (left < 0) return <span className="font-bold text-rose-600">Exceeded +{Math.abs(left)}</span>;
    if (left === 0) return <span className="font-bold text-amber-700">Ends today</span>;
    return `Day ${dayNo}/${p.los_days}`;
  }

  return (
    <AuthGuard>
      {({ email }) => (
        <div className="min-h-screen bg-[#F4F7F8]">
          <AppHeader
            title="Ward-wise Patient List"
            subtitle="Printable Active Census"
            backHref="/ward"
            backLabel="Ward Module"
            userEmail={email}
            rightSlot={
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print / Save PDF</span>
              </button>
            }
          />

          <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
            <p className="mb-4 text-xs font-medium text-slate-500">Generated: {generatedAt}</p>

            {loading ? (
              <p className="text-sm text-slate-500">Loading census...</p>
            ) : grouped.length === 0 ? (
              <div className="clinical-card p-6 text-sm text-slate-500">No active patients.</div>
            ) : (
              <div className="space-y-4">
                {grouped.map(([ward, rows]) => (
                  <section
                    key={ward}
                    className="clinical-card overflow-hidden p-4 break-inside-avoid print:shadow-none print:border-slate-300"
                  >
                    <h2 className="mb-3 border-b border-slate-200 pb-2 text-base font-bold text-teal-800">
                      Ward: {ward} ({rows.length} {rows.length === 1 ? "patient" : "patients"})
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="py-2 pr-3 font-semibold">Name</th>
                            <th className="py-2 pr-3 font-semibold">MRD</th>
                            <th className="py-2 pr-3 font-semibold">PMJAY ID</th>
                            <th className="py-2 pr-3 font-semibold">Bed</th>
                            <th className="py-2 pr-3 font-semibold">Category</th>
                            <th className="py-2 font-semibold">LOS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((p) => (
                            <tr key={p.mrd} className="border-b border-slate-100 last:border-0">
                              <td className="py-2 pr-3 font-medium text-slate-900">{p.name}</td>
                              <td className="py-2 pr-3 font-mono">{p.mrd}</td>
                              <td className="py-2 pr-3">{p.pmjay_id || "-"}</td>
                              <td className="py-2 pr-3">{p.bed_no || "-"}</td>
                              <td className="py-2 pr-3">{p.patient_category || "-"}</td>
                              <td className="py-2">{losBadge(p)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            )}
          </main>
        </div>
      )}
    </AuthGuard>
  );
}
