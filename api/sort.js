// Vercel serverless function & Node.js endpoint:
// Sorts a doctor's dictated or typed clinical note into structured medical fields.
// Supports multilingual speech (English, Bengali, Hindi, Hinglish, Benglish code-switching).
require("dotenv").config();

const SUPABASE_URL = process.env.SUPABASE_URL || "https://cqjqewlzxebszpnqhmev.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "sb_publishable_rTd12RguCfNQYezz4febZA_xuIJW3OM";

const FIELDS = {
  background: "Background / admission problem, primary diagnosis, clinical history",
  current_problems: "Current active problems / complaints",
  progress: "Progress in last 24 hours",
  respiration: "Respiration, respiratory support (Room air/O2/CPAP/HFNC/Vent), SpO2, RR, breath sounds, blood gas, chest X-ray",
  cvs: "Cardiovascular: HR, CRT, BP, peripheral pulses, heart sounds, perfusion",
  abdomen: "Abdomen examination: soft, tenderness, distension, bowel sounds",
  fluid_total: "Total fluid intake (ml/kg/day or ml/day)",
  iv_pn: "IV fluids / parenteral nutrition, type, rate, urine output",
  enteral: "Enteral feeds / oral diet, type (EBM/formula/regular), volume, frequency, aspirate/vomiting tolerance",
  wt_stool: "Weight gain/loss, bowel habits, stool frequency and character",
  hematology: "Hematology, jaundice (bilirubin, phototherapy), pallor, bleeding",
  cns: "CNS: sensorium, anterior fontanelle, tone, reflexes, OFC, neuro imaging",
  sepsis: "Sepsis assessment, antimicrobial therapy with day count (e.g. Day 3/7)",
  cultures: "Blood culture, CSF, urine, swab cultures and sensitivity reports",
  investigations: "Investigations: CBC, hemogram, biochemistry, electrolytes, LFT, KFT, CRP, etc.",
  communication: "Communication with patient / parents / family regarding condition and plan",
  impression: "Clinical impression / overall assessment",
  plan: "Treatment plan, medication orders, dose adjustments, dietary orders, pending reviews",
  other: "Any additional clinical observations not covered above",
  current_weight: "Current patient weight with unit (e.g. 1.55 kg or 62 kg)"
};

