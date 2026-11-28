"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";

interface PdfPreviewModalProps {
  signedUrl: string | null;
  onClose: () => void;
}

export default function PdfPreviewModal({ signedUrl, onClose }: PdfPreviewModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!signedUrl) return;
    let cancelled = false;

    async function renderPdf() {
      setStatus("loading");
      setErrorMsg("");
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        const loadingTask = pdfjsLib.getDocument(signedUrl!);
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        if (cancelled) return;

        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const containerWidth = container.clientWidth - 24;
        const containerHeight = container.clientHeight - 24;
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(containerWidth / baseViewport.width, containerHeight / baseViewport.height);
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: scale * dpr });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;

        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) setStatus("ready");
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(err instanceof Error ? err.message : "Could not load document.");
        }
      }
    }

    renderPdf();
    return () => {
      cancelled = true;
    };
  }, [signedUrl]);

  if (!signedUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-3">
      <div className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-teal-800 px-4 py-3 text-white">
          <span className="text-sm font-semibold">Document Preview</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-white/90 hover:bg-white/15 transition"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div
          ref={containerRef}
          className="flex flex-1 items-center justify-center overflow-hidden bg-slate-700 p-3"
        >
          {status === "loading" && (
            <div className="flex items-center gap-2 text-sm text-white">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Rendering PDF document...</span>
            </div>
          )}
          {status === "error" && (
            <p className="text-sm text-rose-200">Could not display document: {errorMsg}</p>
          )}
          <canvas
            ref={canvasRef}
            className={`bg-white shadow-lg ${status === "ready" ? "block" : "hidden"}`}
          />
        </div>
      </div>
    </div>
  );
}
