export const WARDS = [
  "NICU 1", "NICU 2", "PICU", "CW-CTVS", "A2", "A3", "B1", "B2", "B3",
  "C2", "C3", "C5", "PWM", "PWS", "GE", "CW", "EXT CW", "HDU I", "CCU", "ICU", "HDUII"
];

export const GEOTAG_SLOTS = [
  "Patient Photo", "Registration Photos", "Before Procedure",
  "During Procedure", "After Procedure", "Discharge Photo"
];

export const OT_DAILY_SLOTS = ["Patient Photo", "IPD Chart", "Drug Chart", "TPRB Chart"];
export const PROCEDURE_SLOTS = ["Before Procedure", "During Procedure", "After Procedure"];

export const REQUIRED_SLOTS: Record<string, string[]> = {
  Medicine: ["Patient Photo", "IPD Chart", "Drug Chart", "TPRB Chart"],
  OT: ["Before Procedure", "During Procedure", "After Procedure"],
  Dialysis: ["Before Procedure", "During Procedure", "After Procedure"],
  Chemo: ["Before Procedure", "During Procedure", "After Procedure"]
};

export const DOCTOR_UNIT_GROUPS = [
  { specialty: "ENT", units: [
    { value: "ENT1", label: "DR. RANJAN ROYCHOWDHURY / DR. SOURAV NASKAR / DR. PINAKI MAJUMDER" },
    { value: "ENT2", label: "DR. AMITABHA ROYCHOWDHURY / DR. SOUMITRA GHOSH / DR. USHIRIN BOSE" },
    { value: "ENT3", label: "DR. KOUSHIK MONDAL / DR. SOURABH GUPTA" }
  ]},
  { specialty: "GYNAE", units: [
    { value: "GYN1", label: "DR. KRISHNENDU GUPTA / DR. ARUNABHA DAS" },
    { value: "GYN2", label: "DR. SAJAL DUTTA / DR. ABHIJIT GHOSH / DR. BABITA SAHA" },
    { value: "GYN3", label: "DR. SUKANTA MISRA / DR. ASHISH SEAL / DR. SOHINI CHOWDHURY" },
    { value: "GYN4", label: "DR. SIBANI SENGUPTA / DR. SHUBHROJJWAL SAHA" },
    { value: "GYN5", label: "DR. PARTHO SEN / DR. SUKUMAR SINHA / DR. CHIRANJIB MAJI" },
    { value: "GYN6", label: "DR. GOUTAM GIRI" }
  ]},
  { specialty: "ORTHO", units: [
    { value: "ORTHO1", label: "DR. KAUSHIK SARKAR / DR. KANAILAL JANA" },
    { value: "ORTHO2", label: "DR. PRASANTA KR. PUJARI / DR. CHANDRACHUR BHATTACHERJEE" },
    { value: "ORTHO3", label: "DR. PARTHO PAL / DR. JAYABRATA GHOSH" }
  ]},
  { specialty: "PAED-MEDICINE", units: [
    { value: "PAEDMED1", label: "DR. SOUMITRA MASANI / DR. BAPPADITYA DAS" },
    { value: "PAEDMED2", label: "DR. TAPABRATA CHATTERJEE / DR. APARNA MITRA / DR. NISHA BHATTACHARYYA" },
    { value: "PAEDMED3", label: "DR. SUMITA BASU / DR. KUNAL MUKHERJEE / DR. SAUGATA BHATTACHARYYA" },
    { value: "PAEDMED4", label: "DR. BRAJAGOPAL RAY / DR. SANTANU BAG" },
    { value: "PAEDMED5", label: "DR. SADHNA SAHA / DR. SUPARNA GUHA / DR. ASHA MUKHERJEE" },
    { value: "PAEDMED6", label: "DR. NEENA GHOSE / DR. KAUSIK SUR" }
  ]},
  { specialty: "GEN-SURGERY", units: [
    { value: "GENSURG1", label: "DR. ACHINTYA KUMAR DAS / DR. SHIVAJI MANDAL" },
    { value: "GENSURG2", label: "DR. PRATIP SENGUPTA / DR. SUNITI KR. HAJRA" },
    { value: "GENSURG3", label: "DR. DHRUBAJYOTI BHAUMIK" },
    { value: "GENSURG4", label: "DR. ZAYD ASHOK RAHMAN / DR. JOYDEEP GHOSH" },
    { value: "GENSURG5", label: "DR. SURYASISH SENGUPTA" },
    { value: "GENSURG6", label: "DR. KALYAN ASHIS MUKHERJEE / DR. DEBAYAN CHOWDHURY" }
  ]},
  { specialty: "UROLOGY", units: [
    { value: "URO1", label: "DR. ANJAN DAS / DR. HIMADRI PATHAK / DR. BIMALESH PURKAIT" },
    { value: "URO2", label: "DR. PRITHWIRAJ GHOSAL / DR. KOUSHIK SARKAR / DR. CHAYAN PAIK / DR. KALYAN SARKAR" }
  ]},
  { specialty: "GEN. MEDICINE", units: [
    { value: "GENMED1", label: "DR. PRADEEP CHAKRABARTY / DR. SUJATA MAZUMDAR / DR. SHYAMOSREE MONDAL" },
    { value: "GENMED2", label: "DR. AMITAVA MAZUMDAR / DR. UJJAL KR CHAKRAVARTY" },
    { value: "GENMED3", label: "DR. TANMOY CHATTOPADHYAY / DR. SHYAMOSREE MONDAL" },
    { value: "GENMED4", label: "DR. SUJOY ROYCHOWDHURY / DR. PRABUDHA MUKHOPADHYAY / DR. PARTHAJIT DAS / DR. PINAKI BANERJEE" },
    { value: "GENMED5", label: "DR. BISWANATH PATRA / DR. SANDIPAN MUKHERJEE" },
    { value: "GENMED6", label: "DR. TAPAS LAHA / DR. BARUN GHORUI" }
  ]},
  { specialty: "DIA & ENDOCRINE", units: [
    { value: "DIAEND1", label: "DR. AJITESH ROY" },
    { value: "DIAEND2", label: "DR. DEBAJYOTI CHAKRABORTY" }
  ]},
  { specialty: "CARDIOLOGY", units: [
    { value: "CARDIO1", label: "DR. SUKUMAR GHOSH / DR. BISWARUP SARKAR" },
    { value: "CARDIO2", label: "DR. SOUMITRA KUMAR / DR. SAUBHIK KANJILAL / DR. ABHINAY TIBDEWAL" },
    { value: "CARDIO3", label: "DR. MANOJIT LODHA / DR. SANTANU DE / DR. MOUSUMI KUNDU" }
  ]},
  { specialty: "GASTRO-ENTEROLOGY", units: [
    { value: "GASTRO1", label: "DR. DEBAJYOTI CHAKRABORTY" },
    { value: "GASTRO2", label: "DR. SUDIPTA GHOSH" }
  ]},
  { specialty: "NEURO.SUR", units: [
    { value: "NEUROSUR1", label: "DR. RAHUL SAHA" }
  ]},
  { specialty: "MAXILOFACIAL", units: [
    { value: "MAXFAC1", label: "DR. SUMAN DAS" }
  ]},
  { specialty: "PLASTIC SURGERY", units: [
    { value: "PLASTIC1", label: "DR. PRASANTA BHATTACHARYA" }
  ]},
  { specialty: "PAED.SUR", units: [
    { value: "PAEDSUR1", label: "DR. D MITRA / DR. SANGHAMITRA BHATTACHARYA" },
    { value: "PAEDSUR2", label: "DR. UTPAL ROY / DR. ANEEK ROY CHOWDHURY" }
  ]}
];

