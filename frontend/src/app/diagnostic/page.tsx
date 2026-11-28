"use client";

import React from "react";
import Link from "next/link";
import { Microscope } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import AuthGuard from "@/components/AuthGuard";

export default function DiagnosticPage() {
  return (
    <AuthGuard>
      {({ email }) => (
        <div className="min-h-screen bg-[#F4F7F8]">
          <AppHeader
            title="Diagnostic Module"
            subtitle="Laboratory & Imaging Integration"
            backHref="/"
            backLabel="Dashboard"
            userEmail={email}
          />
          <main className="mx-auto max-w-xl px-4 py-12">
            <div className="clinical-card p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Microscope className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Diagnostic Integration</h2>
              <span className="mt-2 inline-block rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                Coming Soon
              </span>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                This module is being prepared for lab, biochemistry, and imaging data integration. Once active, reports will sync automatically with ward progress notes.
              </p>
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
                <h3 className="text-xs font-bold uppercase tracking-wider text-teal-800">
                  Planned Capabilities
                </h3>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs text-slate-600">
                  <li>Lab test requests and pathology results per MRD</li>
                  <li>Microbiology culture &amp; sensitivity tracking</li>
                  <li>Radiology / imaging report linking into Clinical Scribe</li>
                </ul>
              </div>
              <div className="mt-6">
                <Link href="/" className="btn-teal">
                  Return to Dashboard
                </Link>
              </div>
            </div>
          </main>
        </div>
      )}
    </AuthGuard>
  );
}
