import { useEffect, useState } from "react";
import Head from "next/head";
import Layout, { useAppToast } from "@/components/layout/Layout";
import FileUploadZone from "@/components/cv/FileUploadZone";
import CVEditForm, { type CVEditData } from "@/components/cv/CVEditForm";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchMyCV,
  uploadCVFile,
  uploadCVText,
  saveCV,
  type CVResponse,
  type CVExtractResponse,
} from "@/lib/api";

type PageState = "idle" | "extracting" | "editing" | "saving" | "saved";
type UploadTab = "file" | "text";

function CVSummaryCard({ cv, onReupload }: { cv: CVResponse; onReupload: () => void }) {
  const skills = cv.skills || [];
  const roles = cv.recent_roles || [];

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">
            {cv.name || "Active CV"} — Version {cv.version}
          </h3>
          {cv.contact_info?.email && (
            <p className="text-xs text-gray-400 mt-0.5">{cv.contact_info.email}</p>
          )}
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-400 block">
            {new Date(cv.created_at).toLocaleDateString()}
          </span>
          <button onClick={onReupload} className="text-xs text-blue-600 hover:underline mt-1">
            Update CV
          </button>
        </div>
      </div>

      {cv.summary && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Summary</p>
          <p className="text-sm text-gray-700">{cv.summary}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        {cv.experience_years != null && (
          <div className="card p-3 bg-blue-50 border-blue-100">
            <p className="text-xs text-blue-500 font-medium">Experience</p>
            <p className="text-xl font-bold text-blue-700 mt-1">{cv.experience_years} yrs</p>
          </div>
        )}
        {cv.education && (
          <div className="card p-3 bg-purple-50 border-purple-100">
            <p className="text-xs text-purple-500 font-medium">Education</p>
            <p className="font-semibold text-purple-700 mt-1 text-sm">{cv.education}</p>
          </div>
        )}
      </div>

      {cv.contact_info && (
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          {cv.contact_info.phone && <span>📞 {cv.contact_info.phone}</span>}
          {cv.contact_info.linkedin && (
            <a href={cv.contact_info.linkedin} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
              LinkedIn ↗
            </a>
          )}
        </div>
      )}

      {skills.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Skills</p>
          <div className="flex flex-wrap gap-2">
            {skills.map((s) => (
              <span key={s} className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {roles.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Recent Roles</p>
          <ul className="space-y-1">
            {roles.map((r, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {cv.change_summary && cv.version > 1 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs font-medium text-amber-700">What changed in v{cv.version}</p>
          <p className="text-sm text-amber-600 mt-0.5">{cv.change_summary}</p>
        </div>
      )}
    </div>
  );
}

function extractToEditData(extract: CVExtractResponse["extracted"]): CVEditData {
  return {
    name: extract.name || "",
    email: extract.contact_info?.email || "",
    phone: extract.contact_info?.phone || "",
    linkedin: extract.contact_info?.linkedin || "",
    summary: extract.summary || "",
    skills: extract.skills || [],
    experience_years: extract.experience_years ?? null,
    education: extract.education || "",
    recent_roles: extract.recent_roles || [],
  };
}

export default function CVPage() {
  const { isLoading: authLoading } = useRequireAuth();
  const { user } = useAuth();
  const { toast } = useAppToast();
  const [pageState, setPageState] = useState<PageState>("idle");
  const [activeTab, setActiveTab] = useState<UploadTab>("file");
  const [extractResult, setExtractResult] = useState<CVExtractResponse | null>(null);
  const [savedCV, setSavedCV] = useState<CVResponse | null>(null);
  const [textInput, setTextInput] = useState("");
  const [isLoadingCV, setIsLoadingCV] = useState(true);

  // Only fetch CV after auth is loaded and user is authenticated
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setIsLoadingCV(false); return; }

    setIsLoadingCV(true);
    fetchMyCV()
      .then((cv) => { setSavedCV(cv); setPageState("saved"); })
      .catch(() => { /* No CV yet — stay on idle */ })
      .finally(() => setIsLoadingCV(false));
  }, [authLoading, user?.id]);

  const handleFile = async (file: File) => {
    setPageState("extracting");
    try {
      const result = await uploadCVFile(file);
      setExtractResult(result);
      setPageState("editing");
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to extract CV from file.", "error");
      setPageState("idle");
    }
  };

  const handleText = async () => {
    if (textInput.trim().length < 50) {
      toast("Please enter at least 50 characters.", "error");
      return;
    }
    setPageState("extracting");
    try {
      const result = await uploadCVText(textInput);
      setExtractResult(result);
      setPageState("editing");
    } catch {
      toast("Failed to extract CV from text.", "error");
      setPageState("idle");
    }
  };

  const handleSave = async (editData: CVEditData) => {
    if (!extractResult) return;
    setPageState("saving");
    try {
      const cv = await saveCV({
        raw_text: extractResult.raw_text,
        name: editData.name || undefined,
        contact_info: {
          email: editData.email || undefined,
          phone: editData.phone || undefined,
          linkedin: editData.linkedin || undefined,
        },
        summary: editData.summary || undefined,
        skills: editData.skills,
        experience_years: editData.experience_years ?? undefined,
        education: editData.education || undefined,
        recent_roles: editData.recent_roles,
      });
      setSavedCV(cv);
      setPageState("saved");
      toast(cv.version > 1 ? `CV updated — version ${cv.version} saved.` : "CV saved successfully!", "success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save CV.";
      toast(msg, "error");
      setPageState("editing");
    }
  };

  if (authLoading || isLoadingCV) {
    return (
      <Layout title="My CV">
        <div className="animate-pulse space-y-4 max-w-2xl">
          <div className="h-48 bg-gray-200 rounded-xl" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Head><title>My CV — Interview Note Agent</title></Head>
      <Layout title="My CV">
        <div className="max-w-4xl">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6 text-sm">
            {["Upload", "Review & Edit", "Saved"].map((step, i) => {
              const isActive = (
                (i === 0 && (pageState === "idle" || pageState === "extracting")) ||
                (i === 1 && (pageState === "editing" || pageState === "saving")) ||
                (i === 2 && pageState === "saved")
              );
              const isDone = (i === 0 && (pageState === "editing" || pageState === "saving" || pageState === "saved"));
              return (
                <div key={step} className="flex items-center gap-2">
                  {i > 0 && <div className={`h-px w-8 ${isDone ? "bg-blue-400" : "bg-gray-200"}`} />}
                  <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                    isActive ? "bg-blue-100 text-blue-700" : isDone ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                  }`}>
                    {isDone ? "✓ " : ""}{step}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Step 1: Upload */}
          {(pageState === "idle" || pageState === "extracting") && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Upload Your CV</h3>
                {/* Tabs */}
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-4">
                  {(["file", "text"] as UploadTab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                        activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {tab === "file" ? "📁 File Upload" : "📝 Paste Text"}
                    </button>
                  ))}
                </div>

                {activeTab === "file" ? (
                  <FileUploadZone
                    onFile={handleFile}
                    isLoading={pageState === "extracting"}
                    label="Drop your CV here (PDF or DOCX)"
                  />
                ) : (
                  <div className="space-y-3">
                    <textarea
                      className="input min-h-[180px] resize-y font-mono text-sm"
                      placeholder="Paste your full CV text here..."
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      disabled={pageState === "extracting"}
                    />
                    <button
                      onClick={handleText}
                      disabled={pageState === "extracting" || textInput.trim().length < 50}
                      className="btn-primary w-full disabled:opacity-50"
                    >
                      {pageState === "extracting" ? "Extracting..." : "Extract Information"}
                    </button>
                  </div>
                )}
              </div>

              {/* Current CV preview (if exists) */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Current CV</h3>
                {savedCV ? (
                  <CVSummaryCard cv={savedCV} onReupload={() => {}} />
                ) : (
                  <div className="card p-8 text-center text-gray-400 h-48 flex flex-col items-center justify-center">
                    <p className="text-3xl mb-2">📄</p>
                    <p className="text-sm">No CV uploaded yet.</p>
                    <p className="text-xs mt-1 text-gray-300">Upload your CV to improve interview analysis.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Edit */}
          {(pageState === "editing" || pageState === "saving") && extractResult && (
            <div className="card p-6 max-w-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-gray-900">Review & Edit Extracted Information</h3>
                <button onClick={() => setPageState("idle")} className="text-sm text-gray-400 hover:text-gray-600">
                  ← Back
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                AI has extracted the information below from your CV. Please review and correct any errors before saving.
              </p>
              <CVEditForm
                initial={extractToEditData(extractResult.extracted)}
                onSave={handleSave}
                isSaving={pageState === "saving"}
              />
            </div>
          )}

          {/* Step 3: Saved */}
          {pageState === "saved" && savedCV && (
            <div className="max-w-2xl">
              <CVSummaryCard
                cv={savedCV}
                onReupload={() => { setPageState("idle"); setExtractResult(null); }}
              />
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}
