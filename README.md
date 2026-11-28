# RKMSP Clinical Suite

**Ramakrishna Mission Seva Pratishthan (RKMSP) &bull; Vivekananda Institute of Medical Sciences**  
*Next.js PWA Frontend + Secure Express Backend (MongoDB, Supabase, Deepgram Nova-3, Claude AI)*

---

## Architecture

The codebase is cleanly separated into two independent applications:

```
rkm-ward-app/
├── frontend/                     # Next.js 14 App Router + Tailwind CSS + PWA
│   ├── public/
│   │   ├── manifest.json         # Installable PWA manifest
│   │   ├── sw.js                 # Offline service worker
│   │   └── icons/                # App & Apple Touch icons
│   └── src/
│       ├── app/
│       │   ├── page.tsx          # Staff Login & 3-Module Dashboard
│       │   ├── ward/             # Ward Module (live patient counts & bedside rounds)
│       │   ├── ward-list/        # Printable Ward-wise Patient Census
│       │   ├── patients/         # Patient Data Module (search, filters, CSV, deleted restore)
│       │   ├── patient/          # Patient Chart (4 daily slots, geotagging, offline queue, admin)
│       │   ├── clinical-notes/   # Multilingual Voice AI Clinical Scribe (NICU + Adult templates)
│       │   ├── nicu/             # Alias route for clinical-notes
│       │   ├── enhancement/      # 48h Enhancement Tracker (Medicine)
│       │   └── diagnostic/       # Diagnostic Module preview
│       ├── components/           # AppHeader (PWA install), AuthGuard, PdfPreviewModal, SignaturePad
│       └── lib/                  # Supabase client, constants, API client, IndexedDB offline queue, PDF builders
│
└── backend/                      # Express.js API Server + MongoDB + Security Layer
    ├── server.js                 # Helmet, CORS, Rate Limiting, MongoDB connection
    ├── src/
    │   ├── config/               # env.js, db.js
    │   ├── middleware/           # Supabase JWT verification, safe error handler
    │   ├── models/               # Mongoose schemas (Patient, DailyPhoto, ClinicalChart, Histories, etc.)
    │   ├── services/             # Deepgram Nova-3 STT & Claude Haiku 5.5 Clinical Scribe
    │   └── routes/               # /api/health, /api/transcribe, /api/sort, /api/charts, /api/patients
    └── scripts/
        └── migrate-supabase-to-mongo.js  # Idempotent Supabase text -> MongoDB migration script
```

---

## Running Locally

### 1. Start the Express Backend (Port 5000)
```bash
cd backend
npm install
npm start
```

### 2. Start the Next.js Frontend (Port 3000)
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` (Next.js automatically proxies `/api/*` requests to `http://localhost:5000/api/*`).

---

## Migrating Supabase Text Data to MongoDB

Binary files (PDFs & photos) remain stored in **Supabase Storage** (`patient-photos`), while all text records (`Patients`, `daily_photos` metadata, `nicu_charts`, `ward_history`, `category_history`, `enhancement_log`, `los_reference`, `staff_roles`) can be synced to MongoDB via:

```bash
cd backend
npm run migrate
```
