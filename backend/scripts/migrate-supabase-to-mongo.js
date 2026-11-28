/**
 * Idempotent Migration Script: Supabase (PostgreSQL Text Data) -> MongoDB Atlas
 *
 * Fetches all text/metadata records from Supabase tables and upserts them into
 * MongoDB collections. Binary files (PDFs & photos) stay in Supabase Storage,
 * while their metadata & storage paths are stored cleanly in MongoDB.
 *
 * Usage:
 *   cd backend && npm run migrate
 */
const config = require("../src/config/env");
const { connectDB } = require("../src/config/db");
const mongoose = require("mongoose");

const Patient = require("../src/models/Patient");
const DailyPhoto = require("../src/models/DailyPhoto");
const ClinicalChart = require("../src/models/ClinicalChart");
const WardHistory = require("../src/models/WardHistory");
const CategoryHistory = require("../src/models/CategoryHistory");
const EnhancementLog = require("../src/models/EnhancementLog");
const LosReference = require("../src/models/LosReference");
const StaffRole = require("../src/models/StaffRole");

async function fetchAllFromSupabase(table) {
  const pageSize = 1000;
  let offset = 0;
  let allRows = [];

  while (true) {
    const url = `${config.supabaseUrl}/rest/v1/${table}?select=*&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, {
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`
      }
    });

    if (res.status === 404) {
      console.warn(`[Migration] Table "${table}" not found in Supabase, skipping.`);
      return [];
    }
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to fetch ${table}: ${res.status} ${errText}`);
    }

    const rows = await res.json();
    allRows = allRows.concat(rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return allRows;
}

async function migrate() {
  const conn = await connectDB();
  if (!conn) {
    console.error("[Migration] Aborted: could not connect to MongoDB.");
    process.exit(1);
  }

  console.log("[Migration] Starting Supabase -> MongoDB text data sync...");

  // 1. Patients
  const patients = await fetchAllFromSupabase("Patients");
  for (const p of patients) {
    await Patient.findOneAndUpdate(
      { mrd: String(p.mrd) },
      {
        $set: {
          mrd: String(p.mrd),
          name: p.name,
          pmjay_id: p.pmjay_id,
          ward: p.ward || "",
          bed_no: p.bed_no || "",
          doctor_unit: p.doctor_unit,
          admission_date: p.admission_date,
          patient_category: p.patient_category || "Medicine",
          los_days: p.los_days,
          los_start_date: p.los_start_date,
          is_discharged: !!p.is_discharged,
          discharged_date: p.discharged_date,
          sex: p.sex,
          dob: p.dob,
          gestational_age: p.gestational_age,
          birth_weight: p.birth_weight,
          admission_weight: p.admission_weight,
          age_text: p.age_text,
          supabase_created_at: p.created_at ? new Date(p.created_at) : null
        }
      },
      { upsert: true }
    );
  }
  console.log(`[Migration] Patients synced: ${patients.length}`);

  // 2. daily_photos (metadata only; files stay in Supabase Storage)
  const photos = await fetchAllFromSupabase("daily_photos");
  for (const ph of photos) {
    await DailyPhoto.findOneAndUpdate(
      { supabase_id: ph.id },
      {
        $set: {
          supabase_id: ph.id,
          mrd: String(ph.mrd),
          photo_date: ph.photo_date,
          photo_type: ph.photo_type,
          photo_url: ph.photo_url || "",
          file_type: ph.file_type || "pdf",
          geo_location: ph.geo_location || "",
          uploaded_by: ph.uploaded_by || "",
          uploaded_at: ph.uploaded_at ? new Date(ph.uploaded_at) : new Date()
        }
      },
      { upsert: true }
    );
  }
  console.log(`[Migration] DailyPhoto metadata synced: ${photos.length}`);

  // 3. nicu_charts (Clinical round notes)
  const charts = await fetchAllFromSupabase("nicu_charts");
  for (const c of charts) {
    await ClinicalChart.findOneAndUpdate(
      { supabase_id: c.id },
      {
        $set: {
          supabase_id: c.id,
          mrd: String(c.mrd),
          chart_date: c.chart_date,
          chart_type: c.data?.chart_type === "adult" ? "adult" : "nicu",
          data: c.data || {},
          signed_by: c.signed_by || null,
          author_email: c.author_email || ""
        }
      },
      { upsert: true }
    );
  }
  console.log(`[Migration] ClinicalCharts synced: ${charts.length}`);

  // 4. ward_history
  const wardHist = await fetchAllFromSupabase("ward_history");
  for (const h of wardHist) {
    await WardHistory.findOneAndUpdate(
      { supabase_id: h.id },
      {
        $set: {
          supabase_id: h.id,
          mrd: String(h.mrd),
          old_ward: h.old_ward || "",
          old_bed: h.old_bed || "",
          new_ward: h.new_ward || "",
          new_bed: h.new_bed || "",
          changed_by: h.changed_by || "",
          changed_at: h.changed_at ? new Date(h.changed_at) : new Date()
        }
      },
      { upsert: true }
    );
  }
  console.log(`[Migration] WardHistory synced: ${wardHist.length}`);

  // 5. category_history
  const catHist = await fetchAllFromSupabase("category_history");
  for (const h of catHist) {
    await CategoryHistory.findOneAndUpdate(
      { supabase_id: h.id },
      {
        $set: {
          supabase_id: h.id,
          mrd: String(h.mrd),
          old_category: h.old_category || "",
          new_category: h.new_category || "",
          changed_by: h.changed_by || "",
          changed_at: h.changed_at ? new Date(h.changed_at) : new Date()
        }
      },
      { upsert: true }
    );
  }
  console.log(`[Migration] CategoryHistory synced: ${catHist.length}`);

  // 6. enhancement_log
  const enhLogs = await fetchAllFromSupabase("enhancement_log");
  for (const l of enhLogs) {
    await EnhancementLog.findOneAndUpdate(
      { supabase_id: l.id },
      {
        $set: {
          supabase_id: l.id,
          mrd: String(l.mrd),
          marked_by: l.marked_by || "",
          marked_at: l.marked_at ? new Date(l.marked_at) : new Date()
        }
      },
      { upsert: true }
    );
  }
  console.log(`[Migration] EnhancementLog synced: ${enhLogs.length}`);

  // 7. los_reference
  const losRefs = await fetchAllFromSupabase("los_reference");
  for (const r of losRefs) {
    await LosReference.findOneAndUpdate(
      { code: String(r.code) },
      {
        $set: {
          code: String(r.code),
          package_name: r.package_name || "",
          los_days: r.los_days ?? null,
          los_display: r.los_display || ""
        }
      },
      { upsert: true }
    );
  }
  console.log(`[Migration] LosReference synced: ${losRefs.length}`);

  // 8. staff_roles
  const roles = await fetchAllFromSupabase("staff_roles");
  for (const r of roles) {
    await StaffRole.findOneAndUpdate(
      { user_id: String(r.user_id) },
      {
        $set: {
          supabase_id: r.id,
          user_id: String(r.user_id),
          is_admin: !!r.is_admin
        }
      },
      { upsert: true }
    );
  }
  console.log(`[Migration] StaffRoles synced: ${roles.length}`);

  console.log("[Migration] All Supabase text tables migrated to MongoDB successfully!");
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error("[Migration] Fatal error:", err);
  process.exit(1);
});