export function doctorUnitLabel(code?: string | null): string {
  if (!code) return "Not assigned";
  for (const g of DOCTOR_UNIT_GROUPS) {
    const u = g.units.find((x) => x.value === code);
    if (u) return u.label;
  }
  return code;
}

export interface ClinicalSectionDef {
  key: string;
  label: string;
  group?: string;
}

export const NICU_SECTIONS: ClinicalSectionDef[] = [
  { key: "background", label: "Background / Admission problem or diagnosis" },
  { key: "current_problems", label: "Current problems" },
  { key: "progress", label: "Progress in last 24 hr" },
  { key: "respiration", label: "Respiration / resp support / blood gas / CXR" },
  { key: "cvs", label: "CVS (HR, CRT, BP, femoral, auscultation)" },
  { key: "abdomen", label: "Abdomen" },
  { key: "fluid_total", label: "Fluid total (ml/kg/d)" },
  { key: "iv_pn", label: "IV / PN, type, urine output (ml/kg/d)" },
  { key: "enteral", label: "Enteral (NG/Oral), type, amount (ml/kg/d), aspirate / vomiting" },
  { key: "wt_stool", label: "Weight gain / Stool" },
  { key: "hematology", label: "Hematology and jaundice" },
  { key: "cns", label: "CNS (AF / OFC / head US with date)" },
  { key: "sepsis", label: "Sepsis (date of diagnosis), antibiotics with day" },
  { key: "cultures", label: "Blood c/s, CSF, others" },
  { key: "investigations", label: "Investigations (hemogram, biochemistry)" },
  { key: "communication", label: "Communication" },
  { key: "impression", label: "Impression" },
  { key: "plan", label: "Plan" },
  { key: "other", label: "Other notes" }
];