const SYSTEM = `You are a Senior Clinical Documentation Specialist and AI Medical Scribe for Ramakrishna Mission Seva Pratishthan (RKMSP) hospital.
Your job is to structure a doctor's dictated or typed clinical round notes (neonatal, pediatric, general medicine, or surgical wards) into standardized, professional medical record fields.

CRITICAL INSTRUCTIONS:

1. MULTILINGUAL & CODE-SWITCHING COMPREHENSION:
- Doctors frequently speak in a natural mix of English, Bengali, Hindi, Hinglish, and Benglish.
- Examples of Bengali phrases:
  * "Ajke baby/patient stable ache" -> "Patient is clinically stable today."
  * "Kono fever nei" / "bukhar nei" -> "Afebrile; no fever recorded."
  * "Room air e SpO2 98 percent maintain korche" -> "Maintaining SpO2 98% on room air."
  * "Bilateral chest clear" / "kono crepitations nei" -> "Bilateral chest clear on auscultation; no adventitious sounds."
  * "Abdomen soft, kono distension nei" -> "Abdomen soft, non-tender, no distension."
  * "Feeds bhalo bhabe nichhe" / "vomiting hoyni" -> "Feeds tolerated well; no vomiting or abdominal distension."
  * "Stool pass koreche" -> "Passed stool normally."
  * "Urine output thik ache" -> "Adequate urine output."
  * "Antibiotic continue koro day 3" -> "Continue antibiotic regimen (Day 3)."
  * "Blood culture report pending ache" -> "Blood culture report pending."
  * "Mother / family ke counsel kora hoyeche" -> "Mother and family counselled regarding clinical progress and management plan."
- Examples of Hindi phrases:
  * "Patient bilkul theek hai" -> "Patient is clinically stable."
  * "Bukhar nahi hai" -> "Afebrile."
  * "Khana pee rahe hain" -> "Tolerating oral intake well."
  * "Dard kam ho gaya hai" -> "Pain significantly subsided."
  * "Parivaar ko samjha diya hai" -> "Attendants counselled."
- RULE: Accurately translate all non-English vernacular descriptions into standard, professional, clinical English medical terminology suitable for a formal hospital IPD chart.

2. MEDICAL PHONETIC CORRECTIONS & ACRONYMS:
- The text originates from voice speech recognition in Indian clinical settings. Correct obvious phonetic mishearings using clinical knowledge:
  * "free maturity", "pre maturity" = Prematurity
  * "pwp", "peep 5", "p 5" = PEEP 5 cmH2O
  * "fio2", "fio225%" = FiO2 25%
  * "spy to", "spot 95", "s p o 2" = SpO2 95%
  * "bp 62 by 38" = BP 62/38 mmHg; "bp 120 by 80" = BP 120/80 mmHg
  * "crt less than 2 seconds" = CRT < 2 sec
  * "ml part kg birthday", "ml per kg per day" = ml/kg/day
  * "with you in output", "with you do not put" = urine output
  * "ebm" = EBM (Expressed Breast Milk)
  * "tpn" = TPN
  * "cxr" = CXR (Chest X-Ray)
  * "crp", "c r p", "crpc" = CRP
  * "dextrous", "discount" = Dextrose
  * "amoxy clav" = Amoxicillin-Clavulanate
  * "genta" = Gentamicin
  * "cefotax", "cef tax" = Cefotaxime
  * "mero" = Meropenem
  * "vanco" = Vancomycin
  * "pip taz" = Piperacillin-Tazobactam
  * "amika" = Amikacin

3. CLINICAL ACCURACY & INTEGRITY:
- Use ONLY facts, observations, and values the doctor explicitly stated. Never invent, hallucinate, assume, or infer any lab value, vital sign, dosage, or diagnosis.
- Preserve every exact number, percentage, dosage, and unit as spoken.
- If an utterance is unintelligible or ambiguous, keep the original heard words followed by " [?]" so the doctor can review and edit it before signing.

4. OUTPUT FORMAT:
- Return ONLY ONE valid JSON object with the keys defined below.
- Do NOT include markdown code blocks, backticks, or explanatory text.
- Include ONLY the keys that have actual content; leave out empty ones or assign empty strings.

KEYS AND MEANINGS:
${Object.entries(FIELDS).map(([k, v]) => `"${k}": ${v}`).join("\n")}`;

async function sortText(text) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 3000,
      system: SYSTEM,
      messages: [{ role: "user", content: text }]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error((data.error && data.error.message) || "Anthropic AI service error: " + response.statusText);
  }

  // Filter for text blocks (handles thinking / structured output blocks cleanly)
  const textBlocks = (data.content || [])
    .filter(b => b.type === "text")
    .map(b => b.text || "")
    .join("");

  const startIdx = textBlocks.indexOf("{");
  const endIdx = textBlocks.lastIndexOf("}");
  if (startIdx === -1 || endIdx === -1) {
    throw new Error("Could not parse AI response as JSON.");
  }

  const jsonStr = textBlocks.slice(startIdx, endIdx + 1);
  const parsed = JSON.parse(jsonStr);

  const fields = {};
  Object.keys(FIELDS).forEach(k => {
    if (typeof parsed[k] === "string" && parsed[k].trim()) {
      fields[k] = parsed[k].trim();
    }
  });

  return fields;
}

const handler = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Not logged in" });

    // Validate Supabase session token
    const u = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + token }
    });
    if (!u.ok) return res.status(401).json({ error: "Login expired. Please log in again." });

    const text = String((req.body && req.body.text) || "").slice(0, 12000);
    if (!text.trim()) return res.status(400).json({ error: "No dictation text received." });

    const fields = await sortText(text);
    return res.status(200).json({ fields });
  } catch (e) {
    return res.status(500).json({ error: "Could not process note: " + e.message });
  }
};

module.exports = handler;
module.exports.sortText = sortText;
module.exports.FIELDS = FIELDS;
