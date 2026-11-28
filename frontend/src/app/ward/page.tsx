"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BedDouble, FileText, Mic, Printer, Search, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { WARDS } from "@/lib/constants";
import AppHeader from "@/components/AppHeader";
import AuthGuard from "@/components/AuthGuard";

interface WardPatient {
  mrd: string;
  name: string;
  ward: string | null;
  bed_no: string | null;
  doctor_unit: string | null;
}

const inWard = (p: WardPatient, w: string) =>
  (p.ward || "")
    .split(",")
    .map((x) => x.trim())
    .includes(w);

export default function WardPage() {
  const [patients, setPatients] = useState<WardPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [wardQuery, setWardQuery] = useState("");
  const [ptQuery, setPtQuery] = useState("");
  const [selectedWard, setSelectedWard] = useState<string>("");

  useEffect(() => {
    const saved = sessionStorage.getItem("rkmWard");
    if (saved) setSelectedWard(saved);

    supabase
      .from("Patients")
      .select("mrd,name,ward,bed_no,doctor_unit")
      .eq("is_discharged", false)
      .order("name", { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setPatients((data as WardPatient[]) || []);
        setLoading(false);
      });
  }, []);

  const allWards = useMemo(() => {
    const extra = new Set<string>();
    patients.forEach((p) =>
      (p.ward || "").split(",").forEach((x) => {
        const trimmed = x.trim();
        if (trimmed && !WARDS.includes(trimmed)) extra.add(trimmed);
      })
    );
    return WARDS.concat(Array.from(extra));
  }, [patients]);

  const filteredWards = useMemo(() => {
    const q = wardQuery.trim().toLowerCase();
    return allWards.filter((w) => !q || w.toLowerCase().includes(q));
  }, [allWards, wardQuery]);

  const wardPatients = useMemo(() => {
    if (!selectedWard) return [];
    const q = ptQuery.trim().toLowerCase();
    return patients.filter(
      (p) =>
        inWard(p, selectedWard) &&
        (!q || [p.name, p.mrd, p.bed_no].join(" ").toLowerCase().includes(q))
    );
  }, [patients, selectedWard, ptQuery]);

  function openWard(w: string) {
    setSelectedWard(w);
    setPtQuery("");
    sessionStorage.setItem("rkmWard", w);
  }

  function backToWards() {
    setSelectedWard("");
    sessionStorage.removeItem("rkmWard");
  }

  return (
    <AuthGuard>
      {({ email }) => (
        <div className="min-h-screen bg-[#F4F7F8]">
          <AppHeader
            title="Ward Module"
            subtitle="Inpatient Rounds & Bedside Clinical Charting"
            backHref="/"
            backLabel="Dashboard"
            userEmail={email}
            rightSlot={
              <Link
                href="/ward-list"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Ward Census Print</span>
              </Link>
            }
          />

          <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            {!selectedWard ? (
              <div>
                <div className="mb-5">
                  <h2 className="text-xl font-bold text-slate-900">Hospital Wards</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Select a ward to view admitted patients and start voice round charting (NICU/PICU or Adult IPD format).
                  </p>
                </div>

                <div className="relative mb-6">
                  <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="search"
                    className="clinical-input pl-10"
                    placeholder="Search ward name (e.g. NICU 1, ICU, PICU, CCU)..."
                    value={wardQuery}
                    onChange={(e) => setWardQuery(e.target.value)}
                  />
                </div>

                {loading ? (
                  <p className="text-sm text-slate-500">Loading wards...</p>
                ) : error ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    Error: {error}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4">
                    {filteredWards.map((w) => {
                      const count = patients.filter((p) => inWard(p, w)).length;
                      return (
                        <button
                          key={w}
                          type="button"
                          onClick={() => openWard(w)}
                          className="clinical-card flex flex-col items-center justify-center p-5 border-t-4 border-t-teal-700 hover:border-teal-600 hover:shadow-md transition text-center"
                        >
                          <span className="text-base font-bold text-slate-900">{w}</span>
                          <span
                            className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              count > 0
                                ? "bg-teal-50 text-teal-800"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <Users className="h-3 w-3" />
                            {count} {count === 1 ? "patient" : "patients"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={backToWards}
                  className="btn-outline mb-4 py-2 text-xs"
                >
                  <ArrowLeft className="h-4 w-4" />
                  All Hospital Wards
                </button>

                <div className="clinical-card mb-5 flex flex-wrap items-center justify-between gap-3 p-5 border-l-4 border-l-teal-700">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Ward: {selectedWard}</h2>
                    <p className="text-xs text-slate-500">
                      Click &ldquo;Voice Round Note&rdquo; to dictate daily assessment or open the patient chart.
                    </p>
                  </div>
                  <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
                    {wardPatients.length} admitted
                  </span>
                </div>

                <div className="relative mb-5">
                  <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="search"
                    className="clinical-input pl-10"
                    placeholder="Search patient name, MRD, or bed..."
                    value={ptQuery}
                    onChange={(e) => setPtQuery(e.target.value)}
                  />
                </div>

                {wardPatients.length === 0 ? (
                  <div className="clinical-card p-8 text-center text-sm text-slate-500">
                    No admitted patients found in this ward.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {wardPatients.map((p) => (
                      <div
                        key={p.mrd}
                        className="clinical-card flex flex-wrap items-center justify-between gap-4 p-4 hover:border-teal-600 transition"
                      >
                        <div>
                          <h3 className="text-base font-bold text-slate-900">{p.name}</h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-medium">
                              <BedDouble className="h-3.5 w-3.5 text-slate-500" />
                              Bed {p.bed_no || "-"}
                            </span>
                            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono font-medium">
                              MRD {p.mrd}
                            </span>
                            {p.doctor_unit && (
                              <span className="rounded bg-slate-100 px-2 py-0.5 font-medium">
                                Unit {p.doctor_unit}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/clinical-notes?mrd=${encodeURIComponent(p.mrd)}`}
                            className="btn-teal py-2 text-xs"
                          >
                            <Mic className="h-3.5 w-3.5" />
                            Voice Round Note
                          </Link>
                          <Link
                            href={`/patient?mrd=${encodeURIComponent(p.mrd)}`}
                            className="btn-outline py-2 text-xs"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Patient Chart
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      )}
    </AuthGuard>
  );
}
