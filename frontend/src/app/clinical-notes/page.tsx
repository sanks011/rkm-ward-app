"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Globe,
  Loader2,
  Mic,
  Printer,
  Sparkles,
  Square,
  User
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiSaveChartToMongo, apiSort, apiTranscribe } from "@/lib/api";
import { ADULT_SECTIONS, istTodayStr, NICU_SECTIONS } from "@/lib/constants";
import { buildClinicalNotePdf } from "@/lib/pdfBuilders";
import AppHeader from "@/components/AppHeader";
import AuthGuard from "@/components/AuthGuard";
import SignaturePad, { DoctorSignatureValue } from "@/components/SignaturePad";

interface PatientFull {
  mrd: string;
  name: string;
  ward: string | null;
  bed_no: string | null;
  doctor_unit: string | null;
  admission_date: string | null;
  patient_category: string | null;
  sex: string | null;
  dob: string | null;
  gestational_age: string | null;
  birth_weight: string | null;
  admission_weight: string | null;
  age_text: string | null;
}

const NICU_HINT =
  "Example: Baby is stable, kono fever nei. On room air, SpO2 98%. HR 140, CRT 2 sec. Abdomen soft. Feeds EBM 8 ml 2 hourly, no vomiting. Continue antibiotics day 3. Parents counselled.";
const ADULT_HINT =
  "Example: Patient afebrile, bukhar nahi hai. Pulse 82, BP 120/80, SpO2 98% on room air. Chest clear, abdomen soft. Hb 10.2, creatinine 1.1. Continue Inj. ceftriaxone 1 g BD, day 3. Plan: repeat CBC tomorrow.";

