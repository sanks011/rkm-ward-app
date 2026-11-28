import { supabase } from "./supabase";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

export async function apiTranscribe(payload: {
  audio: string;
  mime: string;
  language?: string;
  sort?: boolean;
  chart?: "nicu" | "adult";
  field?: string;
  prior?: string;
}, signal?: AbortSignal) {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/api/transcribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload),
    signal
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Transcription failed");
  return data;
}

export async function apiSort(payload: {
  text: string;
  chart?: "nicu" | "adult";
  field?: string;
}, signal?: AbortSignal) {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/api/sort`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload),
    signal
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "AI sorting failed");
  return data;
}

export async function apiSaveChartToMongo(payload: {
  mrd: string;
  chart_date: string;
  chart_type: "nicu" | "adult";
  data: Record<string, string>;
  raw_dictation?: string;
  signed_by?: string | null;
  pdf_storage_path?: string;
}) {
  try {
    const token = await getToken();
    await fetch(`${API_BASE}/api/charts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
  } catch {
    // Non-blocking sync to MongoDB
  }
}

export async function apiSyncPatientToMongo(patient: Record<string, unknown>) {
  try {
    const token = await getToken();
    await fetch(`${API_BASE}/api/patients/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(patient)
    });
  } catch {
    // Non-blocking sync
  }
}
