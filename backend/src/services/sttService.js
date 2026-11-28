const config = require("../config/env");

const TERMS_NICU = [
  "PEEP","FiO2","SpO2","CPAP","HFNC","NIV","ventilator","surfactant","caffeine","CRT","EBM","TPN","OGT","NG feeds",
  "phototherapy","bilirubin","CRP","WBC","platelets","hemogram","hemoglobin","creatinine","sodium","potassium","calcium",
  "dextrose","GIR","urine output","ml/kg/day","antibiotics","ampicillin","gentamicin","amikacin","cefotaxime","meropenem",
  "vancomycin","piperacillin","tazobactam","fluconazole","acyclovir","prematurity","respiratory distress syndrome",
  "bronchopulmonary dysplasia","necrotizing enterocolitis","sepsis","apnea","jaundice","hypoglycemia",
  "patent ductus arteriosus","intraventricular hemorrhage","retinopathy of prematurity","kangaroo mother care",
  "birth asphyxia","hypoxic ischemic encephalopathy","anterior fontanelle","head ultrasound","chest X-ray","blood gas",
  "respiratory acidosis","metabolic acidosis","lactate","blood culture","CSF","OFC","femoral pulses","aspirate","vomiting",
  "stool","weight gain","gestational age","central line","UVC","PICC","nasal prongs","room air","oxygen saturation",
  "heart rate","respiratory rate","blood pressure","capillary refill time"
];

const TERMS_ADULT = [
  "afebrile","febrile","GRBS","ECG","troponin","creatinine","urea","hemoglobin","TLC","platelets","CRP","LFT","RFT","sodium","potassium",
  "GCS","pallor","icterus","edema","tachycardia","bradycardia","crepitations","rhonchi","wheeze","bowel sounds",
  "hepatomegaly","splenomegaly","ascites","Foley catheter","RT feed","central line","ventilator","BiPAP","CPAP",
  "noradrenaline","dopamine","dobutamine","midazolam","fentanyl","pantoprazole","ceftriaxone","piperacillin","tazobactam",
  "meropenem","metronidazole","paracetamol","ondansetron","insulin","heparin","enoxaparin","aspirin","clopidogrel",
  "atorvastatin","furosemide","normal saline","Ringer lactate","dextrose","NPO","SOS","stat","BD","TDS","SpO2","room air",
  "blood pressure","pulse","respiratory rate","temperature","chest X-ray","CT scan","ultrasound","post operative day",
  "dressing","drain","suture removal","discharge","antibiotics","day three","day five"
];

async function callDeepgram(buf, mime, model, lang, terms) {
  const qs = [
    `model=${encodeURIComponent(model)}`,
    `language=${encodeURIComponent(lang || "multi")}`,
    "smart_format=true",
    "punctuate=true"
  ]
    .concat(terms.slice(0, 75).map(t => `keyterm=${encodeURIComponent(t)}`))
    .join("&");

  return fetch(`https://api.deepgram.com/v1/listen?${qs}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${config.deepgramApiKey}`,
      "Content-Type": mime || "audio/webm"
    },
    body: buf
  });
}

async function transcribeAudio({ audioBase64, mime, chart = "nicu", language = "multi" }) {
  if (!config.deepgramApiKey) {
    throw new Error("DEEPGRAM_API_KEY is not configured.");
  }

  const buf = Buffer.from(audioBase64, "base64");
  const cleanMime = String(mime || "audio/webm").split(";")[0];
  const terms = chart === "adult" ? TERMS_ADULT : TERMS_NICU;
  const primaryModel = config.deepgramModel || "nova-3";

  let r = await callDeepgram(buf, cleanMime, primaryModel, language, terms);

  // Fallback if model/language options are rejected
  if (!r.ok && (r.status === 400 || r.status === 404)) {
    r = await callDeepgram(buf, cleanMime, "nova-3", language, terms);
  }
  if (!r.ok && (r.status === 400 || r.status === 404)) {
    r = await callDeepgram(buf, cleanMime, "nova-2", language === "multi" ? "en" : language, terms);
  }

  const j = await r.json();
  if (!r.ok) {
    throw new Error(j.err_msg || j.message || "Speech service error");
  }

  const alt = j.results?.channels?.[0]?.alternatives?.[0];
  return {
    text: (alt && alt.transcript) || "",
    detectedLanguage: j.results?.channels?.[0]?.detected_language || language,
    confidence: alt?.confidence || null
  };
}

module.exports = { transcribeAudio, TERMS_NICU, TERMS_ADULT };
