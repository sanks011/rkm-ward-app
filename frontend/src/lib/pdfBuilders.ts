import { jsPDF } from "jspdf";
import { ADULT_SECTIONS, NICU_SECTIONS } from "./constants";

const MAX_PDF_BYTES = 950000;
const COMPRESSION_ATTEMPTS: [number, number][] = [
  [1280, 0.70], [1280, 0.55], [1100, 0.55], [1000, 0.50],
  [900, 0.45], [800, 0.40], [700, 0.40], [600, 0.35],
  [550, 0.32], [500, 0.28], [450, 0.25]
];

function loadImageFromFile(file: File): Promise<{ img: HTMLImageElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read one of the photos"));
    };
    img.src = url;
  });
}

function makeMultiPagePdf(items: { img: HTMLImageElement }[], maxW: number, quality: number): Blob {
  let pdf: jsPDF | null = null;
  items.forEach((item, i) => {
    const nw = item.img.naturalWidth;
    const nh = item.img.naturalHeight;
    const w = Math.min(nw, maxW);
    const h = Math.round((nh * w) / nw);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(item.img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const orient = w > h ? "l" : "p";
    if (i === 0) {
      pdf = new jsPDF({ unit: "px", format: [w, h], orientation: orient });
    } else {
      pdf?.addPage([w, h], orient);
    }
    pdf?.addImage(dataUrl, "JPEG", 0, 0, w, h);
  });
  return pdf!.output("blob");
}

export async function buildMultiPagePdf(
  files: File[],
  onProgress?: (msg: string) => void
): Promise<{ blob: Blob; ok: boolean }> {
  const items: { img: HTMLImageElement; url: string }[] = [];
  try {
    for (const f of files) items.push(await loadImageFromFile(f));
    let blob: Blob | null = null;
    for (let i = 0; i < COMPRESSION_ATTEMPTS.length; i++) {
      onProgress?.(`Compressing... (attempt ${i + 1} of ${COMPRESSION_ATTEMPTS.length})`);
      await new Promise((r) => setTimeout(r, 30));
      blob = makeMultiPagePdf(items, COMPRESSION_ATTEMPTS[i][0], COMPRESSION_ATTEMPTS[i][1]);
      if (blob.size <= MAX_PDF_BYTES) return { blob, ok: true };
    }
    return { blob: blob!, ok: false };
  } finally {
    items.forEach((it) => URL.revokeObjectURL(it.url));
  }
}

export function getLocation(): Promise<{ lat: number | null; lon: number | null; text: string }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: null, lon: null, text: "Location not supported" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          text: `${pos.coords.latitude},${pos.coords.longitude}`
        }),
      () => resolve({ lat: null, lon: null, text: "Location permission denied" })
    );
  });
}

