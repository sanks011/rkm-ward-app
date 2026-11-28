const config = require("../config/env");

const FIELDS_NICU = {
  background: "Background / admission problem or diagnosis",
  current_problems: "Current problems",
  progress: "Progress in last 24 hours",
  respiration: "Respiration, respiratory support, blood gas, chest X-ray",
  cvs: "Cardiovascular: HR, CRT, BP, femoral pulses, auscultation",
  abdomen: "Abdomen examination",
  fluid_total: "Total fluid (ml/kg/day)",
  iv_pn: "IV fluid / parenteral nutrition, type, urine output (ml/kg/day)",
  enteral: "Enteral feeds (NG/oral), type, amount (ml/kg/day), aspirate, vomiting",
  wt_stool: "Weight gain and stool",
  hematology: "Hematology and jaundice (bilirubin, phototherapy)",
  cns: "CNS: anterior fontanelle, OFC, head ultrasound with date",
  sepsis: "Sepsis: date of diagnosis, antibiotics with day number",
  cultures: "Blood culture, CSF, other cultures",
  investigations: "Investigations: hemogram, biochemistry",
  communication: "Communication with parents / family",
  impression: "Impression",
  plan: "Plan",
  other: "Anything stated that fits no other field",
  current_weight: "Current weight of the baby with unit"
};

const FIELDS_ADULT = {
  complaints: "Complaints and symptoms since last review",
  vitals: "Vitals: temperature, pulse, BP, respiratory rate, SpO2 and any oxygen support",
  grbs_io: "GRBS (blood sugar), intake, output, urine output",
  general: "General condition, consciousness or GCS, pallor, icterus, edema",
  cvs: "Cardiovascular examination",
  rs: "Respiratory system examination",
  abdomen: "Abdomen (per abdomen) examination",
  cns: "Central nervous system examination",
  local: "Local examination, surgical site, wound, drain",
  reports: "New investigation reports: blood tests, ECG, imaging",
  diagnosis: "Diagnosis or clinical impression",
  medications: "Medications: drug, dose, route, frequency; antibiotics with day number",
  fluids_diet: "IV fluids and diet",
  icu_support: "Oxygen, ventilator, inotropes, sedation, lines and tubes (ICU / CCU)",
  inv_advised: "Investigations advised",
  nursing: "Nursing care, monitoring, precautions",
  referral: "Referral or consultation",
  plan: "Plan, further management, discharge plan",
  communication: "Communication with relatives, consent",
  other: "Anything stated that fits no other field"
};

const MULTILINGUAL_RULES = `
MULTILINGUAL & CODE-SWITCHING COMPREHENSION:
- The doctor may speak in English, Bengali, Hindi, Hinglish, Benglish, or mixed speech (e.g. "Ajke baby stable ache, kono fever nei", "Room air e SpO2 98%", "Feeds shuru hoyeche EBM 10 ml 2 hourly, vomiting nei", "Mother ke sob bojhano hoyeche", "Patient ko bukhar nahi hai, khana le raha hai").
- Accurately understand and translate all Bengali/Hindi vernacular observations into standard, concise, professional medical English charting language.
- Never alter numbers, units, drug names, or day counts.`;

const SYSTEM_NICU = `You sort a doctor's dictated or typed neonatal/pediatric ward note into fields.
Rules:
- Use ONLY information the doctor actually stated. Never invent, infer, calculate or add any value, diagnosis, dose or advice.
${MULTILINGUAL_RULES}
- The text comes from speech recognition (Indian-accented English / multilingual) in a neonatal/pediatric ward, so correct obvious mishearings using NICU knowledge. Examples: "free maturity"/"pre maturity" = prematurity; "pwp", "peep" = PEEP; "fio2", "fio225%" = FiO2 (so "fio225%" = FiO2 25%); "spy to", "spo2", "s p o 2" = SpO2; "BP 62 by 38" = BP 62/38; "ml part kg birthday", "ml per kg birthday", "ml per kg per day" = ml/kg/day; "with you in output" = urine output; "ebm" = EBM; "tpn" = TPN; "cxr" = CXR; "CRT less than 2 seconds" = CRT <2 sec.
- Keep every number and unit exactly as spoken. Never guess a number.
- More mishearings: "a5", "pwp 5", "p 5" near FiO2 or SpO2 usually = PEEP 5; "spot 95", "spy to 95" = SpO2 95%; "if i go to", "if i o two", "f i o" = FiO2; "discount", "dextrous" = dextrose; "antivirus" in a plan = antibiotics [? antibiotics]; "tennis to" or "plan to" before treatment advice = Plan; "crpc", "c r p" = CRP; "kg birthday", "particle birthday" after ml = ml/kg/day; "with you do not put" = urine output.
- Doctors may say full words: "oxygen saturation" = SpO2, "heart rate" = HR, "respiratory rate" = RR, "capillary refill time" = CRT, "blood pressure" = BP, "positive end expiratory pressure" = PEEP. Use the standard abbreviation.
- Placement hints: RR, SpO2, PEEP, PIP, FiO2, ventilator, CPAP, HFNC, room air, blood gas, chest X-ray go to respiration. HR, CRT, BP, pulses, heart sounds go to cvs. WBC, platelets, Hb, CRP, sodium, potassium, creatinine go to investigations. Bilirubin, jaundice, phototherapy go to hematology. Orders such as continue, stop or start a drug go to plan.
- When a heard word is unclear: correct it ONLY if it is one of the well-known mishearings above or clearly the only sensible reading; then write the corrected form followed by what you heard, like this: FiO2 25% [? heard: "if i go to 25%"]. If you cannot tell which lab test, drug or term was meant, do NOT choose one: keep exactly what you heard and mark it, like this: Betting 1.1 [? unclear word, heard "Betting"]. Never pick between several possible tests, drugs or diagnoses on your own. A bare group of numbers with no label that you cannot place goes into "other" with [?].
- If a phrase is unclear and you cannot confidently correct it, keep the original words and add " [?]" right after it so the doctor can check it.
- If a field is not mentioned, return an empty string for it.
- If something stated fits no field, put it in "other".
- Reply with ONE JSON object only, no markdown, no commentary. Include ONLY the keys that have content and leave out empty ones. Keys and their meaning:
${Object.entries(FIELDS_NICU).map(([k, v]) => `"${k}": ${v}`).join("\n")}`;

