# RKMSP Clinical Suite & Digital Clinical Scribe

**Ramakrishna Mission Seva Pratishthan (RKMSP) &bull; Vivekananda Institute of Medical Sciences**  
*Ayushman Bharat (PM-JAY) Clinical Operations & IPD Scribe Network*

---

## 🌟 Overview
RKMSP Clinical Suite is a comprehensive clinical hospital web application designed for doctors, nursing supervisors, and MRD administrators. It streamlines inpatient rounds, patient census tracking, and digitalizes daily clinical records.

### Key Capabilities
- **Digital Clinical Round Scribe (Voice AI)**: Replaces physical paper clinical notes. Doctors dictate daily rounds in **English, Bengali, Hindi, or code-switched mix** (Benglish / Hinglish). Multilingual Deepgram Nova-3 STT captures the speech, and Claude AI structures the notes into standardized medical English fields.
- **Doctor Digital Verification & Signature**: Doctors review, edit, and sign notes directly via a digital signature canvas with auto-saving credentials for subsequent rounds.
- **Official Hospital Letterhead PDF**: Generates formatted RKMSP IPD Progress Notes with patient demographics, structured clinical observations, and digital signatures.
- **Automated Cloud Synchronization**: Uploads PDFs directly to Supabase storage (`patient-photos`) and links them under the patient's daily `IPD Chart` record.
- **Ward Module**: Ward-wise patient census with direct 1-click access to clinical rounds.
- **Patient Data Module**: Census management, MRD searches, and 4 daily documentation slots (Patient Photo, IPD Chart / Clinical Note, Drug Chart / Medicine Card, TPRB Chart).
- **Diagnostic Module**: Integration interface for upcoming laboratory and imaging feeds.

---

## 📁 Project Structure

```
rkm-ward-app/
├── .env                         # Environment variables (Anthropic, Deepgram, Supabase)
├── .env.example                 # Template for environment configuration
├── .gitignore                   # Excludes secrets, node_modules, and logs
├── package.json                 # Node.js dependencies and scripts
├── server.js                    # Express server (serves static files & API routes)
├── vercel.json                  # Vercel serverless deployment config
│
├── api/                         # Backend Serverless Endpoints
│   ├── transcribe.js            # Multilingual Deepgram Nova-3 STT with medical keyterms
│   ├── sort.js                  # Claude AI Agent (multilingual parsing & clinical structuring)
│   └── health.js                # System & service health check endpoint
│
├── public/                      # Static Assets & Shared UI Libraries
│   └── assets/
│       ├── css/
│       │   └── modern-theme.css # Clinical UI design system & CSS variables
│       ├── js/
│       │   └── icons.js         # Accessible vector SVG medical icon library
│       └── icons/               # PWA and hospital app icons
│
├── index.html                   # Portal Dashboard & Staff Login (Polished, no emojis)
├── ward.html                    # Ward Module (Census & direct link to rounds)
├── ward-list.html               # Printable ward census
├── patient-list.html            # Patient Census & MRD Search
├── patient.html                 # Patient Record Details & Daily Slots (Voice Scribe enabled)
├── clinical-note.html           # Full-featured Multilingual Voice Clinical Note Scribe
├── nicu.html                    # Backward-compatible redirect to clinical-note.html
└── diagnostic.html              # Diagnostic Module interface
```

---

## ⚙️ Configuration & Environment Variables

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Ensure your `.env` contains:
```env
ANTHROPIC_API_KEY=sk-ant-usr-...
ANTHROPIC_MODEL=claude-haiku-5-5

DEEPGRAM_API_KEY=3c1e93...
DEEPGRAM_MODEL=nova-3

SUPABASE_URL=https://cqjqewlzxebszpnqhmev.supabase.co
SUPABASE_KEY=sb_publishable_rTd12RguCfNQYezz4febZA_xuIJW3OM

PORT=3000
```

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Start local server
npm start
```

Visit: `http://localhost:3000`

---

## 🎙️ Speech-to-Text & AI Architecture

1. **Audio Capture**: Browser MediaRecorder captures audio at 32 kbps (Opus/WebM).
2. **Deepgram Nova-3 Multilingual**:
   - `language=multi` automatically transcribes code-switching between English, Bengali, and Hindi.
   - Medical `keyterm` prompting boosts accuracy on acronyms (SpO2, FiO2, PEEP, CRT, EBM, TPN, CRP, etc.).
   - Browser Web Speech API fallback available when needed.
3. **Claude AI Medical Scribe**:
   - Comprehends vernacular remarks (e.g., *"kono fever nei"*, *"feeds shuru hoyechhe"*, *"bukhar nahi hai"*).
   - Accurately converts observations into standard medical English documentation.
   - Preserves exact dosages, vital signs, and units without hallucination.
   - Flags uncertain or phonetically ambiguous words with `[?]`.
4. **Doctor Verification & PDF Export**:
   - Doctors check and edit all sections.
   - Doctor draws digital signature with touch or mouse.
   - Official RKMSP letterhead PDF is generated and auto-saved to Supabase.
