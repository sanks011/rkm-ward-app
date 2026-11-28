"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Edit3,
  Eye,
  FileText,
  Loader2,
  Mic,
  RefreshCw,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiSyncPatientToMongo } from "@/lib/api";
import {
  DOCTOR_UNIT_GROUPS,
  doctorUnitLabel,
  GEOTAG_SLOTS,
  istTodayStr,
  OT_DAILY_SLOTS,
  parseUTC,
  WARDS
} from "@/lib/constants";
import {
  looksLikeNetworkFailure,
  OfflineUploadItem,
  queueAdd,
  queueDelete,
  queueGetAll
} from "@/lib/offlineQueue";
import {
  buildGeotaggedPdf,
  buildMultiPagePdf,
  getAddress,
  getLocation
} from "@/lib/pdfBuilders";
import AppHeader from "@/components/AppHeader";
import AuthGuard from "@/components/AuthGuard";
import PdfPreviewModal from "@/components/PdfPreviewModal";

interface PatientRecord {
  mrd: string;
  name: string;
  pmjay_id: string | null;
  ward: string | null;
  bed_no: string | null;
  doctor_unit: string | null;
  admission_date: string | null;
  patient_category: string;
  los_days: number | null;
  los_start_date: string | null;
  is_discharged: boolean;
  discharged_date: string | null;
}

interface PhotoEntry {
  id: number;
  mrd: string;
  photo_date: string;
  photo_type: string;
  photo_url: string | null;
  file_type: string;
  geo_location: string;
  uploaded_by: string;
  uploaded_at: string;
  _fileSize?: number;
  _fileSizeFormatted?: string;
}

interface LosRef {
  code: string;
  package_name: string;
  los_days: number | null;
  los_display: string | null;
}