const SYSTEM_ADULT = `You sort a doctor's dictated or typed note for an ADULT inpatient (general ward, ICU or CCU) into the fields of a hospital IPD progress note / treatment sheet.
Rules:
- Use ONLY information the doctor actually stated. Never invent, infer, calculate or add any value, diagnosis, dose or advice.
${MULTILINGUAL_RULES}
- Keep the doctor's wording, numbers and units exactly. Never guess a number.
- The text comes from speech recognition (Indian-accented English / multilingual), so correct obvious mishearings using clinical knowledge. Examples: "grbs", "g r b s" = GRBS; "BP 120 by 80" = BP 120/80; "spy to", "spot 95" = SpO2 95%; "bd", "b d" = BD; "tds", "t d s" = TDS; "s o s" = SOS; "n p o" = NPO; "r t feed" = RT feed; "tab" = Tab.; "inj" = Inj.; "ecg" = ECG; "cbc" = CBC; "septioxane", "ceftrioxone", "sef tri axone" = ceftriaxone.
- Placement hints: temperature, pulse, BP, RR, SpO2 go to vitals. Blood sugar, intake, output, urine output go to grbs_io. Heart sounds, murmurs go to cvs. Air entry, crepitations, rhonchi, wheeze go to rs. Soft, tender, distension, bowel sounds go to abdomen. Hb, TLC, platelets, urea, creatinine, sodium, potassium, LFT, CRP, ECG findings, X-ray, CT, USG results go to reports. Drug names with doses and orders to continue, stop or start a drug go to medications. Oxygen, ventilator settings, BiPAP, noradrenaline, sedation, central line, Foley, RT go to icu_support. Tests to be done go to inv_advised.
- If a field is not mentioned, leave it out. If something stated fits no field, put it in "other".
- When a heard word is unclear: correct it ONLY if it is one of the well-known mishearings above or clearly the only sensible reading; then write the corrected form followed by what you heard, like this: FiO2 25% [? heard: "if i go to 25%"]. If you cannot tell which lab test, drug or term was meant, do NOT choose one: keep exactly what you heard and mark it, like this: Betting 1.1 [? unclear word, heard "Betting"]. Never pick between several possible tests, drugs or diagnoses on your own. A bare group of numbers with no label that you cannot place goes into "other" with [?].
- Reply with ONE JSON object only, no markdown, no commentary. Include ONLY the keys that have content. Keys and their meaning:
${Object.entries(FIELDS_ADULT).map(([k, v]) => `"${k}": ${v}`).join("\n")}`;

async function sortClinicalText(text, chart = "nicu", onlyKey = "") {
  if (!config.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const FIELDS = chart === "adult" ? FIELDS_ADULT : FIELDS_NICU;
  const SYSTEM0 = chart === "adult" ? SYSTEM_ADULT : SYSTEM_NICU;
  const SYSTEM =
    onlyKey && FIELDS[onlyKey]
      ? SYSTEM0 +
        `\n- IMPORTANT: The doctor is now dictating ONLY the content of ONE field: "${onlyKey}" (${FIELDS[onlyKey]}). Put everything into that single key, cleaned by the rules above, and use no other key.`
      : SYSTEM0;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.anthropicApiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: config.anthropicModel || "claude-haiku-5-5",
      max_tokens: 2400,
      system: SYSTEM,
      messages: [{ role: "user", content: text }]
    })
  });

  const j = await r.json();
  if (!r.ok) {
    throw new Error((j.error && j.error.message) || "AI service error");
  }

  const out = (j.content || [])
    .filter(b => b.type === "text")
    .map(b => b.text || "")
    .join("");

  const startIdx = out.indexOf("{");
  const endIdx = out.lastIndexOf("}");
  if (startIdx === -1 || endIdx === -1) {
    throw new Error("AI response did not return valid structured JSON.");
  }

  const parsed = JSON.parse(out.slice(startIdx, endIdx + 1));
  const fields = {};
  Object.keys(FIELDS)
    .filter(k => !onlyKey || k === onlyKey)
    .forEach(k => {
      if (typeof parsed[k] === "string" && parsed[k].trim()) {
        fields[k] = parsed[k].trim();
      }
    });

  return fields;
}

module.exports = { sortClinicalText, FIELDS_NICU, FIELDS_ADULT };
