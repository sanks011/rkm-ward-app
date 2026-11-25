// Vercel serverless function & Node.js endpoint:
// Transcribes a doctor's recorded audio into text using Deepgram Multilingual Medical STT.
// Supports English, Bengali, Hindi, and code-switched multilingual speech.
require("dotenv").config();

const SUPABASE_URL = process.env.SUPABASE_URL || "https://cqjqewlzxebszpnqhmev.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "sb_publishable_rTd12RguCfNQYezz4febZA_xuIJW3OM";

const CLINICAL_TERMS = [
  // Vitals & Respiratory
  "PEEP", "FiO2", "SpO2", "CPAP", "HFNC", "NIV", "ventilator", "surfactant", "caffeine",
  "CRT", "room air", "oxygen saturation", "heart rate", "respiratory rate", "blood pressure",
  "capillary refill time", "respiratory acidosis", "metabolic acidosis", "blood gas", "ABG",
  "chest X-ray", "CXR", "bilateral crepitations", "wheeze", "stridor", "air entry",

  // Fluids & Nutrition
  "EBM", "TPN", "OGT", "NG feeds", "dextrose", "GIR", "urine output", "ml/kg/day", "ml/hr",
  "aspirate", "vomiting", "stool", "weight gain", "birth weight", "admission weight", "current weight",
  "Ryle's tube", "normal saline", "Ringer lactate",

  // Jaundice, Hematology & Sepsis
  "phototherapy", "bilirubin", "TSB", "CRP", "WBC", "platelets", "hemogram", "hemoglobin",
  "creatinine", "sodium", "potassium", "calcium", "lactate", "blood culture", "CSF",
  "sepsis", "apnea", "jaundice", "hypoglycemia", "prematurity",

  // Medications & Antibiotics
  "antibiotics", "ampicillin", "gentamicin", "amikacin", "cefotaxime", "meropenem",
  "vancomycin", "piperacillin", "tazobactam", "fluconazole", "acyclovir", "ceftriaxone",
  "pantoprazole", "paracetamol", "ondansetron", "furosemide", "dopamine", "dobutamine",

  // Clinical & Anatomical
  "anterior fontanelle", "head ultrasound", "OFC", "femoral pulses", "auscultation",
  "necrotizing enterocolitis", "bronchopulmonary dysplasia", "patent ductus arteriosus",
  "intraventricular hemorrhage", "retinopathy of prematurity", "kangaroo mother care",
  "birth asphyxia", "hypoxic ischemic encephalopathy", "central line", "UVC", "PICC"
];

async function callDeepgram(buf, mime, model, lang) {
  const language = lang || "multi";
  const params = [
    `model=${encodeURIComponent(model)}`,
    `language=${encodeURIComponent(language)}`,
    "smart_format=true",
    "punctuate=true"
  ];

  // Add keyterms for accuracy boost on medical acronyms
  CLINICAL_TERMS.slice(0, 75).forEach(t => {
    params.push(`keyterm=${encodeURIComponent(t)}`);
  });

  const url = `https://api.deepgram.com/v1/listen?${params.join("&")}`;

  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      "Content-Type": mime || "audio/webm"
    },
    body: buf
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Not logged in" });

    // Validate user session with Supabase
    const u = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + token }
    });
    if (!u.ok) return res.status(401).json({ error: "Login expired. Please log in again." });

    if (!process.env.DEEPGRAM_API_KEY) {
      return res.status(500).json({ error: "DEEPGRAM_API_KEY is not configured in environment variables." });
    }

    const b64 = String((req.body && req.body.audio) || "");
    if (!b64 || b64.length > 8000000) {
      return res.status(400).json({ error: "Audio missing or too large (max ~4 minutes)." });
    }

    const buf = Buffer.from(b64, "base64");
    const mime = String((req.body && req.body.mime) || "audio/webm").split(";")[0];
    const requestedLang = req.body.language || "multi";
    const primaryModel = process.env.DEEPGRAM_MODEL || "nova-3";

    // Call Deepgram with multilingual model
    let r = await callDeepgram(buf, mime, primaryModel, requestedLang);

    // Fallback if model or language combination is rejected
    if (!r.ok && (r.status === 400 || r.status === 404)) {
      console.warn(`Deepgram ${primaryModel} failed (${r.status}), falling back to nova-2`);
      r = await callDeepgram(buf, mime, "nova-2", requestedLang === "multi" ? "en" : requestedLang);
    }

    const j = await r.json();
    if (!r.ok) {
      const errMsg = j.err_msg || j.message || "Deepgram STT service error";
      return res.status(502).json({ error: errMsg });
    }

    const alt = j.results?.channels?.[0]?.alternatives?.[0];
    const text = (alt && alt.transcript) || "";
    const detectedLang = j.results?.channels?.[0]?.detected_language || requestedLang;

    const out = {
      text,
      detectedLanguage: detectedLang,
      confidence: alt?.confidence || null
    };

    // One-step transcribe + AI sort option
    if (req.body.sort && text.trim()) {
      try {
        const prior = String(req.body.prior || "").slice(0, 8000);
        const combined = (prior ? prior + " " : "") + text;
        const sortModule = require("./sort.js");
        out.fields = await sortModule.sortText(combined);
      } catch (sortErr) {
        out.sortError = sortErr.message;
      }
    }

    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: "Could not transcribe audio: " + e.message });
  }
};