function PatientDetailContent({
  userId,
  email,
  sessionIsAdmin
}: {
  userId: string;
  email: string;
  sessionIsAdmin: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mrd = searchParams.get("mrd") || "";
  const today = istTodayStr();

  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [offlineItems, setOfflineItems] = useState<OfflineUploadItem[]>([]);
  const [losRefs, setLosRefs] = useState<LosRef[]>([]);

  // Histories & Enhancement
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [wardHistory, setWardHistory] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [catHistory, setCatHistory] = useState<any[]>([]);
  const [enhStatus, setEnhStatus] = useState<string>("");
  const [enhNextDue, setEnhNextDue] = useState<Date | null>(null);

  // Panels
  const [showEditBox, setShowEditBox] = useState(false);
  const [showConvertBox, setShowConvertBox] = useState(false);
  const [showOtDaily, setShowOtDaily] = useState(false);
  const [showDischargeBox, setShowDischargeBox] = useState(false);

  // Form states
  const [editWard, setEditWard] = useState("");
  const [editBed, setEditBed] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editLosSearch, setEditLosSearch] = useState("");
  const [editLos, setEditLos] = useState("");
  const [editMsg, setEditMsg] = useState("");

  const [pmjayInput, setPmjayInput] = useState("");
  const [pmjayMsg, setPmjayMsg] = useState("");

  const [adminName, setAdminName] = useState("");
  const [adminPmjay, setAdminPmjay] = useState("");
  const [adminMsg, setAdminMsg] = useState("");
  const [adminNewMrd, setAdminNewMrd] = useState("");
  const [mrdMsg, setMrdMsg] = useState("");

  const [convertTarget, setConvertTarget] = useState("Medicine");
  const [convertLosSearch, setConvertLosSearch] = useState("");
  const [convertLos, setConvertLos] = useState("");
  const [convertMsg, setConvertMsg] = useState("");

  // Admin move select state
  const [moveTargets, setMoveTargets] = useState<Record<number, string>>({});

  // Capture & PDF Modal
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSlot, setActiveSlot] = useState("");
  const [pendingSlot, setPendingSlot] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [overlayText, setOverlayText] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const flushingRef = useRef(false);

  async function refreshOfflineBanner() {
    const items = await queueGetAll().catch(() => []);
    setOfflineItems(items.filter((i) => i.mrd === mrd));
  }

  async function loadPhotos() {
    const { data, error } = await supabase
      .from("daily_photos")
      .select("*")
      .eq("mrd", mrd)
      .order("uploaded_at", { ascending: true });

    if (error || !data) return;
    const list = data as PhotoEntry[];
    for (const e of list) {
      if (e.photo_url) {
        try {
          const folder = e.photo_url.substring(0, e.photo_url.lastIndexOf("/"));
          const file = e.photo_url.substring(e.photo_url.lastIndexOf("/") + 1);
          const { data: meta } = await supabase.storage
            .from("patient-photos")
            .list(folder, { search: file });
          const sz = meta?.[0]?.metadata?.size || 0;
          e._fileSize = sz;
          e._fileSizeFormatted = sz > 0 ? `${(sz / (1024 * 1024)).toFixed(2)} MB` : "";
        } catch {
          e._fileSize = 0;
        }
      }
    }
    setPhotos([...list]);
  }

  async function loadHistories() {
    const [{ data: wh }, { data: ch }, { data: lr }] = await Promise.all([
      supabase.from("ward_history").select("*").eq("mrd", mrd).order("changed_at", { ascending: false }),
      supabase.from("category_history").select("*").eq("mrd", mrd).order("changed_at", { ascending: false }),
      supabase.from("los_reference").select("code, package_name, los_days, los_display").order("code", { ascending: true })
    ]);
    setWardHistory(wh || []);
    setCatHistory(ch || []);
    setLosRefs((lr as LosRef[]) || []);
  }

  async function loadEnhancement(p: PatientRecord) {
    if (p.is_discharged || p.patient_category !== "Medicine") return;
    const { data } = await supabase
      .from("enhancement_log")
      .select("marked_at, marked_by")
      .eq("mrd", mrd)
      .order("marked_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const last = parseUTC(data[0].marked_at);
      const nextDue = new Date(last.getTime() + 48 * 3600 * 1000);
      setEnhNextDue(nextDue);
      setEnhStatus(
        `Last enhanced: ${last.toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })} by ${data[0].marked_by} | Next due: ${nextDue.toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })}`
      );
    } else {
      setEnhNextDue(null);
      setEnhStatus("Never enhanced.");
    }
  }

  async function flushQueue() {
    if (flushingRef.current || !navigator.onLine) return;
    flushingRef.current = true;
    try {
      const items = await queueGetAll();
      for (const item of items) {
        const filePath = `${item.mrd}/${item.photoDate}/${item.slotType}-${Date.now()}.pdf`;
        const { error: upErr } = await supabase.storage.from("patient-photos").upload(filePath, item.blob);
        if (upErr) {
          if (looksLikeNetworkFailure(upErr)) break;
          continue;
        }
        const { error: insErr } = await supabase.from("daily_photos").insert([
          {
            mrd: item.mrd,
            photo_date: item.photoDate,
            photo_type: item.slotType,
            photo_url: filePath,
            file_type: "pdf",
            geo_location: item.geoStoreText,
            uploaded_by: item.uploadedBy
          }
        ]);
        if (insErr) {
          if (looksLikeNetworkFailure(insErr)) break;
          continue;
        }
        if (item.id !== undefined) await queueDelete(item.id);
      }
    } finally {
      flushingRef.current = false;
      await refreshOfflineBanner();
      await loadPhotos();
    }
  }

  useEffect(() => {
    if (!mrd) {
      setLoading(false);
      return;
    }

    async function init() {
      setLoading(true);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(userId);
      const [roleRes, ptRes] = await Promise.all([
        isUuid
          ? supabase.from("staff_roles").select("is_admin").eq("user_id", userId).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("Patients").select("*").eq("mrd", mrd).single()
      ]);

      setIsAdmin(sessionIsAdmin || !!roleRes.data?.is_admin);
      const { data: pt, error } = ptRes;
      if (error || !pt) {
        setLoading(false);
        return;
      }

      const p = pt as PatientRecord;
      setPatient(p);
      setEditWard(p.ward || "");
      setEditBed(p.bed_no || "");
      setEditUnit(p.doctor_unit || "");
      setEditLos(p.los_days ? String(p.los_days) : "");
      setAdminName(p.name || "");
      setAdminPmjay(p.pmjay_id || "");

      await Promise.all([loadPhotos(), loadHistories(), loadEnhancement(p), refreshOfflineBanner()]);
      setLoading(false);
      flushQueue();
    }

    init();
    const onOnline = () => flushQueue();
    window.addEventListener("online", onOnline);
    const interval = setInterval(flushQueue, 30000);
    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mrd, userId]);

  const slotTypes = useMemo(() => {
    if (!patient) return [];
    let list =
      patient.patient_category === "Medicine"
        ? ["Patient Photo", "IPD Chart", "Drug Chart", "TPRB Chart", "Extra1", "Extra2"]
        : ["Before Procedure", "During Procedure", "After Procedure", "Extra1", "Extra2"];
    list = list.concat(["Registration Photos", "Registration Doc"]);
    if (patient.patient_category === "OT") list = list.concat(OT_DAILY_SLOTS);
    return list;
  }, [patient]);

  const mainSlotTypes = useMemo(() => {
    if (!patient) return [];
    return patient.patient_category === "OT"
      ? slotTypes.filter((t) => !OT_DAILY_SLOTS.includes(t))
      : slotTypes;
  }, [patient, slotTypes]);

  const groupedPhotos = useMemo(() => {
    const map: Record<string, PhotoEntry[]> = {};
    photos.forEach((p) => {
      if (!map[p.photo_type]) map[p.photo_type] = [];
      map[p.photo_type].push(p);
    });
    return map;
  }, [photos]);

  const previousCategoryTypes = useMemo(
    () =>
      Object.keys(groupedPhotos).filter(
        (t) => t !== "Discharge Photo" && !slotTypes.includes(t)
      ),
    [groupedPhotos, slotTypes]
  );

  // LOS Search Datalist Handler
  const losMap = useMemo(() => {
    const map: Record<string, number | null> = {};
    losRefs.forEach((item) => {
      const label = `${item.code} - ${item.package_name} (LOS: ${item.los_display || "not listed"})`;
      map[label] = item.los_days;
    });
    return map;
  }, [losRefs]);

  function triggerCapture(slotType: string) {
    if (pendingFiles.length > 0 && pendingSlot !== slotType) {
      alert(`Please finish or cancel the ${pendingSlot} pages first.`);
      return;
    }
    setActiveSlot(slotType);
    fileInputRef.current?.click();
  }

  async function uploadPdfBlob(blob: Blob, slotType: string, geoText: string): Promise<{ ok: boolean; queued: boolean }> {
    try {
      const filePath = `${mrd}/${today}/${slotType}-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from("patient-photos").upload(filePath, blob);
      if (upErr) {
        if (looksLikeNetworkFailure(upErr)) {
          await queueAdd({
            mrd,
            slotType,
            photoDate: today,
            geoStoreText: geoText,
            uploadedBy: email,
            blob,
            createdAt: new Date().toISOString()
          });
          await refreshOfflineBanner();
          return { ok: true, queued: true };
        }
        alert("Upload failed: " + upErr.message);
        return { ok: false, queued: false };
      }

      const { error: insErr } = await supabase.from("daily_photos").insert([
        {
          mrd,
          photo_date: today,
          photo_type: slotType,
          photo_url: filePath,
          file_type: "pdf",
          geo_location: geoText,
          uploaded_by: email
        }
      ]);
      if (insErr) {
        if (looksLikeNetworkFailure(insErr)) {
          await queueAdd({
            mrd,
            slotType,
            photoDate: today,
            geoStoreText: geoText,
            uploadedBy: email,
            blob,
            createdAt: new Date().toISOString()
          });
          await refreshOfflineBanner();
          return { ok: true, queued: true };
        }
        alert("Save failed: " + insErr.message);
        return { ok: false, queued: false };
      }

      await loadPhotos();
      return { ok: true, queued: false };
    } catch (err) {
      if (looksLikeNetworkFailure(err)) {
        await queueAdd({
          mrd,
          slotType,
          photoDate: today,
          geoStoreText: geoText,
          uploadedBy: email,
          blob,
          createdAt: new Date().toISOString()
        });
        await refreshOfflineBanner();
        return { ok: true, queued: true };
      }
      alert("Error: " + (err instanceof Error ? err.message : String(err)));
      return { ok: false, queued: false };
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (GEOTAG_SLOTS.includes(activeSlot)) {
      try {
        setOverlayText("Getting location...");
        const loc = await getLocation();
        let address = null;
        if (loc.lat !== null && loc.lon !== null) {
          setOverlayText("Fetching address...");
          address = await getAddress(loc.lat, loc.lon);
        }
        setOverlayText("Preparing geotagged PDF...");
        const pdfBlob = await buildGeotaggedPdf(file, loc.lat, loc.lon, address, 1280, 0.7);
        setOverlayText("Uploading, please wait...");
        const res = await uploadPdfBlob(pdfBlob, activeSlot, loc.text);
        setOverlayText(null);
        if (res.ok) {
          alert(
            res.queued
              ? `${activeSlot} saved offline — it will upload automatically once back online.`
              : `${activeSlot} saved successfully!`
          );
        }
      } catch (err) {
        setOverlayText(null);
        alert("An error occurred: " + (err instanceof Error ? err.message : String(err)));
      }
    } else {
      setPendingSlot(activeSlot);
      setPendingFiles((prev) => [...prev, file]);
    }
  }

  async function finishPending() {
    if (pendingFiles.length === 0) return;
    const slot = pendingSlot;
    const files = [...pendingFiles];
    try {
      setOverlayText(`Combining ${files.length} page(s)...`);
      const res = await buildMultiPagePdf(files, (msg) => setOverlayText(msg));
      setOverlayText("Uploading, please wait...");
      const up = await uploadPdfBlob(res.blob, slot, "");
      setOverlayText(null);
      if (up.ok) {
        setPendingFiles([]);
        setPendingSlot("");
        if (up.queued) {
          alert(`${slot} saved offline — will upload automatically when online.`);
        } else {
          alert(
            `${slot} saved: ${files.length} page(s), ${Math.round(res.blob.size / 1024)} KB.${
              !res.ok ? " Note: could not compress under 1 MB." : ""
            }`
          );
        }
      }
    } catch (err) {
      setOverlayText(null);
      alert("Error: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function openInModal(path: string) {
    const { data, error } = await supabase.storage.from("patient-photos").createSignedUrl(path, 300);
    if (error || !data) {
      alert("Could not open file: " + (error ? error.message : "unknown error"));
      return;
    }
    setPreviewUrl(data.signedUrl);
  }

  async function downloadFile(entry: PhotoEntry) {
    if (!entry.photo_url) return;
    const dt = parseUTC(entry.uploaded_at);
    const dayNum = dt.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "numeric" });
    let displayType = entry.photo_type;
    if (entry.photo_type === "Patient Photo") displayType = "GEO TAG PATIENT PHOTO";
    else if (entry.photo_type === "IPD Chart") displayType = "CLINICAL NOTE";
    else if (entry.photo_type === "Drug Chart") displayType = "MEDICINE CARD";

    const fileName = `${displayType} ${dayNum}`.replace(/[\\/:*?"<>|]/g, "").trim() + ".pdf";
    const { data, error } = await supabase.storage
      .from("patient-photos")
      .createSignedUrl(entry.photo_url, 300, { download: fileName });
    if (error || !data) {
      alert("Could not download file: " + (error ? error.message : "unknown error"));
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function saveLocation() {
    if (!patient) return;
    const newLos = patient.patient_category !== "Medicine" && editLos ? parseInt(editLos, 10) : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {
      ward: editWard,
      bed_no: editBed.trim(),
      doctor_unit: editUnit || null
    };
    if (patient.patient_category !== "Medicine") update.los_days = newLos;

    const { error } = await supabase.from("Patients").update(update).eq("mrd", mrd);
    if (error) {
      setEditMsg("Error: " + error.message);
      return;
    }

    if ((patient.ward || "") !== editWard || (patient.bed_no || "") !== editBed.trim()) {
      await supabase.from("ward_history").insert([
        {
          mrd,
          old_ward: patient.ward || "",
          old_bed: patient.bed_no || "",
          new_ward: editWard,
          new_bed: editBed.trim(),
          changed_by: email
        }
      ]);
    }

    const updated = { ...patient, ...update };
    setPatient(updated);
    apiSyncPatientToMongo(updated);
    setEditMsg("Saved.");
    loadHistories();
  }

  async function savePmjay() {
    if (!patient || !pmjayInput.trim()) {
      setPmjayMsg("Enter a PMJAY ID.");
      return;
    }
    const { error } = await supabase
      .from("Patients")
      .update({ pmjay_id: pmjayInput.trim() })
      .eq("mrd", mrd);
    if (error) {
      setPmjayMsg("Error: " + error.message);
      return;
    }
    const updated = { ...patient, pmjay_id: pmjayInput.trim() };
    setPatient(updated);
    apiSyncPatientToMongo(updated);
    setPmjayMsg("Saved.");
  }

  async function saveAdminEdits() {
    if (!patient || !adminName.trim()) {
      setAdminMsg("Name cannot be empty.");
      return;
    }
    const { error } = await supabase
      .from("Patients")
      .update({ name: adminName.trim(), pmjay_id: adminPmjay.trim() || null })
      .eq("mrd", mrd);
    if (error) {
      setAdminMsg("Error: " + error.message);
      return;
    }
    const updated = { ...patient, name: adminName.trim(), pmjay_id: adminPmjay.trim() || null };
    setPatient(updated);
    apiSyncPatientToMongo(updated);
    setAdminMsg("Saved.");
  }

  async function correctMrd() {
    if (!adminNewMrd.trim()) {
      setMrdMsg("Enter the new MRD.");
      return;
    }
    if (!confirm(`Change MRD from ${mrd} to ${adminNewMrd.trim()}?`)) return;
    const { error } = await supabase.rpc("correct_mrd", {
      old_mrd: mrd,
      new_mrd: adminNewMrd.trim()
    });
    if (error) {
      setMrdMsg("Error: " + error.message);
      return;
    }
    alert("MRD corrected. Reloading.");
    router.replace(`/patient?mrd=${encodeURIComponent(adminNewMrd.trim())}`);
  }

  async function deletePatient() {
    const typed = prompt(
      `This deletes ALL data for this patient.\nAdmin can restore it for 7 days.\n\nType the MRD (${mrd}) to confirm:`
    );
    if (typed === null) return;
    if (typed.trim() !== String(mrd)) {
      alert("MRD did not match.");
      return;
    }
    const { error } = await supabase.rpc("admin_delete_patient", { p_mrd: mrd });
    if (error) {
      alert("Error: " + error.message);
      return;
    }
    alert("Patient deleted (restorable for 7 days from Recently Deleted).");
    router.push("/patients");
  }

  async function convertCategory() {
    if (!patient) return;
    if (convertTarget === patient.patient_category) {
      setConvertMsg("Already in that category.");
      return;
    }
    if (!confirm(`Convert from ${patient.patient_category} to ${convertTarget}?`)) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = { patient_category: convertTarget };
    if (convertTarget !== "Medicine") {
      update.los_days = convertLos ? parseInt(convertLos, 10) : null;
      update.los_start_date = today;
    } else {
      update.los_days = null;
      update.los_start_date = null;
    }

    const { error } = await supabase.from("Patients").update(update).eq("mrd", mrd);
    if (error) {
      setConvertMsg("Error: " + error.message);
      return;
    }
    await supabase.from("category_history").insert([
      { mrd, old_category: patient.patient_category, new_category: convertTarget, changed_by: email }
    ]);
    const updated = { ...patient, ...update };
    setPatient(updated);
    apiSyncPatientToMongo(updated);
    setConvertMsg("Converted.");
    loadHistories();
  }

  async function adminMoveCapture(id: number, currentType: string) {
    const newType = moveTargets[id] || slotTypes.concat(["Discharge Photo"]).find((t) => t !== currentType);
    if (!newType || !confirm(`Move this capture to "${newType}"?`)) return;
    const { error } = await supabase.from("daily_photos").update({ photo_type: newType }).eq("id", id);
    if (error) alert("Could not move: " + error.message);
    else await loadPhotos();
  }

  async function adminDeleteCapture(id: number, path: string | null) {
    if (!confirm("Permanently delete this capture?")) return;
    if (path) {
      const { error: sErr } = await supabase.storage.from("patient-photos").remove([path]);
      if (sErr) {
        alert("Storage delete failed: " + sErr.message);
        return;
      }
    }
    const { error: dbErr } = await supabase.from("daily_photos").delete().eq("id", id);
    if (dbErr) alert("DB delete failed: " + dbErr.message);
    else await loadPhotos();
  }

  async function markEnhanced() {
    if (enhNextDue && enhNextDue > new Date()) {
      if (
        !confirm(
          `Enhancement is not due until ${enhNextDue.toLocaleString("en-GB", {
            timeZone: "Asia/Kolkata"
          })}. Mark anyway?`
        )
      )
        return;
    }
    const { error } = await supabase.from("enhancement_log").insert([{ mrd, marked_by: email }]);
    if (error) alert("Error: " + error.message);
    else if (patient) {
      await loadEnhancement(patient);
      alert("Marked as enhanced.");
    }
  }

  async function markDischarged() {
    if (!confirm("Mark this patient as discharged?")) return;
    const { error } = await supabase
      .from("Patients")
      .update({ is_discharged: true, discharged_date: today })
      .eq("mrd", mrd);
    if (error) {
      alert("Failed: " + error.message);
      return;
    }
    if (patient) apiSyncPatientToMongo({ ...patient, is_discharged: true, discharged_date: today });
    alert("Patient marked as discharged.");
    router.push("/patients");
  }

  function renderEntryList(entries: PhotoEntry[]) {
    const isToday = (e: PhotoEntry) =>
      parseUTC(e.uploaded_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === today;
    const todayEntries = entries.filter(isToday);
    const olderEntries = entries.filter((e) => !isToday(e)).slice().reverse();

    const renderRow = (e: PhotoEntry) => {
      const dt = parseUTC(e.uploaded_at);
      const label =
        dt.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" }) +
        " " +
        dt.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
      const moveOptions = slotTypes.concat(["Discharge Photo"]).filter((t) => t !== e.photo_type);

      return (
        <div key={e.id} className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
          {e._fileSizeFormatted && (
            <div className="font-semibold text-slate-500">Size: {e._fileSizeFormatted}</div>
          )}
          <div>
            {label} &mdash; by {e.uploaded_by || "unknown"}
          </div>
          {e.photo_url ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => openInModal(e.photo_url!)} className="btn-sky px-2.5 py-1 text-[11px]">
                <Eye className="h-3 w-3" /> View
              </button>
              <button type="button" onClick={() => downloadFile(e)} className="btn-outline px-2.5 py-1 text-[11px]">
                <Download className="h-3 w-3" /> Download
              </button>
            </div>
          ) : (
            <span className="italic text-slate-400">Auto-removed after 6 days (saved on hospital server)</span>
          )}
          {isAdmin && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <select
                className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                value={moveTargets[e.id] || moveOptions[0] || ""}
                onChange={(ev) => setMoveTargets({ ...moveTargets, [e.id]: ev.target.value })}
              >
                {moveOptions.map((t) => (
                  <option key={t} value={t}>
                    Move to: {t}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => adminMoveCapture(e.id, e.photo_type)}
                className="btn-outline px-2 py-1 text-[11px]"
              >
                Move
              </button>
              <button
                type="button"
                onClick={() => adminDeleteCapture(e.id, e.photo_url)}
                className="btn-danger px-2 py-1 text-[11px]"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="mt-2 text-xs">
        {todayEntries.length ? (
          <div>
            <span className="font-semibold text-emerald-700">
              Today: {todayEntries.length} capture(s)
            </span>
            {todayEntries.map(renderRow)}
          </div>
        ) : (
          <span className="text-slate-500">Not captured today</span>
        )}
        {olderEntries.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer font-semibold text-teal-700">
              Older captures ({olderEntries.length})
            </summary>
            {olderEntries.map(renderRow)}
          </details>
        )}
      </div>
    );
  }

  function renderSlotCard(type: string) {
    const entries = groupedPhotos[type] || [];
    const offlineForSlot = offlineItems.filter((it) => it.slotType === type);
    const isIpd = type === "IPD Chart";

    return (
      <div
        key={type}
        className={`clinical-card p-4 flex flex-col justify-between ${
          isIpd ? "border-l-4 border-l-teal-700 bg-teal-50/30" : "border-l-4 border-l-slate-300"
        }`}
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              {isIpd ? "IPD Chart • Clinical Note" : type}
            </h3>
            {isIpd && (
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                Voice AI Scribe
              </span>
            )}
          </div>
          {isIpd && (
            <p className="mt-0.5 text-[11px] text-teal-800">
              Doctor daily round assessment &amp; treatment sheet
            </p>
          )}
          {renderEntryList(entries)}
          {offlineForSlot.map((it, idx) => (
            <div key={idx} className="mt-2 rounded bg-amber-50 p-2 text-[11px] text-amber-800">
              <Clock className="mr-1 inline h-3 w-3" />
              Captured offline &mdash; waiting to upload.{" "}
              <a href={URL.createObjectURL(it.blob)} target="_blank" rel="noreferrer" className="underline">
                View
              </a>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2 pt-2">
          {isIpd ? (
            <>
              <Link
                href={`/clinical-notes?mrd=${encodeURIComponent(mrd)}&return=patient`}
                className="btn-teal py-2 text-xs"
              >
                <Mic className="h-3.5 w-3.5" /> Dictate Note (AI)
              </Link>
              <button
                type="button"
                onClick={() => triggerCapture(type)}
                className="btn-outline py-2 text-xs"
              >
                <Camera className="h-3.5 w-3.5" /> Upload Photo
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => triggerCapture(type)}
              className="btn-sky py-2 text-xs"
            >
              <Camera className="h-3.5 w-3.5" /> Capture
            </button>
          )}
        </div>
      </div>
    );
  }

  // LOS Banner computation
  let losBanner: React.ReactNode = null;
  if (patient && !patient.is_discharged && patient.los_days && patient.patient_category !== "Medicine" && patient.admission_date) {
    const losStart = patient.los_start_date || patient.admission_date;
    const dayNo = Math.round((new Date(today).getTime() - new Date(losStart).getTime()) / 86400000) + 1;
    const left = patient.los_days - dayNo;
    if (left < 0) {
      losBanner = (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          LOS EXCEEDED by {-left} day(s). Discharge and readmit on paper.
        </div>
      );
    } else if (left === 0) {
      losBanner = (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 p-2.5 text-xs font-semibold text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          LOS ends today (Day {dayNo} of {patient.los_days})
        </div>
      );
    } else {
      losBanner = (
        <div className="mb-3 text-xs font-medium text-slate-600">
          LOS: Day {dayNo} of {patient.los_days}
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F7F8] pb-24">
      {offlineItems.length > 0 && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-amber-600 px-4 py-2 text-xs font-semibold text-white">
          <span>{offlineItems.length} capture(s) saved offline, waiting to upload.</span>
          <button
            type="button"
            onClick={flushQueue}
            className="inline-flex items-center gap-1 rounded bg-white/20 px-2.5 py-1 hover:bg-white/30"
          >
            <RefreshCw className="h-3 w-3" /> Retry now
          </button>
        </div>
      )}

      <AppHeader
        title={patient ? patient.name : "Patient Record"}
        subtitle={
          patient
            ? `MRD: ${patient.mrd} | PMJAY: ${patient.pmjay_id || "-"} | Ward: ${patient.ward || "-"} | Bed: ${patient.bed_no || "-"} | Unit: ${doctorUnitLabel(patient.doctor_unit)}`
            : "Loading patient..."
        }
        backHref="/patients"
        backLabel="Back to List"
        userEmail={email}
      />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        {loading ? (
          <div className="clinical-card flex items-center gap-2 p-6 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin text-teal-700" /> Loading patient data...
          </div>
        ) : !patient ? (
          <div className="clinical-card p-8 text-center text-sm text-rose-700">
            Patient not found (MRD: {mrd || "missing"}).
          </div>
        ) : (
          <>
            {/* Daily Doctor Rounds Voice Scribe Banner */}
            <section className="clinical-card border-l-4 border-l-teal-700 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <Mic className="h-4 w-4 text-teal-700" />
                    Daily Doctor Rounds &bull; Digital Clinical Scribe
                  </h2>
                  <p className="mt-1 text-xs text-slate-600">
                    Dictate daily round notes in English, Bengali, Hindi, or code-mixed speech. Claude AI structures it, you review &amp; sign, and the PDF attaches automatically to IPD Chart.
                  </p>
                </div>
                <Link
                  href={`/clinical-notes?mrd=${encodeURIComponent(mrd)}&return=patient`}
                  className="btn-teal"
                >
                  <Mic className="h-4 w-4" />
                  Dictate Clinical Round Note
                </Link>
              </div>
            </section>

            {/* Ward / Bed / Unit / LOS Edit Card */}
            <section className="clinical-card p-5 border-l-4 border-l-teal-600">
              {losBanner}
              <button
                type="button"
                onClick={() => setShowEditBox(!showEditBox)}
                className="btn-outline py-2 text-xs"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit Ward / Bed / Unit / LOS
                <ChevronDown className="h-3.5 w-3.5" />
              </button>

              {showEditBox && (
                <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select className="clinical-input" value={editWard} onChange={(e) => setEditWard(e.target.value)}>
                      <option value="">Not assigned yet</option>
                      {WARDS.map((w) => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="clinical-input"
                      placeholder="Bed No."
                      value={editBed}
                      onChange={(e) => setEditBed(e.target.value)}
                    />
                  </div>
                  <select className="clinical-input" value={editUnit} onChange={(e) => setEditUnit(e.target.value)}>
                    <option value="">Doctor Unit (optional)</option>
                    {DOCTOR_UNIT_GROUPS.map((g) => (
                      <optgroup key={g.specialty} label={g.specialty}>
                        {g.units.map((u) => (
                          <option key={u.value} value={u.value}>{u.value} - {u.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {patient.patient_category !== "Medicine" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <input
                          type="text"
                          list="editLosOptions"
                          className="clinical-input"
                          placeholder="Search package code or name"
                          value={editLosSearch}
                          onChange={(e) => {
                            setEditLosSearch(e.target.value);
                            if (Object.prototype.hasOwnProperty.call(losMap, e.target.value)) {
                              const d = losMap[e.target.value];
                              setEditLos(d !== null && d !== undefined ? String(d) : "");
                            }
                          }}
                        />
                        <datalist id="editLosOptions">
                          {Object.keys(losMap).map((lbl) => (
                            <option key={lbl} value={lbl} />
                          ))}
                        </datalist>
                      </div>
                      <input
                        type="number"
                        min={1}
                        className="clinical-input"
                        placeholder="LOS days"
                        value={editLos}
                        onChange={(e) => setEditLos(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={saveLocation} className="btn-teal py-2 text-xs">
                      Save Changes
                    </button>
                    {editMsg && <span className="text-xs font-semibold text-teal-800">{editMsg}</span>}
                  </div>
                  {wardHistory.length > 0 && (
                    <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                      <strong className="text-slate-800">Ward Change History:</strong>
                      {wardHistory.map((h) => (
                        <div key={h.id}>
                          {new Date(h.changed_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}:{" "}
                          {h.old_ward || "-"} / {h.old_bed || "-"} &rarr; {h.new_ward || "-"} /{" "}
                          {h.new_bed || "-"} ({h.changed_by})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Category & Admin Controls */}
            <section className="clinical-card p-5 border-l-4 border-l-sky-600 space-y-4">
              {!isAdmin && !patient.pmjay_id && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 text-xs font-bold text-slate-800">Add PMJAY Registration ID</div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      className="clinical-input max-w-xs"
                      placeholder="PMJAY Registration ID"
                      value={pmjayInput}
                      onChange={(e) => setPmjayInput(e.target.value)}
                    />
                    <button type="button" onClick={savePmjay} className="btn-teal py-2 text-xs">Save</button>
                    {pmjayMsg && <span className="self-center text-xs text-teal-700">{pmjayMsg}</span>}
                  </div>
                </div>
              )}

              {isAdmin && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="text-xs font-bold text-slate-800">Correct Patient Identity (Admin only)</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input className="clinical-input" placeholder="Patient Name" value={adminName} onChange={(e) => setAdminName(e.target.value)} />
                    <input className="clinical-input" placeholder="PMJAY Registration ID" value={adminPmjay} onChange={(e) => setAdminPmjay(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={saveAdminEdits} className="btn-teal py-1.5 text-xs">Save Corrections</button>
                    {adminMsg && <span className="text-xs font-semibold text-teal-700">{adminMsg}</span>}
                  </div>
                  <hr className="border-slate-200" />
                  <div className="text-xs font-bold text-rose-700">Correct MRD (affects all records)</div>
                  <div className="flex flex-wrap gap-2">
                    <input className="clinical-input max-w-xs" placeholder="New MRD" value={adminNewMrd} onChange={(e) => setAdminNewMrd(e.target.value)} />
                    <button type="button" onClick={correctMrd} className="btn-danger py-1.5 text-xs">Correct MRD</button>
                    {mrdMsg && <span className="self-center text-xs text-rose-700">{mrdMsg}</span>}
                  </div>
                  <hr className="border-slate-200" />
                  <button type="button" onClick={deletePatient} className="btn-danger py-1.5 text-xs">
                    <Trash2 className="h-3.5 w-3.5" /> Delete Patient &amp; All Data (7-day restore)
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-bold text-slate-800">
                  Category: <span className="text-teal-800">{patient.patient_category}</span>
                </div>
                <button type="button" onClick={() => setShowConvertBox(!showConvertBox)} className="btn-outline py-1.5 text-xs">
                  Convert Category <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {showConvertBox && (
                <div className="space-y-3 border-t border-slate-100 pt-3">
                  <select className="clinical-input" value={convertTarget} onChange={(e) => setConvertTarget(e.target.value)}>
                    <option value="Medicine">Medicine</option>
                    <option value="OT">OT</option>
                    <option value="Dialysis">Dialysis</option>
                    <option value="Chemo">Chemo</option>
                  </select>
                  {convertTarget !== "Medicine" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        type="text"
                        list="convertLosOptions"
                        className="clinical-input"
                        placeholder="Search code or procedure"
                        value={convertLosSearch}
                        onChange={(e) => {
                          setConvertLosSearch(e.target.value);
                          if (Object.prototype.hasOwnProperty.call(losMap, e.target.value)) {
                            const d = losMap[e.target.value];
                            setConvertLos(d !== null && d !== undefined ? String(d) : "");
                          }
                        }}
                      />
                      <datalist id="convertLosOptions">
                        {Object.keys(losMap).map((lbl) => (
                          <option key={lbl} value={lbl} />
                        ))}
                      </datalist>
                      <input
                        type="number"
                        min={1}
                        className="clinical-input"
                        placeholder="LOS days"
                        value={convertLos}
                        onChange={(e) => setConvertLos(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={convertCategory} className="btn-danger py-2 text-xs">
                      Confirm Conversion
                    </button>
                    {convertMsg && <span className="text-xs font-semibold text-teal-700">{convertMsg}</span>}
                  </div>
                  {catHistory.length > 0 && (
                    <div className="rounded bg-slate-50 p-2.5 text-xs text-slate-600">
                      <strong>Conversion History:</strong>
                      {catHistory.map((h) => (
                        <div key={h.id}>
                          {new Date(h.changed_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}:{" "}
                          {h.old_category} &rarr; {h.new_category} ({h.changed_by})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* OT Daily Photos Collapsible */}
            {patient.patient_category === "OT" && (
              <section className="clinical-card p-5 border-l-4 border-l-teal-700">
                <button type="button" onClick={() => setShowOtDaily(!showOtDaily)} className="btn-outline py-2 text-xs">
                  Daily Photos <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {showOtDaily && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {OT_DAILY_SLOTS.map(renderSlotCard)}
                  </div>
                )}
              </section>
            )}

            {/* Main Slots Grid */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mainSlotTypes.map(renderSlotCard)}
            </section>

            {/* Previous Category Records */}
            {previousCategoryTypes.length > 0 && (
              <details className="clinical-card p-4">
                <summary className="cursor-pointer text-xs font-bold text-teal-800">
                  Records from before category change ({previousCategoryTypes.length})
                </summary>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {previousCategoryTypes.map((type) => (
                    <div key={type} className="rounded-lg border border-slate-200 p-3">
                      <h4 className="text-xs font-bold text-slate-800">{type} (previous category)</h4>
                      {renderEntryList(groupedPhotos[type] || [])}
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Discharge & Enhancement Section */}
            <section className="clinical-card p-5 border-l-4 border-l-amber-500">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowDischargeBox(!showDischargeBox)}
                  className="btn-outline border-rose-200 text-rose-700 hover:bg-rose-50 py-2 text-xs"
                >
                  Discharge Management <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {!patient.is_discharged && patient.patient_category === "Medicine" && (
                  <button type="button" onClick={markEnhanced} className="btn-teal py-2 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Enhanced
                  </button>
                )}
              </div>
              {enhStatus && <p className="mt-2 text-xs text-slate-600">{enhStatus}</p>}

              {showDischargeBox && (
                <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => triggerCapture("Discharge Photo")} className="btn-sky py-2 text-xs">
                      <Camera className="h-3.5 w-3.5" /> Capture Discharge Photo (Optional)
                    </button>
                    <button type="button" onClick={markDischarged} className="btn-danger py-2 text-xs">
                      Mark as Discharged
                    </button>
                  </div>
                  {patient.is_discharged ? (
                    <p className="text-xs font-semibold text-amber-700">
                      Patient discharged on {patient.discharged_date}
                    </p>
                  ) : (
                    renderEntryList(groupedPhotos["Discharge Photo"] || [])
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Multi-Page Pending Bar */}
      {pendingFiles.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-700 bg-slate-900 px-4 py-3 text-white shadow-2xl">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold">
              {pendingSlot}: {pendingFiles.length} page(s) ready
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveSlot(pendingSlot);
                  fileInputRef.current?.click();
                }}
                className="btn-sky py-1.5 text-xs"
              >
                + Add page
              </button>
              <button type="button" onClick={finishPending} className="btn-teal py-1.5 text-xs">
                <Upload className="h-3.5 w-3.5" /> Finish &amp; Upload
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = pendingFiles.slice(0, -1);
                  setPendingFiles(next);
                  if (next.length === 0) setPendingSlot("");
                }}
                className="btn-outline py-1.5 text-xs bg-slate-800 text-white border-slate-600"
              >
                Undo last
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Discard these ${pendingFiles.length} page(s)?`)) {
                    setPendingFiles([]);
                    setPendingSlot("");
                  }
                }}
                className="btn-danger py-1.5 text-xs"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Overlay */}
      {overlayText && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/80 text-white">
          <Loader2 className="mb-3 h-10 w-10 animate-spin" />
          <p className="text-sm font-semibold">{overlayText}</p>
        </div>
      )}

      {/* PDF Modal Viewer */}
      <PdfPreviewModal signedUrl={previewUrl} onClose={() => setPreviewUrl(null)} />
    </div>
  );
}

export default function PatientPage() {
  return (
    <AuthGuard>
      {({ userId, email, isAdmin }) => (
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center bg-[#F4F7F8] text-sm text-slate-600">
              Loading Patient Record...
            </div>
          }
        >
          <PatientDetailContent userId={userId} email={email} sessionIsAdmin={isAdmin} />
        </Suspense>
      )}
    </AuthGuard>
  );
}
