"use client";

import React, { useState, useEffect } from "react";
import { api, Document as VaultDoc } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  ShieldCheck,
  UploadCloud,
  FileCheck2,
  Clock,
  Lock,
  AlertCircle,
  FileText,
  User as UserIcon,
  CheckCircle2,
  Loader2
} from "lucide-react";

export default function DocumentVaultPage() {
  const { user, refreshUser } = useAuth();
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<"ID" | "MEDICAL" | "WAIVER">("ID");
  const [file, setFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Metrics form
  const [age, setAge] = useState<number | string>("");
  const [height, setHeight] = useState<number | string>("");
  const [weight, setWeight] = useState<number | string>("");
  const [fitnessScore, setFitnessScore] = useState<number | string>("");
  const [metricsSaving, setMetricsSaving] = useState(false);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const data = await api.getDocuments();
      setDocs(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDocs();
      const m = user.profile_metrics || {};
      setAge(m.age ?? "");
      setHeight(m.height ?? "");
      setWeight(m.weight ?? "");
      setFitnessScore(m.fitness_score ?? "");
    }
  }, [user]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setStatusMessage({ type: "error", text: "Please choose a file to upload." });
      return;
    }
    setUploading(true);
    setStatusMessage(null);
    try {
      await api.uploadDocument(selectedType, file);
      setStatusMessage({ type: "success", text: `${selectedType} document uploaded! Awaiting organizer verification.` });
      setFile(null);
      fetchDocs();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Upload failed." });
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    setMetricsSaving(true);
    try {
      await api.updateMetrics({
        age: age ? Number(age) : undefined,
        height: height ? Number(height) : undefined,
        weight: weight ? Number(weight) : undefined,
        fitness_score: fitnessScore ? Number(fitnessScore) : undefined,
      });
      await refreshUser();
      alert("Profile metrics updated!");
    } catch (err: any) {
      alert(err.message || "Failed to update metrics.");
    } finally {
      setMetricsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <Lock className="w-12 h-12 text-slate-500 mx-auto" />
        <h2 className="text-xl font-bold">Secure Document Vault</h2>
        <p className="text-xs text-slate-400">Please sign in to access your private encrypted sports credentials.</p>
        <a href="/login" className="inline-block px-6 py-2.5 rounded-xl bg-brand-600 font-bold text-xs text-white">
          Sign In
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8 shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-bold mb-2">
            <Lock className="w-3.5 h-3.5" />
            <span>CONFIDENTIAL & SECURE</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Verified Document Vault</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Store government ID, medical clearance certificates, and signed waivers once. Meet event requirements with 1-click.
          </p>
        </div>
        <div className="px-4 py-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/60 text-right">
          <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Vault Owner</span>
          <span className="text-sm font-extrabold text-white">{user.name}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Upload Form & Athlete Metrics */}
        <div className="space-y-6">
          {/* Upload Card */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-lg space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-brand-400" />
              <span>Upload Document</span>
            </h2>

            {statusMessage && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  statusMessage.type === "success"
                    ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
                    : "bg-red-950/40 border-red-800 text-red-300"
                }`}
              >
                {statusMessage.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleUpload} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase tracking-wider mb-1.5 text-[10px]">
                  Document Type
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-medium focus:outline-none focus:border-brand-500"
                >
                  <option value="ID">Government ID / Passport (ID)</option>
                  <option value="MEDICAL">Medical Fitness Certificate (MEDICAL)</option>
                  <option value="WAIVER">Signed Liability Waiver (WAIVER)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase tracking-wider mb-1.5 text-[10px]">
                  File Attachment (PDF, JPG, PNG)
                </label>
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                🔒 Privacy: Uploaded files are stored with random UUID filenames. Verification confirms validity without public file exposure.
              </div>

              <button
                type="submit"
                disabled={uploading || !file}
                className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 font-bold text-white shadow-lg shadow-brand-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{uploading ? "Encrypting & Storing..." : "Upload to Vault"}</span>
              </button>
            </form>
          </div>

          {/* Athlete Metrics Card */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-lg space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-emerald-400" />
              <span>Profile & Age Metrics</span>
            </h2>
            <p className="text-xs text-slate-400">Used for automated minimum age and eligibility verification.</p>

            <form onSubmit={handleUpdateMetrics} className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Age</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 22"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Fitness Score</label>
                <input
                  type="number"
                  value={fitnessScore}
                  onChange={(e) => setFitnessScore(e.target.value)}
                  placeholder="e.g. 85"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Height (cm)</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="e.g. 180"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="e.g. 75"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                />
              </div>

              <div className="col-span-2 pt-2">
                <button
                  type="submit"
                  disabled={metricsSaving}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold border border-slate-700 transition"
                >
                  {metricsSaving ? "Saving..." : "Save Metrics"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right: Vault Documents List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-400" />
              <span>Stored Credentials ({docs.length})</span>
            </h2>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading documents...</div>
          ) : docs.length === 0 ? (
            <div className="text-center py-16 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <FileText className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="text-sm font-bold text-white">No Documents in Vault</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Upload your ID, Medical Certificate, and Waiver so you can register for events instantly.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {docs.map((doc) => {
                const dateStr = new Date(doc.uploaded_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                return (
                  <div
                    key={doc.id}
                    className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4 shadow-md hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-brand-400">
                        {doc.doc_type}
                      </div>
                      <div>
                        <div className="text-sm font-extrabold text-white flex items-center gap-2">
                          <span>{doc.doc_type === "ID" ? "Government ID Document" : doc.doc_type === "MEDICAL" ? "Medical Clearance Certificate" : "Signed Liability Waiver"}</span>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>Uploaded {dateStr}</span>
                          <span>•</span>
                          <span className="font-mono text-[10px]">{doc.id.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {doc.is_verified ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Verified</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pending Verification</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