export async function getAddress(lat: number, lon: number): Promise<{ full: string | null; short: string | null } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&namedetails=1`
    );
    const data = await res.json();
    let name: string | null = data.name || null;

    if (!name) {
      try {
        const overpassQuery = `[out:json];(node(around:150,${lat},${lon})[amenity=hospital];way(around:150,${lat},${lon})[amenity=hospital];);out tags;`;
        const overpassRes = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          body: overpassQuery
        });
        const overpassData = await overpassRes.json();
        if (overpassData.elements?.[0]?.tags?.name) {
          name = overpassData.elements[0].tags.name;
        }
      } catch {
        // Ignore Overpass fallback errors
      }
    }

    const addr = data.address || {};
    const city = addr.city || addr.town || addr.village || addr.suburb || addr.county || "";
    const state = addr.state || "";
    const country = addr.country || "";
    const shortLine = name || [city, state, country].filter(Boolean).join(", ");
    return { full: data.display_name || null, short: shortLine || null };
  } catch {
    return null;
  }
}

function loadImageToCanvas(file: File, maxWidth: number): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; width: number; height: number }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve({ canvas, ctx, width, height });
      };
      img.src = String(event.target?.result || "");
    };
    reader.readAsDataURL(file);
  });
}

export async function buildGeotaggedPdf(
  file: File,
  lat: number | null,
  lon: number | null,
  address: { full: string | null } | null,
  maxWidth = 1280,
  quality = 0.7
): Promise<Blob> {
  const { canvas, ctx, width, height } = await loadImageToCanvas(file, maxWidth);
  const HOSPITAL_NAME = "Ramakrishna Mission Seva Pratishthan";
  const now = new Date();

  const bodyLines: string[] = [];
  if (address?.full) bodyLines.push(address.full);
  if (lat !== null && lon !== null) {
    bodyLines.push(`Lat ${lat.toFixed(6)}, Long ${lon.toFixed(6)}`);
  } else {
    bodyLines.push("Location unavailable");
  }
  bodyLines.push(`${now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`);

  const padding = Math.round(width * 0.015);
  const maxTextWidth = width - padding * 2;
  let headingSize = Math.round(width * 0.045);
  ctx.font = `bold ${headingSize}px Arial`;
  while (ctx.measureText(HOSPITAL_NAME).width > maxTextWidth && headingSize > 12) {
    headingSize -= 1;
    ctx.font = `bold ${headingSize}px Arial`;
  }

  const bodySize = Math.round(width * 0.028);
  const lineGap = Math.round(bodySize * 0.3);
  ctx.font = `${bodySize}px Arial`;

  const wrapped: string[] = [];
  bodyLines.forEach((line) => {
    const words = line.split(" ");
    let current = "";
    words.forEach((word) => {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxTextWidth && current) {
        wrapped.push(current);
        current = word;
      } else {
        current = test;
      }
    });
    if (current) wrapped.push(current);
  });

  const boxHeight = padding * 2 + headingSize + lineGap + wrapped.length * (bodySize + lineGap);
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, height - boxHeight, width, boxHeight);

  let cursorY = height - boxHeight + padding + headingSize;
  ctx.fillStyle = "white";
  ctx.font = `bold ${headingSize}px Arial`;
  ctx.fillText(HOSPITAL_NAME, padding, cursorY);

  ctx.font = `${bodySize}px Arial`;
  wrapped.forEach((line) => {
    cursorY += bodySize + lineGap;
    ctx.fillText(line, padding, cursorY);
  });

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const pdf = new jsPDF({ unit: "px", format: [width, height] });
  pdf.addImage(dataUrl, "JPEG", 0, 0, width, height);
  return pdf.output("blob");
}

export interface ClinicalPdfInput {
  patient: Record<string, string | null | undefined>;
  template: "nicu" | "adult";
  sections: Record<string, string>;
  currentWeight: string;
  chartDate: string;
  derivedAge?: { age: string; cga: string };
  signature: { name?: string; desig?: string; img?: string | null; stamp?: string | null };
  logoData?: string | null;
}

export function buildClinicalNotePdf(input: ClinicalPdfInput): { blob: Blob; filename: string } {
  const { patient: p, template, sections, currentWeight, chartDate, derivedAge, signature: sig, logoData } = input;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 12;
  const R = 198;
  const W = R - L;
  const BOTTOM = 276;
  const NOTE = "Note - All treatment order should be dated, timed and signed by the Consultants and RMOs.";
  let y = 12;

  const fdate = (s?: string | null) => (s ? s.split("-").reverse().join("/") : "");
  const sectionList = template === "nicu" ? NICU_SECTIONS : ADULT_SECTIONS;

  function head(full: boolean) {
    if (full) {
      doc.setLineWidth(0.5);
      doc.setDrawColor(15, 118, 110);
      doc.rect(L, 10, W, 26);
      if (logoData) doc.addImage(logoData, "PNG", L + 3, 12, 22, 22);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(15, 118, 110);
      doc.text("Ramakrishna Mission Seva Pratishthan", 105, 19, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      doc.text("99, Sarat Bose Road, Kolkata - 700 026", 105, 25, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(
        template === "nicu"
          ? "IPD PROGRESS NOTE / TREATMENT SHEET (NICU / PEDIATRIC)"
          : "IPD PROGRESS NOTE / TREATMENT SHEET",
        105,
        32,
        { align: "center" }
      );
      y = 42;

      const itemsAll: [string, string][] = [
        ["Name", String(p.name || "")],
        ["MRD No.", String(p.mrd || "")],
        ["Bed No.", String(p.bed_no || "")],
        ["Ward", String(p.ward || "")],
        ["Unit", String(p.doctor_unit || "")],
        ["Sex", String(p.sex || "")],
        ["DOB", fdate(p.dob)],
        ["Age", derivedAge?.age || ""],
        ["GA", p.gestational_age ? `${p.gestational_age} wk` : ""],
        ["CGA", derivedAge?.cga || ""],
        ["Birth wt", String(p.birth_weight || "")],
        ["Admission wt", String(p.admission_weight || "")],
        ["Current wt", currentWeight],
        ["Date", fdate(chartDate)],
        ["Date of admission", fdate(p.admission_date)]
      ];

      const adultItems: [string, string][] = [
        ["Name", String(p.name || "")],
        ["MRD No.", String(p.mrd || "")],
        ["Bed No.", String(p.bed_no || "")],
        ["Ward", String(p.ward || "")],
        ["Unit", String(p.doctor_unit || "")],
        ["Age", String(p.age_text || "")],
        ["Sex", String(p.sex || "")],
        ["Date", fdate(chartDate)],
        ["Date of admission", fdate(p.admission_date)]
      ];

      const items = (template === "nicu" ? itemsAll : adultItems).filter((i) => i[1]);
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      items.forEach((it, i) => {
        const col = i % 3;
        const x = L + col * (W / 3);
        doc.setFont("helvetica", "bold");
        doc.text(`${it[0]}:`, x, y);
        const lw = doc.getTextWidth(`${it[0]}: `);
        doc.setFont("helvetica", "normal");
        doc.text(doc.splitTextToSize(it[1], W / 3 - lw - 2)[0], x + lw, y);
        if (col === 2 || i === items.length - 1) y += 6;
      });
      doc.setDrawColor(203, 213, 225);
      doc.line(L, y - 2, R, y - 2);
      y += 3;
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`${p.name}  |  MRD ${p.mrd}  |  ${fdate(chartDate)}`, L, 14);
      doc.line(L, 17, R, 17);
      y = 24;
    }
  }

  head(true);
  let lastGrp = "";

  sectionList.forEach(({ key, label, group }) => {
    const text = (sections[key] || "").trim();
    if (!text) return;

    if (group && group !== lastGrp) {
      if (y + 14 > BOTTOM) {
        doc.addPage();
        head(false);
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(15, 118, 110);
      doc.setFillColor(240, 253, 250);
      doc.rect(L, y - 4.5, W, 7, "F");
      doc.text(group, L + 2, y);
      y += 8;
      lastGrp = group;
    }

    const lines = doc.splitTextToSize(text, W - 4);
    if (y + 12 > BOTTOM) {
      doc.addPage();
      head(false);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(label, L, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    lines.forEach((line: string) => {
      if (y > BOTTOM) {
        doc.addPage();
        head(false);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
      }
      doc.text(line, L + 2, y);
      y += 4.8;
    });
    y += 3;
  });

  if (y + 30 > BOTTOM) {
    doc.addPage();
    head(false);
  }
  y += 4;
  if (sig?.img) doc.addImage(sig.img, "PNG", R - 55, y, 50, 18);
  if (sig?.stamp) doc.addImage(sig.stamp, "PNG", R - 100, y, 32, 32);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(sig?.name || "____________________", R, y + 22, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  if (sig?.desig) doc.text(sig.desig, R, y + 27, { align: "right" });
  doc.text(`Signed: ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })}`, R, y + 32, { align: "right" });

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setLineWidth(0.3);
    doc.setDrawColor(203, 213, 225);
    doc.line(L, 282, R, 282);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(NOTE, L, 287);
    doc.setFont("helvetica", "normal");
    doc.text(`Page ${i} of ${n}`, R, 291, { align: "right" });
  }

  const safeMrd = String(p.mrd || "").replace(/[^\w-]/g, "");
  return {
    blob: doc.output("blob"),
    filename: `${template === "nicu" ? "NICU" : "IPD"}_Chart_${safeMrd}_${chartDate}.pdf`
  };
}
