"use client";

import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Eraser, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";

export interface DoctorSignatureValue {
  name: string;
  desig: string;
  img: string | null;
  stamp?: string | null;
}

interface SignaturePadProps {
  userId: string;
  userEmail: string;
  value: DoctorSignatureValue;
  onChange: (next: DoctorSignatureValue) => void;
}

function blobToPng(blob: Blob): Promise<string | null> {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement("canvas");
      c.width = im.width;
      c.height = im.height;
      c.getContext("2d")?.drawImage(im, 0, 0);
      res(c.toDataURL("image/png"));
    };
    im.onerror = () => res(null);
    im.src = URL.createObjectURL(blob);
  });
}

export default function SignaturePad({ userId, userEmail, value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string>("");
  const [profileApproved, setProfileApproved] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState("");

  const storageKey = `rkmsig:${userEmail}`;

  useEffect(() => {
    // Load local saved signature first
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved) {
        onChange({
          name: saved.name || "",
          desig: saved.desig || "",
          img: saved.img || null,
          stamp: null
        });
      }
    } catch {
      // ignore
    }

    // Also check approved hospital doctor_profiles if available
    async function loadProfile() {
      try {
        const { data } = await supabase
          .from("doctor_profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (!data) {
          setProfileMsg("Draw your signature below and save it to reuse across charts.");
          return;
        }
        if (!data.approved) {
          setProfileMsg("Hospital signature is pending admin approval. Draw below for now.");
          return;
        }

        const getPng = async (path?: string) => {
          if (!path) return null;
          const r = await supabase.storage.from("doctor-signatures").download(path);
          return r.data ? await blobToPng(r.data) : null;
        };

        const [sigPng, stampPng] = await Promise.all([
          getPng(data.signature_path),
          getPng(data.stamp_path)
        ]);

        const desig = [data.designation, data.reg_no ? `Reg. No. ${data.reg_no}` : ""]
          .filter(Boolean)
          .join(", ");

        setProfileApproved(true);
        setProfileMsg(
          `Your approved hospital signature${stampPng ? " and stamp" : ""} will be attached automatically.`
        );

        onChange({
          name: data.full_name || value.name,
          desig: desig || value.desig,
          img: sigPng || value.img,
          stamp: stampPng
        });
      } catch {
        setProfileMsg("Draw your signature below and save it to reuse across charts.");
      }
    }

    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userEmail]);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return [
      ((e.clientX - r.left) * c.width) / r.width,
      ((e.clientY - r.top) * c.height) / r.height
    ];
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0F172A";
    drawingRef.current = true;
    c.setPointerCapture(e.pointerId);
    const [x, y] = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const [x, y] = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
    onChange({ ...value, img: c.toDataURL("image/png") });
  }

  function handlePointerUp() {
    drawingRef.current = false;
  }

  function clearCanvas() {
    const c = canvasRef.current;
    if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setHasDrawn(false);
    onChange({ ...value, img: null });
    setSavedFeedback("");
  }

  function saveLocalSignature() {
    if (!value.name.trim()) {
      alert("Please enter the Doctor Name first.");
      return;
    }
    const imgData = hasDrawn && canvasRef.current ? canvasRef.current.toDataURL("image/png") : value.img;
    if (!imgData) {
      alert("Please draw your signature first.");
      return;
    }
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ name: value.name.trim(), desig: value.desig.trim(), img: imgData })
      );
      onChange({ ...value, img: imgData });
      setSavedFeedback("Signature saved on this device.");
    } catch {
      // ignore storage quota errors
    }
  }

  return (
    <div className="space-y-4">
      {profileMsg && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
            profileApproved
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          {profileApproved && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
          <span>{profileMsg}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">Doctor Full Name</label>
          <input
            type="text"
            className="clinical-input"
            placeholder="Dr. ..."
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Designation / Reg. No.
          </label>
          <input
            type="text"
            className="clinical-input"
            placeholder="e.g. RMO / Consultant (WBMC-...)"
            value={value.desig}
            onChange={(e) => onChange({ ...value, desig: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
          Signature Canvas
        </label>
        <div className="max-w-md rounded-lg border-2 border-dashed border-slate-300 bg-white p-1">
          <canvas
            ref={canvasRef}
            width={720}
            height={240}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="block h-32 w-full touch-none rounded bg-white cursor-crosshair"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={clearCanvas} className="btn-outline py-2 text-xs">
          <Eraser className="h-3.5 w-3.5" />
          Clear
        </button>
        <button type="button" onClick={saveLocalSignature} className="btn-sky py-2 text-xs">
          <Save className="h-3.5 w-3.5" />
          Save Signature on Device
        </button>
        {value.img && (
          <img
            src={value.img}
            alt="Saved signature preview"
            className="h-11 rounded border border-slate-200 bg-white px-2 py-1 object-contain"
          />
        )}
        {savedFeedback && (
          <span className="text-xs font-semibold text-emerald-700">{savedFeedback}</span>
        )}
      </div>
    </div>
  );
}