export const ADULT_SECTIONS: ClinicalSectionDef[] = [
  { key: "complaints", label: "Complaints / symptoms since last review", group: "COMPLAINT + EXAMINATION" },
  { key: "vitals", label: "Vitals: Temp, Pulse, BP, RR, SpO2 (with O2 support)", group: "COMPLAINT + EXAMINATION" },
  { key: "grbs_io", label: "GRBS, intake / output, urine output", group: "COMPLAINT + EXAMINATION" },
  { key: "general", label: "General condition, consciousness (GCS), pallor / icterus / edema", group: "COMPLAINT + EXAMINATION" },
  { key: "cvs", label: "CVS", group: "COMPLAINT + EXAMINATION" },
  { key: "rs", label: "Respiratory system (RS)", group: "COMPLAINT + EXAMINATION" },
  { key: "abdomen", label: "Abdomen (P/A)", group: "COMPLAINT + EXAMINATION" },
  { key: "cns", label: "CNS", group: "COMPLAINT + EXAMINATION" },
  { key: "local", label: "Local / surgical site / wound / drain", group: "COMPLAINT + EXAMINATION" },
  { key: "reports", label: "New investigation reports (blood, ECG, imaging)", group: "COMPLAINT + EXAMINATION" },
  { key: "diagnosis", label: "Diagnosis / impression", group: "ASSESSMENT" },
  { key: "medications", label: "Medications (drug, dose, route, frequency; antibiotics with day)", group: "ADVICE / TREATMENT" },
  { key: "fluids_diet", label: "IV fluids and diet", group: "ADVICE / TREATMENT" },
  { key: "icu_support", label: "Oxygen / ventilator / inotropes / sedation / lines and tubes", group: "ADVICE / TREATMENT" },
  { key: "inv_advised", label: "Investigations advised", group: "ADVICE / TREATMENT" },
  { key: "nursing", label: "Nursing care and monitoring", group: "ADVICE / TREATMENT" },
  { key: "referral", label: "Referral / consultation", group: "ADVICE / TREATMENT" },
  { key: "plan", label: "Plan / further management / discharge plan", group: "ADVICE / TREATMENT" },
  { key: "communication", label: "Communication with relatives / consent", group: "ADVICE / TREATMENT" },
  { key: "other", label: "Other notes", group: "ADVICE / TREATMENT" }
];

export function istTodayStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function parseUTC(dateStr?: string | null): Date {
  if (!dateStr) return new Date();
  let s = dateStr;
  if (!s.endsWith("Z") && !s.includes("+")) s += "Z";
  return new Date(s);
}