function ClinicalNotesContent({ userId, email }: { userId: string; email: string }) {
  const searchParams = useSearchParams();
  const queryMrd = searchParams.get("mrd") || "";
  const returnTo = searchParams.get("return") || "";

  const [patients, setPatients] = useState<PatientFull[]>([]);
  const [ptSearch, setPtSearch] = useState("");
  const [selectedMrd, setSelectedMrd] = useState("");
  const [template, setTemplate] = useState<"nicu" | "adult">("nicu");

  // Demographics
  const [sex, setSex] = useState("");
  const [dob, setDob] = useState("");
  const [ga, setGa] = useState("");
  const [birthWeight, setBirthWeight] = useState("");
  const [admissionWeight, setAdmissionWeight] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [ageText, setAgeText] = useState("");
  const [chartDate] = useState(istTodayStr());

  // Dictation & Fields
  const [voiceLang, setVoiceLang] = useState("multi");
  const [dictation, setDictation] = useState("");
  const [interimText, setInterimText] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [aiStatus, setAiStatus] = useState<{ type: "ok" | "err" | "info"; text: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ type: "ok" | "err" | "info"; text: string } | null>(null);

  // Voice recording refs
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recordingTarget, setRecordingTarget] = useState<string | null>(null); // "main" or field key
  const [browserListening, setBrowserListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const browserRecRef = useRef<any>(null);

  // Busy Overlay
  const [busyMsg, setBusyMsg] = useState<string | null>(null);
  const [busyCountdown, setBusyCountdown] = useState<number | null>(null);
  const busyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Signature & Logo
  const [signature, setSignature] = useState<DoctorSignatureValue>({
    name: "",
    desig: "",
    img: null,
    stamp: null
  });
  const [logoData, setLogoData] = useState<string | null>(null);
  const [savingPdf, setSavingPdf] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        c.getContext("2d")?.drawImage(img, 0, 0);
        setLogoData(c.toDataURL("image/png"));
      } catch {
        // ignore
      }
    };
    img.src = "/icons/icon-192.png";

    supabase
      .from("Patients")
      .select("*")
      .eq("is_discharged", false)
      .order("ward", { ascending: true })
      .order("name", { ascending: true })
      .then(({ data }) => {
        const rows = (data as PatientFull[]) || [];
        setPatients(rows);
        if (queryMrd && rows.some((p) => String(p.mrd) === queryMrd)) {
          setSelectedMrd(queryMrd);
        }
      });
  }, [queryMrd]);

  const currentPatient = useMemo(
    () => patients.find((p) => String(p.mrd) === selectedMrd) || null,
    [patients, selectedMrd]
  );

  useEffect(() => {
    if (!currentPatient) return;
    const autoTemplate = /^(NICU|PICU)/i.test(currentPatient.ward || "") ? "nicu" : "adult";
    setTemplate(autoTemplate);
    setSex(currentPatient.sex || "");
    setDob(currentPatient.dob || "");
    setGa(currentPatient.gestational_age || "");
    setBirthWeight(currentPatient.birth_weight || "");
    setAdmissionWeight(currentPatient.admission_weight || "");
    setAgeText(currentPatient.age_text || "");
    setCurrentWeight("");
    setFields({});
    setDictation("");
    setAiStatus(null);
    setSaveStatus(null);
  }, [currentPatient]);

  const filteredOptions = useMemo(() => {
    const q = ptSearch.trim().toLowerCase();
    return patients.filter(
      (p) => !q || [p.name, p.mrd, p.ward, p.bed_no].join(" ").toLowerCase().includes(q)
    );
  }, [patients, ptSearch]);

  const SECTIONS = template === "nicu" ? NICU_SECTIONS : ADULT_SECTIONS;

  function showBusy(msg: string, ms: number, onTimeout?: () => void) {
    setBusyMsg(msg);
    if (busyIntervalRef.current) clearInterval(busyIntervalRef.current);
    if (busyTimeoutRef.current) clearTimeout(busyTimeoutRef.current);

    if (ms > 0) {
      const start = Date.now();
      setBusyCountdown(Math.ceil(ms / 1000));
      busyIntervalRef.current = setInterval(() => {
        setBusyCountdown(Math.max(0, Math.ceil((ms - (Date.now() - start)) / 1000)));
      }, 200);
      busyTimeoutRef.current = setTimeout(() => {
        hideBusy();
        onTimeout?.();
      }, ms);
    } else {
      setBusyCountdown(null);
    }
  }

  function hideBusy() {
    if (busyIntervalRef.current) clearInterval(busyIntervalRef.current);
    if (busyTimeoutRef.current) clearTimeout(busyTimeoutRef.current);
    setBusyMsg(null);
    setBusyCountdown(null);
  }

  function blobToB64(blob: Blob): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1]);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }

  async function recordAudio(target: string, onBlob: (blob: Blob) => Promise<void>) {
    if (mediaRecRef.current && mediaRecRef.current.state === "recording") {
      if (recordingTarget === target) {
        mediaRecRef.current.stop();
      } else {
        alert("Please stop the active recording first.");
      }
      return;
    }

    if (!navigator.mediaDevices || !window.MediaRecorder) {
      alert("Recording is not supported in this browser. Please use Chrome or Browser Speech.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
    } catch {
      alert("Microphone permission denied. Please allow microphone access and try again.");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 24000 });
    mediaRecRef.current = rec;

    rec.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };

    rec.onstop = async () => {
      if (recTimerRef.current) clearTimeout(recTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setRecordingTarget(null);

      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
      if (blob.size < 1500) {
        if (target === "main") {
          setAiStatus({ type: "err", text: "Recording too short. Please try again." });
        } else {
          alert("Recording too short. Please try again.");
        }
        return;
      }
      await onBlob(blob);
    };

    rec.start();
    setRecordingTarget(target);
    recTimerRef.current = setTimeout(() => {
      if (mediaRecRef.current?.state === "recording") mediaRecRef.current.stop();
    }, 200000);
  }

  function handleMainVoice() {
    recordAudio("main", async (blob) => {
      const t0 = Date.now();
      setAiStatus({ type: "info", text: "Transcribing multilingual speech and structuring note..." });
      const ac = new AbortController();
      showBusy("Transcribing and sorting clinical note...", 20000, () => ac.abort());

      try {
        const b64 = await blobToB64(blob);
        const res = await apiTranscribe(
          {
            audio: b64,
            mime: blob.type,
            language: voiceLang,
            sort: true,
            chart: template,
            prior: dictation
          },
          ac.signal
        );

        const nextDict = dictation + (dictation && !/\s$/.test(dictation) ? " " : "") + (res.text || "");
        setDictation(nextDict);

        if (!String(res.text || "").trim()) {
          setAiStatus({ type: "err", text: "No speech detected. Please try again." });
        } else if (res.fields) {
          applySortedFields(res.fields, t0, res.ms);
        } else {
          await handleSortWithAI(nextDict);
        }
      } catch (e) {
        const err = e as Error;
        setAiStatus({
          type: "err",
          text:
            err.name === "AbortError"
              ? "Took longer than 20 seconds. Check your network and try again, or type the note."
              : `Speech engine failed: ${err.message}`
        });
      } finally {
        hideBusy();
      }
    });
  }

  function handleFieldVoice(fieldKey: string) {
    const label = SECTIONS.find((s) => s.key === fieldKey)?.label || fieldKey;
    recordAudio(fieldKey, async (blob) => {
      const ac = new AbortController();
      showBusy(`Updating "${label}"...`, 20000, () => ac.abort());

      try {
        const b64 = await blobToB64(blob);
        const res = await apiTranscribe(
          {
            audio: b64,
            mime: blob.type,
            language: voiceLang,
            sort: true,
            chart: template,
            field: fieldKey
          },
          ac.signal
        );

        const v = String((res.fields && res.fields[fieldKey]) || res.text || "").trim();
        if (!v) {
          alert("No speech detected. Please try again.");
        } else {
          setFields((prev) => ({ ...prev, [fieldKey]: v }));
        }
      } catch (e) {
        const err = e as Error;
        alert(
          err.name === "AbortError"
            ? "Took longer than 20 seconds. Please try again or type directly."
            : `Could not update field: ${err.message}`
        );
      } finally {
        hideBusy();
      }
    });
  }

  function toggleBrowserVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Browser Speech Recognition is not supported here. Please use Google Chrome.");
      return;
    }

    if (browserListening) {
      setBrowserListening(false);
      browserRecRef.current?.stop();
      return;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    const langMap: Record<string, string> = {
      multi: "en-IN",
      en: "en-IN",
      bn: "bn-IN",
      hi: "hi-IN"
    };
    rec.lang = langMap[voiceLang] || "en-IN";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let interim = "";
      let appended = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) appended += (appended ? " " : "") + t.trim();
        else interim += t;
      }
      if (appended) {
        setDictation((prev) => prev + (prev && !/\s$/.test(prev) ? " " : "") + appended);
      }
      setInterimText(interim ? `Hearing: ${interim}` : "");
    };

    rec.onerror = () => setBrowserListening(false);
    rec.onend = () => {
      setBrowserListening(false);
      setInterimText("");
    };

    browserRecRef.current = rec;
    setBrowserListening(true);
    rec.start();
  }

  function applySortedFields(sorted: Record<string, string>, t0: number, ms?: { stt?: string; sort?: string }) {
    let count = 0;
    const next: Record<string, string> = { ...fields };
    SECTIONS.forEach(({ key }) => {
      if (sorted[key]) {
        next[key] = sorted[key];
        count++;
      }
    });
    setFields(next);
    if (sorted.current_weight) setCurrentWeight(sorted.current_weight);

    const total = ((Date.now() - t0) / 1000).toFixed(1);
    const timing = ms ? ` = speech ${ms.stt}s + sort ${ms.sort}s` : "";
    setAiStatus({
      type: "ok",
      text: `${count} section(s) populated. Review and edit fields below before signing. [Total ${total}s${timing}]`
    });
  }

  async function handleSortWithAI(overrideText?: string) {
    const text = (overrideText ?? dictation).trim();
    if (!text) {
      setAiStatus({ type: "err", text: "Please speak or enter clinical dictation first." });
      return;
    }

    const t0 = Date.now();
    const ac = new AbortController();
    setAiStatus({ type: "info", text: "Structuring clinical note with Claude AI..." });
    showBusy("Structuring with Claude AI...", 20000, () => ac.abort());

    try {
      const res = await apiSort({ text, chart: template }, ac.signal);
      applySortedFields(res.fields || {}, t0, res.ms);
    } catch (e) {
      const err = e as Error;
      setAiStatus({
        type: "err",
        text:
          err.name === "AbortError"
            ? "AI request timed out after 20s. Please retry."
            : `AI structuring failed: ${err.message}`
      });
    } finally {
      hideBusy();
    }
  }

  function computeDerivedAge() {
    let age = "";
    let cga = "";
    if (dob) {
      const diff = Math.round((new Date(chartDate).getTime() - new Date(dob).getTime()) / 86400000);
      if (diff >= 0) {
        age = diff < 90 ? `${diff} days` : `${Math.floor(diff / 30.4)} months`;
        const m = ga.match(/(\d+)\s*(?:\+\s*(\d))?/);
        if (m) {
          const tot = Number(m[1]) * 7 + (Number(m[2]) || 0) + diff;
          cga = `${Math.floor(tot / 7)}+${tot % 7} wk`;
        }
      }
    }
    return { age, cga };
  }

  async function saveAndGeneratePdf() {
    if (!currentPatient) return;
    const hasAnyField = SECTIONS.some((s) => (fields[s.key] || "").trim());
    if (!hasAnyField) {
      setSaveStatus({ type: "err", text: "Fill at least one clinical section first." });
      return;
    }
    if (!signature.img && !confirm("No signature drawn or saved. Generate PDF without signature?")) return;
    if (
      SECTIONS.some((s) => (fields[s.key] || "").includes("[?")) &&
      !confirm('Some fields contain "[?]" ambiguity markers. Have you checked them? Continue anyway?')
    ) {
      return;
    }

    setSavingPdf(true);
    setSaveStatus(null);
    showBusy("Saving chart and generating official RKMSP PDF...", 0);

    try {
      let warnMsg = "";
      const demoUpdate: Record<string, string> = {};
      if (!currentPatient.sex && sex.trim()) demoUpdate.sex = sex.trim();
      if (template === "nicu") {
        if (!currentPatient.dob && dob.trim()) demoUpdate.dob = dob.trim();
        if (!currentPatient.gestational_age && ga.trim()) demoUpdate.gestational_age = ga.trim();
        if (!currentPatient.birth_weight && birthWeight.trim()) demoUpdate.birth_weight = birthWeight.trim();
        if (!currentPatient.admission_weight && admissionWeight.trim()) {
          demoUpdate.admission_weight = admissionWeight.trim();
        }
      } else if (!currentPatient.age_text && ageText.trim()) {
        demoUpdate.age_text = ageText.trim();
      }

      if (Object.keys(demoUpdate).length > 0) {
        const { error: pErr } = await supabase
          .from("Patients")
          .update(demoUpdate)
          .eq("mrd", currentPatient.mrd);
        if (pErr) warnMsg += `Demographics save warning: ${pErr.message}. `;
      }

      const chartDataPayload = {
        ...fields,
        current_weight: currentWeight.trim(),
        chart_type: template
      };

      const { error: chartErr } = await supabase.from("nicu_charts").insert([
        {
          mrd: String(currentPatient.mrd),
          chart_date: chartDate,
          data: chartDataPayload,
          signed_by: signature.name.trim() || null,
          author_email: email
        }
      ]);
      if (chartErr) warnMsg += `Chart table notice: ${chartErr.message}. `;

      const mergedPatient = {
        ...currentPatient,
        ...demoUpdate,
        sex: sex || currentPatient.sex,
        dob: dob || currentPatient.dob,
        gestational_age: ga || currentPatient.gestational_age,
        birth_weight: birthWeight || currentPatient.birth_weight,
        admission_weight: admissionWeight || currentPatient.admission_weight,
        age_text: ageText || currentPatient.age_text
      };

      const out = buildClinicalNotePdf({
        patient: mergedPatient,
        template,
        sections: fields,
        currentWeight: currentWeight.trim(),
        chartDate,
        derivedAge: computeDerivedAge(),
        signature,
        logoData
      });

      const storagePath = `${currentPatient.mrd}/${chartDate}/IPD Chart-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("patient-photos")
        .upload(storagePath, out.blob, { contentType: "application/pdf" });

      if (upErr) {
        warnMsg += `PDF upload failed: ${upErr.message}. `;
      } else {
        const { error: insErr } = await supabase.from("daily_photos").insert([
          {
            mrd: currentPatient.mrd,
            photo_date: chartDate,
            photo_type: "IPD Chart",
            photo_url: storagePath,
            file_type: "pdf",
            geo_location: "",
            uploaded_by: email
          }
        ]);
        if (insErr) warnMsg += `Could not add to daily_photos: ${insErr.message}. `;
      }

      // Sync text data to MongoDB non-blockingly
      await apiSaveChartToMongo({
        mrd: String(currentPatient.mrd),
        chart_date: chartDate,
        chart_type: template,
        data: fields,
        raw_dictation: dictation,
        signed_by: signature.name.trim() || null,
        pdf_storage_path: upErr ? "" : storagePath
      });

      const url = URL.createObjectURL(out.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = out.filename;
      a.click();
      URL.revokeObjectURL(url);

      setSaveStatus({
        type: warnMsg ? "err" : "ok",
        text: warnMsg || "Clinical note saved to Supabase & MongoDB, attached to IPD Chart, and PDF downloaded."
      });
    } catch (e) {
      setSaveStatus({
        type: "err",
        text: e instanceof Error ? e.message : "Failed to save and generate PDF."
      });
    } finally {
      setSavingPdf(false);
      hideBusy();
    }
  }

  function printPreviewPdf() {
    if (!currentPatient) return;
    const out = buildClinicalNotePdf({
      patient: { ...currentPatient, sex, dob, gestational_age: ga, birth_weight: birthWeight, admission_weight: admissionWeight, age_text: ageText },
      template,
      sections: fields,
      currentWeight: currentWeight.trim(),
      chartDate,
      derivedAge: computeDerivedAge(),
      signature,
      logoData
    });
    const url = URL.createObjectURL(out.blob);
    const win = window.open(url);
    if (win) win.onload = () => win.print();
  }

  const backTarget = returnTo === "patient" && selectedMrd ? `/patient?mrd=${encodeURIComponent(selectedMrd)}` : "/ward";
  const backLabel = returnTo === "patient" ? "Patient Chart" : "Ward Module";

  return (
    <div className="min-h-screen bg-[#F4F7F8]">
      <AppHeader
        title={template === "nicu" ? "NICU / PICU IPD Chart" : "IPD Clinical Round Note"}
        subtitle="Multilingual Voice Scribe & Digital Treatment Sheet"
        backHref={backTarget}
        backLabel={backLabel}
        userEmail={email}
      />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        {/* Patient Selector */}
        {!queryMrd && (
          <section className="clinical-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-teal-800">
              <User className="h-4 w-4" /> Select Admitted Patient
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="search"
                className="clinical-input"
                placeholder="Filter by name, MRD, ward, or bed..."
                value={ptSearch}
                onChange={(e) => setPtSearch(e.target.value)}
              />
              <select
                className="clinical-input"
                value={selectedMrd}
                onChange={(e) => setSelectedMrd(e.target.value)}
              >
                <option value="">-- Select patient ({filteredOptions.length}) --</option>
                {filteredOptions.map((p) => (
                  <option key={p.mrd} value={p.mrd}>
                    {p.ward || "-"} / {p.bed_no || "-"} — {p.name} (MRD {p.mrd})
                  </option>
                ))}
              </select>
            </div>
          </section>
        )}

        {currentPatient && (
          <>
            {/* Patient Banner & Demographics */}
            <section className="clinical-card p-5 border-l-4 border-l-teal-700">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{currentPatient.name}</h2>
                  <p className="mt-1 text-xs text-slate-600">
                    MRD <strong className="font-mono">{currentPatient.mrd}</strong> &bull; Ward{" "}
                    <strong>{currentPatient.ward || "-"}</strong> &bull; Bed{" "}
                    <strong>{currentPatient.bed_no || "-"}</strong> &bull; Unit{" "}
                    <strong>{currentPatient.doctor_unit || "-"}</strong> &bull; Admitted{" "}
                    {currentPatient.admission_date || "-"}
                  </p>
                </div>

                {/* Template Switcher */}
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setTemplate("nicu")}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                      template === "nicu" ? "bg-teal-700 text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    NICU / Pediatric
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplate("adult")}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                      template === "adult" ? "bg-teal-700 text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Adult Ward / ICU
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Sex</label>
                  <select
                    className="clinical-input"
                    value={sex}
                    disabled={!!currentPatient.sex}
                    onChange={(e) => setSex(e.target.value)}
                  >
                    <option value=""></option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                {template === "nicu" ? (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Date of Birth</label>
                      <input
                        type="date"
                        className="clinical-input"
                        value={dob}
                        disabled={!!currentPatient.dob}
                        onChange={(e) => setDob(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">GA at birth (e.g. 32+3)</label>
                      <input
                        className="clinical-input"
                        placeholder="32+3"
                        value={ga}
                        disabled={!!currentPatient.gestational_age}
                        onChange={(e) => setGa(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Birth Weight</label>
                      <input
                        className="clinical-input"
                        placeholder="e.g. 1.45 kg"
                        value={birthWeight}
                        disabled={!!currentPatient.birth_weight}
                        onChange={(e) => setBirthWeight(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Admission Weight</label>
                      <input
                        className="clinical-input"
                        placeholder="e.g. 1.40 kg"
                        value={admissionWeight}
                        disabled={!!currentPatient.admission_weight}
                        onChange={(e) => setAdmissionWeight(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Current Weight</label>
                      <input
                        className="clinical-input"
                        placeholder="e.g. 1.52 kg"
                        value={currentWeight}
                        onChange={(e) => setCurrentWeight(e.target.value)}
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Age</label>
                    <input
                      className="clinical-input"
                      placeholder="e.g. 54 years"
                      value={ageText}
                      disabled={!!currentPatient.age_text}
                      onChange={(e) => setAgeText(e.target.value)}
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Chart Date</label>
                  <input type="date" className="clinical-input bg-slate-50" value={chartDate} disabled />
                </div>
              </div>
            </section>

            {/* 1. Voice Dictation Card */}
            <section className="clinical-card p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-base font-bold text-teal-800">
                  <Mic className="h-4 w-4" /> 1. Dictate or Type Clinical Note
                </h3>
                <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
                  English &bull; Bengali &bull; Hindi Code-Switching
                </span>
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleMainVoice}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition ${
                    recordingTarget === "main"
                      ? "bg-rose-600 animate-pulse"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {recordingTarget === "main" ? (
                    <>
                      <Square className="h-4 w-4 fill-current" /> Recording... Tap to Stop
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" /> Start Voice
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleSortWithAI()}
                  className="btn-teal"
                >
                  <Sparkles className="h-4 w-4" />
                  Done — Structure with AI
                </button>

                <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5">
                  <Globe className="h-4 w-4 text-slate-500" />
                  <select
                    value={voiceLang}
                    onChange={(e) => setVoiceLang(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
                  >
                    <option value="multi">Auto Multilingual (EN + BN + HI)</option>
                    <option value="en">English (India)</option>
                    <option value="bn">Bengali</option>
                    <option value="hi">Hindi</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={toggleBrowserVoice}
                  className={`btn-outline py-2 text-xs ${browserListening ? "border-rose-500 text-rose-700" : ""}`}
                >
                  {browserListening ? "Stop Browser Voice" : "Backup Voice"}
                </button>
              </div>

              {interimText && (
                <p className="mb-2 text-xs italic text-sky-700">{interimText}</p>
              )}

              {/* Checklist Pills */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {SECTIONS.filter((s) => s.key !== "other").map((s, i) => {
                  const done = !!(fields[s.key] || "").trim();
                  return (
                    <span
                      key={s.key}
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                        done
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                    >
                      {i + 1}. {s.label.split("/")[0].split("(")[0].trim()}
                    </span>
                  );
                })}
                {template === "nicu" && (
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                      currentWeight.trim()
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    Current weight
                  </span>
                )}
              </div>

              <textarea
                rows={4}
                className="clinical-input min-h-[120px] leading-relaxed"
                placeholder={template === "nicu" ? NICU_HINT : ADULT_HINT}
                value={dictation}
                onChange={(e) => setDictation(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Do not say patient names or MRD numbers. When recording stops, text is transcribed and structured automatically.
              </p>

              {aiStatus && (
                <div
                  className={`mt-3 rounded-lg border px-3 py-2 text-xs font-medium ${
                    aiStatus.type === "ok"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : aiStatus.type === "err"
                      ? "border-rose-200 bg-rose-50 text-rose-800"
                      : "border-sky-200 bg-sky-50 text-sky-800"
                  }`}
                >
                  {aiStatus.text}
                </div>
              )}
            </section>

            {/* 2. Editable Clinical Fields */}
            <section className="clinical-card p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-base font-bold text-teal-800">
                  <FileText className="h-4 w-4" /> 2. Review &amp; Edit Structured Fields
                </h3>
                <span className="text-xs text-slate-500">Empty boxes are omitted from PDF</span>
              </div>
              <p className="mb-4 flex items-center gap-1.5 text-xs text-slate-600">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                Amber highlight = unclear word marked <code className="font-mono">[?]</code>. Tap Speak on any field to re-dictate just that section.
              </p>

              <div className="space-y-4">
                {SECTIONS.map((sec, idx) => {
                  const showGroup = sec.group && (idx === 0 || SECTIONS[idx - 1].group !== sec.group);
                  const val = fields[sec.key] || "";
                  const flagged = val.includes("[?");
                  const isRecThis = recordingTarget === sec.key;

                  return (
                    <React.Fragment key={sec.key}>
                      {showGroup && (
                        <h4 className="border-b border-teal-100 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-teal-700">
                          {sec.group}
                        </h4>
                      )}
                      <div
                        className={`rounded-lg border p-3 transition ${
                          flagged
                            ? "border-amber-400 bg-amber-50/70"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <label className="text-xs font-bold text-slate-800">{sec.label}</label>
                          <button
                            type="button"
                            onClick={() => handleFieldVoice(sec.key)}
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                              isRecThis
                                ? "border-rose-600 bg-rose-600 text-white animate-pulse"
                                : flagged
                                ? "border-amber-500 bg-amber-500 text-white"
                                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {isRecThis ? (
                              <>
                                <Square className="h-3 w-3 fill-current" /> Stop
                              </>
                            ) : (
                              <>
                                <Mic className="h-3 w-3" /> Speak
                              </>
                            )}
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          className="clinical-input text-sm"
                          value={val}
                          onChange={(e) => setFields({ ...fields, [sec.key]: e.target.value })}
                        />
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </section>

            {/* 3. Doctor Signature & PDF Export */}
            <section className="clinical-card p-5">
              <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-teal-800">
                <CheckCircle2 className="h-4 w-4" /> 3. Doctor Signature &amp; Final PDF
              </h3>

              <SignaturePad
                userId={userId}
                userEmail={email}
                value={signature}
                onChange={setSignature}
              />

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  disabled={savingPdf}
                  onClick={saveAndGeneratePdf}
                  className="btn-teal px-5 py-3"
                >
                  {savingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Save &amp; Generate PDF
                </button>

                <button type="button" onClick={printPreviewPdf} className="btn-sky px-4 py-3">
                  <Printer className="h-4 w-4" />
                  Print Sheet
                </button>

                <Link href={`/patient?mrd=${encodeURIComponent(currentPatient.mrd)}`} className="btn-outline px-4 py-3">
                  Open Patient Record
                </Link>
              </div>

              {saveStatus && (
                <div
                  className={`mt-4 rounded-lg border px-3.5 py-2.5 text-xs font-semibold ${
                    saveStatus.type === "ok"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-rose-200 bg-rose-50 text-rose-800"
                  }`}
                >
                  {saveStatus.text}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Busy Processing Overlay */}
      {busyMsg && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 p-6 text-center backdrop-blur-sm">
          <Loader2 className="mb-3 h-10 w-10 animate-spin text-teal-700" />
          {busyCountdown !== null && (
            <div className="mb-1 text-3xl font-bold tabular-nums text-teal-700">{busyCountdown} s</div>
          )}
          <p className="text-base font-semibold text-slate-900">{busyMsg}</p>
          <p className="mt-1 text-xs text-slate-500">Please wait, do not close this window</p>
        </div>
      )}
    </div>
  );
}

export default function ClinicalNotesPage() {
  return (
    <AuthGuard>
      {({ userId, email }) => (
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center bg-[#F4F7F8] text-sm text-slate-600">
              Loading Clinical Scribe...
            </div>
          }
        >
          <ClinicalNotesContent userId={userId} email={email} />
        </Suspense>
      )}
    </AuthGuard>
  );
}
