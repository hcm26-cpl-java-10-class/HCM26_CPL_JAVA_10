import { useState, useRef, type ChangeEvent, type DragEvent } from "react";
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  X,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { topicApi } from "@/api/features/topic.api";
import type { TopicItem } from "@/types/features/content";
import {
  parseFsoftSyllabusCsv,
  type ParsedSyllabus,
} from "./syllabusParser";
import {
  saveTopicSyllabusPackage,
  saveCustomAssessmentScheme,
  type TopicSyllabusPackage,
} from "./topicSyllabusData";

interface SyllabusImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetTopic?: TopicItem | null;
  onSuccess?: (importedTopic?: TopicItem) => void;
}

export function SyllabusImportDialog({
  open,
  onOpenChange,
  targetTopic,
  onSuccess,
}: SyllabusImportDialogProps) {
  const [parsed, setParsed] = useState<ParsedSyllabus | null>(null);
  const [activeTab, setActiveTab] = useState<"schedule" | "principles">("schedule");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setParsed(null);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    resetState();
    onOpenChange(false);
  };

  const handleFile = async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setErrorMsg("Please upload an official Syllabus CSV file (.csv)");
      return;
    }

    setErrorMsg(null);

    try {
      const text = await selectedFile.text();
      const result = parseFsoftSyllabusCsv(text);

      if (!result.chapters || result.chapters.length === 0) {
        setErrorMsg("Could not detect any Schedule Detail or Units in the uploaded file. Please check file formatting.");
        return;
      }

      setParsed(result);
      toast.success(`Parsed syllabus successfully: ${result.totalSessions} sessions across ${result.chapters.length} units.`);
    } catch (e: any) {
      console.error("Failed to parse syllabus CSV", e);
      setErrorMsg(e.message || "Failed to parse syllabus CSV file");
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDownloadTemplate = () => {
    const link = document.createElement("a");
    link.href = "/templates/fsoft_syllabus_template.csv";
    link.download = "FSOFT_Syllabus_ScheduleDetail_Template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Downloaded official Syllabus CSV template");
  };

  const handleConfirmImport = async () => {
    if (!parsed) return;
    setIsProcessing(true);

    try {
      let resolvedTopic: TopicItem;

      if (targetTopic) {
        resolvedTopic = targetTopic;
      } else {
        try {
          const created = await topicApi.create({
            code: parsed.topicCode,
            name: parsed.topicName,
            version: parsed.version,
            description: parsed.courseObjectives || `Syllabus for ${parsed.topicName}`,
            technicalGroup: parsed.technicalGroup,
            durationHours: Math.ceil(parsed.totalDurationHours),
            isActive: true,
          });
          resolvedTopic = created;
        } catch {
          resolvedTopic = {
            id: Date.now(),
            code: parsed.topicCode,
            name: parsed.topicName,
            version: parsed.version,
            description: parsed.courseObjectives,
            technicalGroup: parsed.technicalGroup,
            durationHours: Math.ceil(parsed.totalDurationHours),
            isActive: true,
            status: "ACTIVE",
          };
        }
      }

      // Save syllabus package & schedule details
      const pkg: TopicSyllabusPackage = {
        meta: {
          documentCode: parsed.documentCode,
          version: parsed.version,
          effectiveDate: parsed.effectiveDate,
          trainingAudience: parsed.trainingAudience,
          courseObjectives: parsed.courseObjectives,
          topicOutline: parsed.topicOutline,
          deliveryPrinciples: parsed.deliveryPrinciples,
        },
        chapters: parsed.chapters,
        totalSessions: parsed.totalSessions,
        totalMins: parsed.totalDurationMins,
        timeAllocation: {
          lab: Math.round(parsed.totalDurationHours * 0.4),
          lecture: Math.round(parsed.totalDurationHours * 0.4),
          exam: Math.round(parsed.totalDurationHours * 0.2),
          total: parsed.totalDurationHours,
        },
        assessmentScheme: parsed.assessmentScheme,
      };

      saveTopicSyllabusPackage(resolvedTopic.id, pkg.chapters, resolvedTopic);
      if (resolvedTopic.code) {
        saveTopicSyllabusPackage(resolvedTopic.code, pkg.chapters, resolvedTopic);
      }

      if (parsed.assessmentScheme && parsed.assessmentScheme.length > 0) {
        saveCustomAssessmentScheme(
          resolvedTopic.id,
          parsed.assessmentScheme,
          ">= 6.0 / 10",
          resolvedTopic.code
        );
      }

      toast.success(
        `Successfully imported syllabus & schedule detail for "${resolvedTopic.name}"!`
      );
      handleClose();
      if (onSuccess) {
        onSuccess(resolvedTopic);
      }
    } catch (err: any) {
      console.error("Import syllabus error", err);
      toast.error(err.message || "Failed to save imported syllabus");
    } finally {
      setIsProcessing(false);
    }
  };

  const deliveryBadgeColor = (type: string) => {
    switch (type) {
      case "Concept/Lecture":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Seminar/Workshop":
        return "bg-cyan-50 text-cyan-700 border-cyan-200";
      case "Assignment/Lab":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "Test/Quiz":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Exam":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:max-w-5xl md:max-w-5xl lg:max-w-6xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <FileSpreadsheet className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-gray-900">
                  {targetTopic
                    ? `Import Schedule Detail for "${targetTopic.name}"`
                    : "Import Syllabus & Schedule Detail (FSOFT Official Format)"}
                </DialogTitle>
                <p className="text-xs text-gray-500 mt-0.5">
                  Upload an official FSOFT Syllabus CSV file containing Topic Metadata, Delivery Principles, and Schedule Breakdown.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="text-xs h-8 gap-1.5 border-dashed hover:border-indigo-400 hover:text-indigo-600"
            >
              <Download className="size-3.5" />
              Download Official Template (.csv)
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Upload Area */}
          {!parsed ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-indigo-500 bg-indigo-50/50"
                  : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />
              <div className="size-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                <Upload className="size-6" />
              </div>
              <h4 className="text-sm font-semibold text-gray-800">
                Click to browse or drag & drop Syllabus CSV file
              </h4>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                Supports FSOFT Syllabus Matrix with Units, Sessions, Delivery Types, Duration (mins), and Assessment Scheme.
              </p>
            </div>
          ) : (
            /* Parsed Preview Area */
            <div className="space-y-4">
              {/* Summary Header Pill */}
              <div className="bg-gradient-to-r from-indigo-50/80 via-purple-50/60 to-white border border-indigo-100 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-600 text-white">
                      {parsed.topicCode}
                    </span>
                    <h3 className="font-bold text-gray-900 text-sm">{parsed.topicName}</h3>
                    <Badge variant="outline" className="text-[11px] font-mono">
                      v{parsed.version}
                    </Badge>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium text-[11px]">
                      {parsed.technicalGroup}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-3">
                    <span>Doc: <b>{parsed.documentCode}</b></span>
                    <span>&bull;</span>
                    <span>Effective: {parsed.effectiveDate}</span>
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="text-right">
                    <div className="text-[11px] text-gray-500 uppercase font-semibold">Total Duration</div>
                    <div className="font-bold text-indigo-700 text-sm">
                      {parsed.totalDurationHours}h ({parsed.totalDurationMins} mins)
                    </div>
                  </div>
                  <div className="h-8 w-px bg-gray-200" />
                  <div className="text-right">
                    <div className="text-[11px] text-gray-500 uppercase font-semibold">Breakdown</div>
                    <div className="font-bold text-gray-800 text-sm">
                      {parsed.chapters.length} Units &bull; {parsed.totalSessions} Sessions
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetState}
                    className="text-xs text-gray-500 hover:text-red-600 size-8 p-0"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Sub-tabs for Preview */}
              <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("schedule")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    activeTab === "schedule"
                      ? "bg-indigo-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  Schedule Detail Matrix ({parsed.totalSessions} Sessions)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("principles")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    activeTab === "principles"
                      ? "bg-indigo-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  Objectives &amp; Assessment Scheme ({parsed.assessmentScheme.length} Rules)
                </button>
              </div>

              {/* Tab 1: Schedule Detail Table */}
              {activeTab === "schedule" && (
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto max-h-[380px]">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50/90 text-gray-600 uppercase text-[10px] font-semibold sticky top-0 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2.5 w-12 text-center">Unit</th>
                          <th className="px-3 py-2.5 w-12 text-center">#</th>
                          <th className="px-3 py-2.5 w-64">Content</th>
                          <th className="px-3 py-2.5">Learning Objectives</th>
                          <th className="px-3 py-2.5 w-32">Delivery Type</th>
                          <th className="px-3 py-2.5 w-24">Duration</th>
                          <th className="px-3 py-2.5 w-20">Format</th>
                          <th className="px-3 py-2.5 w-44">Materials / Logistics</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {parsed.chapters.map((ch, chIdx) => (
                          <div key={`group-${ch.id}`} style={{ display: "contents" }}>
                            <tr key={`ch-${ch.id}`} className="bg-slate-50/80 font-bold text-gray-900 border-t border-gray-200">
                              <td colSpan={8} className="px-3 py-2 text-xs">
                                <span className="inline-flex items-center gap-2">
                                  <span className="size-5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] flex items-center justify-center font-bold">
                                    {ch.unitNumber || chIdx + 1}
                                  </span>
                                  <span>{ch.title}</span>
                                  <span className="text-[11px] font-normal text-gray-500">
                                    ({ch.sessions.length} sessions)
                                  </span>
                                </span>
                              </td>
                            </tr>
                            {ch.sessions.map((sess) => (
                              <tr key={`sess-${ch.id}-${sess.session}`} className="hover:bg-indigo-50/30">
                                <td className="px-3 py-2 text-center text-gray-400 font-mono text-[11px]">
                                  {ch.unitNumber || chIdx + 1}
                                </td>
                                <td className="px-3 py-2 text-center font-bold text-gray-700">
                                  {sess.session}
                                </td>
                                <td className="px-3 py-2 text-gray-900 font-medium whitespace-pre-line leading-relaxed">
                                  {sess.content}
                                </td>
                                <td className="px-3 py-2 text-gray-600">
                                  {sess.objectives || "—"}
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${deliveryBadgeColor(sess.deliveryType)}`}>
                                    {sess.deliveryType}
                                  </span>
                                </td>
                                <td className="px-3 py-2 font-mono text-gray-700">
                                  {sess.duration}
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    sess.trainingFormat === "Online"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-gray-100 text-gray-700"
                                  }`}>
                                    {sess.trainingFormat}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-gray-500 text-[11px] truncate max-w-[170px]" title={sess.materials}>
                                  {sess.materials || "—"}
                                </td>
                              </tr>
                            ))}
                          </div>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 2: Objectives & Assessment Scheme */}
              {activeTab === "principles" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                      <BookOpen className="size-4 text-indigo-600" />
                      Course Objectives &amp; Audience
                    </h4>
                    <div className="text-xs text-gray-600 whitespace-pre-line bg-gray-50 rounded-lg p-3 border border-gray-100 max-h-48 overflow-y-auto">
                      <p className="font-semibold text-gray-800 mb-1">Target Audience:</p>
                      <p className="mb-3">{parsed.trainingAudience || "Standard Freshers / Software Developers"}</p>
                      <p className="font-semibold text-gray-800 mb-1">Learning Outcomes:</p>
                      <p>{parsed.courseObjectives || "No objectives text specified."}</p>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      3. Assessment Scheme &amp; Passing Standard
                    </h4>
                    <div className="border border-gray-100 rounded-lg overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 text-[10px] uppercase font-semibold text-gray-500">
                          <tr>
                            <th className="px-3 py-2">Assessment Category</th>
                            <th className="px-3 py-2">Evaluation Method</th>
                            <th className="px-3 py-2 w-28">Passing Score</th>
                            <th className="px-3 py-2 w-20 text-right">Weight</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {parsed.assessmentScheme.map((a, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium text-gray-800">{a.category}</td>
                              <td className="px-3 py-2 text-gray-600 text-[11px]">{a.method || a.notes || "—"}</td>
                              <td className="px-3 py-2 font-mono text-gray-700">{a.passingScore || ">= 6.0 / 10"}</td>
                              <td className="px-3 py-2 text-right font-bold text-indigo-600">{a.weight}</td>
                            </tr>
                          ))}
                          <tr className="bg-purple-50/60 font-bold text-gray-900 border-t border-purple-100">
                            <td className="px-3 py-2 text-[#5b52e0]">Overall Topic Result</td>
                            <td className="px-3 py-2 text-gray-500 font-normal text-[11px]">
                              Completed 100% Online video, Quiz, Labs, Final Test
                            </td>
                            <td className="px-3 py-2 text-[#5b52e0] font-mono text-xs">&gt;= 6.0 / 10</td>
                            <td className="px-3 py-2 text-right text-[#5b52e0] font-mono text-xs font-extrabold">100%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Import Validation Failed</p>
                <p className="mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-gray-100 flex items-center justify-between">
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <HelpCircle className="size-3.5" />
            <span>Parsed directly following FSOFT Fresher Syllabus 26e-BM/HR/HDCV/FSOFT standard.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!parsed || isProcessing}
              onClick={handleConfirmImport}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              {isProcessing
                ? "Importing..."
                : targetTopic
                ? "Confirm Schedule Import"
                : "Confirm & Create Syllabus Topic"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
