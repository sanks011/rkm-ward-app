"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Filter,
  ListChecks,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiSyncPatientToMongo } from "@/lib/api";
import {
  DOCTOR_UNIT_GROUPS,
  doctorUnitLabel,
  istTodayStr,
  OT_DAILY_SLOTS,
  parseUTC,
  PROCEDURE_SLOTS,
  REQUIRED_SLOTS,
  WARDS
} from "@/lib/constants";
import AppHeader from "@/components/AppHeader";
import AuthGuard from "@/components/AuthGuard";

interface Patient {
  mrd: string;
  name: string;
  pmjay_id: string | null;
  ward: string | null;
  bed_no: string | null;
  doctor_unit: string | null;
  admission_date: string | null;
  patient_category: string | null;
  los_days: number | null;
  los_start_date: string | null;
  is_discharged: boolean;
}

interface PhotoSummary {
  mrd: string;
  photo_type: string;
  photo_date: string;
  uploaded_at: string;
}

interface DeletedRecord {
  id: number;
  mrd: string;
  patient_name: string;
  deleted_at: string;
  deleted_by: string | null;
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [photos, setPhotos] = useState<PhotoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedWards, setSelectedWards] = useState<string[]>([]);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [openSpecialties, setOpenSpecialties] = useState<Record<string, boolean>>({});

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMrd, setNewMrd] = useState("");
  const [newPmjay, setNewPmjay] = useState("");
  const [newName, setNewName] = useState("");
  const [newWard, setNewWard] = useState("");
  const [newBed, setNewBed] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newAdmitDate, setNewAdmitDate] = useState("");
  const [newCat, setNewCat] = useState("Medicine");
  const [newLos, setNewLos] = useState("");
  const [addMsg, setAddMsg] = useState("");

  // Modals
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const [deletedList, setDeletedList] = useState<DeletedRecord[]>([]);
  const [deletedLoading, setDeletedLoading] = useState(false);

  async function loadData(userId?: string, sessionAdmin?: boolean) {
    setLoading(true);
    if (sessionAdmin) {
      setIsAdmin(true);
    } else if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(userId)) {
      const { data: roleRow } = await supabase
        .from("staff_roles")
        .select("is_admin")
        .eq("user_id", userId)
        .maybeSingle();
      setIsAdmin(!!roleRow?.is_admin);
    }

    const { data, error } = await supabase
      .from("Patients")
      .select("*")
      .order("name", { ascending: true });

    if (!error && data) {
      const sorted = (data as Patient[]).slice().sort((a, b) => {
        const ad = a.is_discharged ? 1 : 0;
        const bd = b.is_discharged ? 1 : 0;
        if (ad !== bd) return ad - bd;
        return (a.name || "").localeCompare(b.name || "");
      });
      setPatients(sorted);

      const activeMrds = sorted.filter((p) => !p.is_discharged).map((p) => p.mrd);
      if (activeMrds.length > 0) {
        const { data: phData } = await supabase
          .from("daily_photos")
          .select("mrd, photo_type, photo_date, uploaded_at")
          .in("mrd", activeMrds);
        setPhotos((phData as PhotoSummary[]) || []);
      } else {
        setPhotos([]);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("rkm_filter_state");
      if (raw) {
        const st = JSON.parse(raw);
        setSearch(st.search || "");
        setSelectedWards(st.wards || []);
        setSelectedCats(st.categories || []);
        setSelectedUnits(st.units || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(
      "rkm_filter_state",
      JSON.stringify({ search, wards: selectedWards, categories: selectedCats, units: selectedUnits })
    );
  }, [search, selectedWards, selectedCats, selectedUnits]);

  function toggleItem(arr: string[], val: string, setter: (v: string[]) => void) {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  function clearFilters() {
    setSearch("");
    setSelectedWards([]);
    setSelectedCats([]);
    setSelectedUnits([]);
  }

  async function handleAddPatient(e: React.FormEvent) {
    e.preventDefault();
    setAddMsg("");
    if (!newMrd.trim() || !newName.trim()) {
      setAddMsg("MRD and Name are required.");
      return;
    }

    const losDays = newCat !== "Medicine" && newLos ? parseInt(newLos, 10) : null;
    const payload = {
      mrd: newMrd.trim(),
      name: newName.trim(),
      ward: newWard,
      bed_no: newBed.trim(),
      doctor_unit: newUnit || null,
      admission_date: newAdmitDate || null,
      patient_category: newCat,
      pmjay_id: newPmjay.trim() || null,
      los_days: losDays,
      los_start_date: losDays ? newAdmitDate || null : null,
      is_discharged: false
    };

    const { error } = await supabase.from("Patients").insert([payload]);
    if (error) {
      setAddMsg("Error: " + error.message);
      return;
    }

    apiSyncPatientToMongo(payload);
    setAddMsg("Patient added successfully.");
    setNewMrd("");
    setNewPmjay("");
    setNewName("");
    setNewWard("");
    setNewBed("");
    setNewUnit("");
    setNewAdmitDate("");
    setNewLos("");
    await loadData();
  }

  const filteredPatients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patients.filter((p) => {
      const matchesSearch =
        !q ||
        (p.name || "").toLowerCase().includes(q) ||
        (p.mrd || "").toLowerCase().includes(q);
      const matchesWard = selectedWards.length === 0 || selectedWards.includes(p.ward || "");
      const matchesCat =
        selectedCats.length === 0 || selectedCats.includes(p.patient_category || "");
      let matchesUnit = true;
      if (selectedUnits.length > 0) {
        const hasNone = selectedUnits.includes("__none__");
        const realUnits = selectedUnits.filter((u) => u !== "__none__");
        matchesUnit = (hasNone && !p.doctor_unit) || realUnits.includes(p.doctor_unit || "");
      }
      return matchesSearch && matchesWard && matchesCat && matchesUnit;
    });
  }, [patients, search, selectedWards, selectedCats, selectedUnits]);

  const activeForExport = useMemo(() => {
    return patients
      .filter(
        (p) =>
          !p.is_discharged &&
          !photos.some((ph) => ph.mrd === p.mrd && ph.photo_type === "Discharge Photo")
      )
      .sort((a, b) => {
        const w = (a.ward || "").localeCompare(b.ward || "");
        return w !== 0 ? w : (a.name || "").localeCompare(b.name || "");
      });
  }, [patients, photos]);

  function getPatientStatus(p: Patient) {
    if (p.is_discharged) return null;
    if (photos.some((ph) => ph.mrd === p.mrd && ph.photo_type === "Discharge Photo")) return null;

    const today = istTodayStr();
    const pPhotos = photos.filter((ph) => ph.mrd === p.mrd);

    if (p.patient_category === "OT") {
      if (pPhotos.some((ph) => PROCEDURE_SLOTS.includes(ph.photo_type))) {
        return { otDone: true as const };
      }
      const relevant = pPhotos.filter((ph) => {
        if (!ph.uploaded_at) return false;
        return parseUTC(ph.uploaded_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === today;
      });
      const captured = new Set(relevant.map((ph) => ph.photo_type));
      const missing = OT_DAILY_SLOTS.filter((s) => !captured.has(s));
      return {
        otDone: false as const,
        done: OT_DAILY_SLOTS.length - missing.length,
        total: OT_DAILY_SLOTS.length,
        missing,
        isDaily: true
      };
    }

    const req = REQUIRED_SLOTS[p.patient_category || ""] || [];
    const isDaily = p.patient_category === "Medicine";
    const relevant = isDaily
      ? pPhotos.filter((ph) => {
          if (!ph.uploaded_at) return false;
          return parseUTC(ph.uploaded_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === today;
        })
      : pPhotos;

    const captured = new Set(relevant.map((ph) => ph.photo_type));
    const missing = req.filter((s) => !captured.has(s));
    return {
      otDone: false as const,
      done: req.length - missing.length,
      total: req.length,
      missing,
      isDaily
    };
  }

  function downloadActiveCsv() {
    if (activeForExport.length === 0) {
      alert("No active patients to download.");
      return;
    }
    const header = ["Ward", "Bed", "MRD", "Name", "PMJAY", "Doctor Unit", "Category", "Admission Date"];
    const rows = activeForExport.map((p) =>
      [
        p.ward || "",
        p.bed_no || "",
        p.mrd || "",
        p.name || "",
        p.pmjay_id || "",
        doctorUnitLabel(p.doctor_unit),
        p.patient_category || "",
        p.admission_date || ""
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header.join(",")].concat(rows).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `active-patients-wardwise-${istTodayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function openDeletedModal() {
    setShowDeletedModal(true);
    setDeletedLoading(true);
    const { data, error } = await supabase
      .from("deleted_patients_archive")
      .select("id, mrd, patient_name, deleted_at, deleted_by")
      .order("deleted_at", { ascending: false });

    if (!error && data) {
      const now = Date.now();
      const WEEK = 7 * 24 * 3600 * 1000;
      setDeletedList((data as DeletedRecord[]).filter((r) => now - new Date(r.deleted_at).getTime() < WEEK));
    }
    setDeletedLoading(false);
  }

  async function restoreDeleted(archiveId: number) {
    if (!confirm("Restore this patient and all their data?")) return;
    const { error } = await supabase.rpc("admin_restore_patient", { p_archive_id: archiveId });
    if (error) {
      alert("Could not restore: " + error.message);
      return;
    }
    alert("Patient restored.");
    await loadData();
    await openDeletedModal();
  }

  const filterCount = selectedWards.length + selectedCats.length + selectedUnits.length;

  return (
    <AuthGuard>
      {({ userId, email, isAdmin: sessionAdmin }) => (
        <PatientsInner
          userId={userId}
          email={email}
          onReady={() => loadData(userId, sessionAdmin)}
          patients={filteredPatients}
          allPhotos={photos}
          loading={loading}
          isAdmin={isAdmin}
          search={search}
          setSearch={setSearch}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          filterCount={filterCount}
          selectedWards={selectedWards}
          setSelectedWards={setSelectedWards}
          selectedCats={selectedCats}
          setSelectedCats={setSelectedCats}
          selectedUnits={selectedUnits}
          setSelectedUnits={setSelectedUnits}
          openSpecialties={openSpecialties}
          setOpenSpecialties={setOpenSpecialties}
          toggleItem={toggleItem}
          clearFilters={clearFilters}
          showAddForm={showAddForm}
          setShowAddForm={setShowAddForm}
          newMrd={newMrd}
          setNewMrd={setNewMrd}
          newPmjay={newPmjay}
          setNewPmjay={setNewPmjay}
          newName={newName}
          setNewName={setNewName}
          newWard={newWard}
          setNewWard={setNewWard}
          newBed={newBed}
          setNewBed={setNewBed}
          newUnit={newUnit}
          setNewUnit={setNewUnit}
          newAdmitDate={newAdmitDate}
          setNewAdmitDate={setNewAdmitDate}
          newCat={newCat}
          setNewCat={setNewCat}
          newLos={newLos}
          setNewLos={setNewLos}
          addMsg={addMsg}
          handleAddPatient={handleAddPatient}
          activeForExport={activeForExport}
          showPreviewModal={showPreviewModal}
          setShowPreviewModal={setShowPreviewModal}
          downloadActiveCsv={downloadActiveCsv}
          showDeletedModal={showDeletedModal}
          setShowDeletedModal={setShowDeletedModal}
          openDeletedModal={openDeletedModal}
          deletedList={deletedList}
          deletedLoading={deletedLoading}
          restoreDeleted={restoreDeleted}
          getPatientStatus={getPatientStatus}
        />
      )}
    </AuthGuard>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PatientsInner(props: any) {
  useEffect(() => {
    props.onReady();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = istTodayStr();

  return (
    <div className="min-h-screen bg-[#F4F7F8]">
      <AppHeader
        title="Patient Data Module"
        subtitle="Census, MRD Search & Daily Documentation Tracking"
        backHref="/"
        backLabel="Dashboard"
        userEmail={props.email}
      />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Top Action Bar */}
        <div className="mb-5 flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="search"
              className="clinical-input pl-10"
              placeholder="Search patient name or MRD..."
              value={props.search}
              onChange={(e) => props.setSearch(e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={() => props.setShowFilters(!props.showFilters)}
            className="btn-outline"
          >
            <Filter className="h-4 w-4" />
            Filters {props.filterCount > 0 ? `(${props.filterCount})` : ""}
          </button>

          {props.filterCount > 0 || props.search ? (
            <button type="button" onClick={props.clearFilters} className="btn-outline">
              Clear
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => props.setShowAddForm(!props.showAddForm)}
            className="btn-teal"
          >
            <Plus className="h-4 w-4" />
            Add Patient
          </button>

          <button
            type="button"
            onClick={() => props.setShowPreviewModal(true)}
            className="btn-outline"
          >
            <ListChecks className="h-4 w-4" />
            Active List ({props.activeForExport.length})
          </button>

          <Link href="/enhancement" className="btn-outline">
            Enhancement Tracker
          </Link>

          {props.isAdmin && (
            <button type="button" onClick={props.openDeletedModal} className="btn-outline text-rose-700 border-rose-200 hover:bg-rose-50">
              <Trash2 className="h-4 w-4" />
              Recently Deleted
            </button>
          )}
        </div>

        {/* Filter Chips Panel */}
        {props.showFilters && (
          <div className="clinical-card mb-5 p-5 space-y-4">
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Ward</h3>
              <div className="flex flex-wrap gap-1.5">
                {WARDS.map((w) => {
                  const active = props.selectedWards.includes(w);
                  return (
                    <button
                      key={w}
                      type="button"
                      onClick={() => props.toggleItem(props.selectedWards, w, props.setSelectedWards)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        active
                          ? "border-teal-700 bg-teal-700 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {w}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Category</h3>
              <div className="flex flex-wrap gap-1.5">
                {["Medicine", "OT", "Dialysis", "Chemo"].map((c) => {
                  const active = props.selectedCats.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => props.toggleItem(props.selectedCats, c, props.setSelectedCats)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        active
                          ? "border-teal-700 bg-teal-700 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Doctor Unit</h3>
              <div className="space-y-2">
                {DOCTOR_UNIT_GROUPS.map((g) => {
                  const isOpen = !!props.openSpecialties[g.specialty];
                  return (
                    <div key={g.specialty}>
                      <button
                        type="button"
                        onClick={() =>
                          props.setOpenSpecialties({
                            ...props.openSpecialties,
                            [g.specialty]: !isOpen
                          })
                        }
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-teal-700"
                      >
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        {g.specialty}
                      </button>
                      {isOpen && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5 pl-4">
                          {g.units.map((u) => {
                            const active = props.selectedUnits.includes(u.value);
                            return (
                              <button
                                key={u.value}
                                type="button"
                                onClick={() =>
                                  props.toggleItem(props.selectedUnits, u.value, props.setSelectedUnits)
                                }
                                className={`rounded-lg border px-2.5 py-1 text-left text-xs font-medium transition ${
                                  active
                                    ? "border-teal-700 bg-teal-700 text-white"
                                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                {u.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    props.toggleItem(props.selectedUnits, "__none__", props.setSelectedUnits)
                  }
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    props.selectedUnits.includes("__none__")
                      ? "border-teal-700 bg-teal-700 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  Not assigned
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Patient Form */}
        {props.showAddForm && (
          <form onSubmit={props.handleAddPatient} className="clinical-card mb-6 p-6 border-t-4 border-t-teal-700">
            <h3 className="mb-4 text-base font-bold text-slate-900">Add New Patient</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">MRD *</label>
                <input
                  type="text"
                  className="clinical-input"
                  placeholder="MRD number"
                  value={props.newMrd}
                  onChange={(e) => props.setNewMrd(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">PMJAY ID (optional)</label>
                <input
                  type="text"
                  className="clinical-input"
                  placeholder="PMJAY Registration ID"
                  value={props.newPmjay}
                  onChange={(e) => props.setNewPmjay(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Patient Name *</label>
                <input
                  type="text"
                  className="clinical-input"
                  placeholder="Full name"
                  value={props.newName}
                  onChange={(e) => props.setNewName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Ward</label>
                <select
                  className="clinical-input"
                  value={props.newWard}
                  onChange={(e) => props.setNewWard(e.target.value)}
                >
                  <option value="">Not assigned yet</option>
                  {WARDS.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Bed No.</label>
                <input
                  type="text"
                  className="clinical-input"
                  placeholder="Bed number"
                  value={props.newBed}
                  onChange={(e) => props.setNewBed(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Doctor Unit</label>
                <select
                  className="clinical-input"
                  value={props.newUnit}
                  onChange={(e) => props.setNewUnit(e.target.value)}
                >
                  <option value="">Not assigned yet</option>
                  {DOCTOR_UNIT_GROUPS.map((g) => (
                    <optgroup key={g.specialty} label={g.specialty}>
                      {g.units.map((u) => (
                        <option key={u.value} value={u.value}>{u.value} - {u.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Admission Date</label>
                <input
                  type="date"
                  className="clinical-input"
                  value={props.newAdmitDate}
                  onChange={(e) => props.setNewAdmitDate(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Category</label>
                <select
                  className="clinical-input"
                  value={props.newCat}
                  onChange={(e) => props.setNewCat(e.target.value)}
                >
                  <option value="Medicine">Medicine</option>
                  <option value="OT">OT</option>
                  <option value="Dialysis">Dialysis</option>
                  <option value="Chemo">Chemo</option>
                </select>
              </div>
              {props.newCat !== "Medicine" && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">LOS days</label>
                  <input
                    type="number"
                    min={1}
                    className="clinical-input"
                    placeholder="Length of stay"
                    value={props.newLos}
                    onChange={(e) => props.setNewLos(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button type="submit" className="btn-teal">Save Patient</button>
              {props.addMsg && <span className="text-xs font-semibold text-teal-800">{props.addMsg}</span>}
            </div>
          </form>
        )}

        {/* Patient Cards */}
        {props.loading ? (
          <p className="text-sm text-slate-500">Loading patient census...</p>
        ) : props.patients.length === 0 ? (
          <div className="clinical-card p-8 text-center text-sm text-slate-500">No patients found.</div>
        ) : (
          <div className="space-y-3">
            {props.patients.map((p: Patient) => {
              const status = props.getPatientStatus(p);
              const dp = !p.is_discharged
                ? props.allPhotos
                    .filter((ph: PhotoSummary) => ph.mrd === p.mrd && ph.photo_type === "Discharge Photo")
                    .sort((a: PhotoSummary, b: PhotoSummary) => (a.uploaded_at < b.uploaded_at ? 1 : -1))[0]
                : null;

              let borderClass = "border-l-4 border-l-slate-300";
              if (status?.otDone || (status && status.missing.length === 0)) {
                borderClass = "border-l-4 border-l-emerald-600";
              } else if (status && status.missing.length > 0) {
                borderClass = "border-l-4 border-l-amber-500";
              }

              let losEl = null;
              if (!p.is_discharged && p.los_days && p.patient_category !== "Medicine" && p.admission_date) {
                const losStart = p.los_start_date || p.admission_date;
                const dayNo = Math.round((new Date(today).getTime() - new Date(losStart).getTime()) / 86400000) + 1;
                const left = p.los_days - dayNo;
                if (left < 0) {
                  losEl = (
                    <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      LOS EXCEEDED by {-left} day(s). Discharge and readmit on paper.
                    </div>
                  );
                } else if (left === 0) {
                  losEl = (
                    <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      LOS ends today (Day {dayNo} of {p.los_days})
                    </div>
                  );
                } else {
                  losEl = (
                    <div className="mt-1 text-xs text-slate-500">
                      LOS: Day {dayNo} of {p.los_days}
                    </div>
                  );
                }
              }

              return (
                <Link
                  key={p.mrd}
                  href={`/patient?mrd=${encodeURIComponent(p.mrd)}`}
                  className={`clinical-card block p-4 ${borderClass} hover:shadow-md transition`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="text-base font-bold text-slate-900">
                      {p.name}{" "}
                      <span className="font-mono text-xs font-normal text-slate-500">
                        (MRD: {p.mrd} | PMJAY: {p.pmjay_id || "-"})
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        p.is_discharged
                          ? "bg-slate-100 text-slate-600"
                          : "bg-teal-50 text-teal-800"
                      }`}
                    >
                      {p.is_discharged ? "Discharged" : p.patient_category || "Active"}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-600">
                    Ward: <strong>{p.ward || "Not assigned"}</strong> | Bed:{" "}
                    <strong>{p.bed_no || "-"}</strong> | Unit: {doctorUnitLabel(p.doctor_unit)}
                  </p>

                  {status && (
                    <div className="mt-2">
                      {status.otDone ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> OT DONE
                        </span>
                      ) : status.missing.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {status.done}/{status.total} done {status.isDaily ? "today" : "overall"} — All complete
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-rose-700">
                          {status.done}/{status.total} done {status.isDaily ? "today" : "overall"} — Missing:{" "}
                          {status.missing.join(", ")}
                        </span>
                      )}
                    </div>
                  )}

                  {dp && (
                    <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Discharge photo captured on{" "}
                      {parseUTC(dp.uploaded_at).toLocaleDateString("en-GB", {
                        timeZone: "Asia/Kolkata",
                        day: "numeric",
                        month: "short"
                      })}
                    </div>
                  )}

                  {losEl}
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* Active List Preview Modal */}
      {props.showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-teal-800 px-5 py-3.5 text-white">
              <span className="text-sm font-bold">
                Active Patient List Preview ({props.activeForExport.length})
              </span>
              <button type="button" onClick={() => props.setShowPreviewModal(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-slate-600">
                    <th className="p-2">Ward</th>
                    <th className="p-2">Bed</th>
                    <th className="p-2">MRD</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">Category</th>
                    <th className="p-2">Doctor Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {props.activeForExport.map((p: Patient) => (
                    <tr key={p.mrd} className="border-b border-slate-100">
                      <td className="p-2">{p.ward || "-"}</td>
                      <td className="p-2">{p.bed_no || "-"}</td>
                      <td className="p-2 font-mono">{p.mrd}</td>
                      <td className="p-2 font-medium">{p.name}</td>
                      <td className="p-2">{p.patient_category || "-"}</td>
                      <td className="p-2">{doctorUnitLabel(p.doctor_unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3 border-t border-slate-200 px-5 py-3">
              <button type="button" onClick={props.downloadActiveCsv} className="btn-teal py-2 text-xs">
                <Download className="h-3.5 w-3.5" />
                Download CSV
              </button>
              <button type="button" onClick={() => props.setShowPreviewModal(false)} className="btn-outline py-2 text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recently Deleted Admin Modal */}
      {props.showDeletedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-rose-700 px-5 py-3.5 text-white">
              <span className="text-sm font-bold">Recently Deleted Patients (7-day restore)</span>
              <button type="button" onClick={() => props.setShowDeletedModal(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              {props.deletedLoading ? (
                <p className="text-sm text-slate-500">Loading deleted patients...</p>
              ) : props.deletedList.length === 0 ? (
                <p className="text-sm text-slate-500">No recently deleted patients.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {props.deletedList.map((r: DeletedRecord) => {
                    const daysLeft = Math.max(
                      0,
                      Math.ceil((7 * 24 * 3600 * 1000 - (Date.now() - new Date(r.deleted_at).getTime())) / 86400000)
                    );
                    return (
                      <div key={r.id} className="flex items-center justify-between gap-4 py-3">
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            {r.patient_name} <span className="font-mono text-xs font-normal text-slate-500">(MRD: {r.mrd})</span>
                          </div>
                          <div className="text-xs text-slate-500">
                            Deleted {new Date(r.deleted_at).toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })} by{" "}
                            {r.deleted_by || "unknown"} — {daysLeft} day(s) left
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => props.restoreDeleted(r.id)}
                          className="btn-teal py-1.5 text-xs"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
