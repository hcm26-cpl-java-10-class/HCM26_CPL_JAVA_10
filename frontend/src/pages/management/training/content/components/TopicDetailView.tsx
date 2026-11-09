import { useState, useMemo, useEffect } from "react";
import type { TopicItem } from "@/types/features/content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  BookOpen,
  Layers,
  Plus,
  Clock,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  ShieldCheck,
  SlidersHorizontal,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { topicApi } from "@/api/features/topic.api";
import {
  getTopicSyllabusPackage,
  getCustomAssessmentScheme,
  saveCustomAssessmentScheme,
  getCustomPassScore,
  resetCustomAssessmentScheme,
} from "./topicSyllabusData";
import type { TopicSyllabusPackage, AssessmentItem } from "./topicSyllabusData";
import { TopicSyllabusEditorDialog } from "./TopicSyllabusEditorDialog";
import { SyllabusImportDialog } from "./SyllabusImportDialog";
import { AssessmentSchemeDialog } from "./AssessmentSchemeDialog";
import { exportFsoftSyllabusCsv } from "./syllabusParser";

interface TopicDetailViewProps {
  topic: TopicItem;
  onBack: () => void;
  onEdit?: (topic: TopicItem) => void;
}

const PIE_COLORS = {
  lab: "#4361ee",     // Blue
  lecture: "#2ec4b6", // Teal / green
  exam: "#ff9f1c",    // Amber / orange
};

export function TopicDetailView({ topic, onBack, onEdit }: TopicDetailViewProps) {
  const [activeTab, setActiveTab] = useState<"syllabus" | "schedule">("syllabus");
  const [isOutlineEditorOpen, setIsOutlineEditorOpen] = useState(false);
  const [isSyllabusImportOpen, setIsSyllabusImportOpen] = useState(false);
  const [isAssessmentSchemeDialogOpen, setIsAssessmentSchemeDialogOpen] = useState(false);

  const [customPassScore, setCustomPassScore] = useState<string>(() =>
    getCustomPassScore(topic.id) || ">= 6.0 / 10"
  );

  // Dynamic syllabus data generated specifically for this topic
  const [syllabusPackage, setSyllabusPackage] = useState<TopicSyllabusPackage>(() =>
    getTopicSyllabusPackage(topic)
  );

  const reloadSyllabus = () => {
    setSyllabusPackage(getTopicSyllabusPackage(topic));
    setCustomPassScore(getCustomPassScore(topic.id) || ">= 6.0 / 10");
  };

  useEffect(() => {
    reloadSyllabus();
  }, [topic]);

  const hasCustomScheme = useMemo(() => {
    return !!(
      (topic.id && getCustomAssessmentScheme(topic.id)) ||
      (topic.code && getCustomAssessmentScheme(topic.code))
    );
  }, [topic, syllabusPackage]);

  const handleSaveAssessmentScheme = (newScheme: AssessmentItem[], passScore: string) => {
    saveCustomAssessmentScheme(topic.id, newScheme, passScore, topic.code);
    setCustomPassScore(passScore);
    setSyllabusPackage((prev) => ({
      ...prev,
      assessmentScheme: newScheme,
    }));
  };

  const handleResetAssessmentScheme = () => {
    resetCustomAssessmentScheme(topic.id, topic.code);
    setCustomPassScore(">= 6.0 / 10");
    reloadSyllabus();
    toast.success("Restored FSOFT standard assessment scheme");
  };

  const { chapters, timeAllocation, assessmentScheme, meta } = syllabusPackage;

  // Track expanded state for all chapters
  const [expandedChapters, setExpandedChapters] = useState<Record<number, boolean>>({});

  const toggleChapter = (chapterId: number) => {
    setExpandedChapters((prev) => ({
      ...prev,
      [chapterId]: prev[chapterId] !== undefined ? !prev[chapterId] : false,
    }));
  };

  const isChapterOpen = (chapterId: number, idx: number) => {
    if (expandedChapters[chapterId] !== undefined) {
      return expandedChapters[chapterId];
    }
    // Default open first 3 chapters, rest closed
    return idx < 3;
  };

  const totalH = timeAllocation.total;
  const labHours = timeAllocation.lab;
  const lectureHours = timeAllocation.lecture;
  const examHours = timeAllocation.exam;

  const labPct = totalH > 0 ? ((labHours / totalH) * 100).toFixed(1) : "0";
  const lecturePct = totalH > 0 ? ((lectureHours / totalH) * 100).toFixed(1) : "0";
  const examPct = totalH > 0 ? ((examHours / totalH) * 100).toFixed(1) : "0";

  const pieData = useMemo(() => [
    { name: "Assignment/Lab", value: labHours, color: PIE_COLORS.lab },
    { name: "Concept/Lecture", value: lectureHours, color: PIE_COLORS.lecture },
    { name: "Exam", value: examHours, color: PIE_COLORS.exam },
  ].filter(d => d.value > 0), [labHours, lectureHours, examHours]);

  const handleExportFsoftCsv = () => {
    try {
      const csvContent = exportFsoftSyllabusCsv(topic, syllabusPackage);
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${topic.code}_FSOFT_Syllabus_v${topic.version || "1.0"}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Exported official FSOFT Syllabus CSV successfully!");
    } catch (err: any) {
      console.error("Export CSV failed", err);
      toast.error("Failed to export syllabus CSV");
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const blob = await topicApi.exportFile("EXCEL");
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${topic.code}_Syllabus_v${topic.version}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Download started!");
    } catch {
      toast.error("Download failed");
    }
  };

  const deliveryPrinciples = meta?.deliveryPrinciples || {
    Trainees: "Qualified entry test and passed interview of Fresher program; Less than or equals 20 students in the class",
    Trainer: "Trainer and mentor has a good knowledge of the programming language that has been evaluated by FA",
    Training: "Trainee actively self-learn at day 1 of each topic; Trainer conducts the workshop at day 2; Final test at end of course",
    "Re-Test": "Only allow each student to retake the test up to 2 times; Re-exam follows the same structure as Final Test",
    Marking: "Trainer marks students on Assignments, Final Exam Theory, Final Exam Practice (score >=6 capped at 6 for re-take)",
    "Waiver Criteria": "Students pass the quick test; Trainer Audit: rank B or up",
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 text-gray-600 hover:text-gray-900 -ml-2 text-xs"
        >
          <ArrowLeft className="size-4" />
          Back to Topics &amp; Syllabus
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSyllabusImportOpen(true)}
            className="text-gray-700 hover:text-indigo-600 hover:border-indigo-300 gap-1.5 text-xs h-8"
          >
            <Upload className="size-3.5 text-indigo-600" />
            Import Syllabus (CSV)
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportFsoftCsv}
            className="text-gray-700 hover:text-indigo-600 hover:border-indigo-300 gap-1.5 text-xs h-8"
          >
            <Download className="size-3.5 text-indigo-600" />
            Export FSOFT CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOutlineEditorOpen(true)}
            className="text-gray-700 hover:text-[#5b52e0] hover:border-[#5b52e0] gap-1.5 text-xs h-8"
          >
            <BookOpen className="size-3.5 text-[#5b52e0]" />
            Edit Outline
          </Button>

          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(topic)}
              className="text-gray-700 text-xs h-8"
            >
              Edit Topic
            </Button>
          )}

          <Button
            onClick={handleDownloadExcel}
            className="bg-[#5b52e0] hover:bg-[#4d44cb] text-white px-4 h-8 rounded-lg font-medium shadow-sm gap-1.5 text-xs"
          >
            <Download className="size-3.5" />
            Download Excel
          </Button>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-6">
        {/* Document Governance Header */}
        <div className="flex flex-wrap items-center justify-between border-b border-gray-100 pb-4 gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-600 text-white">
                {topic.code}
              </span>
              <h1 className="text-lg font-bold text-gray-900">{topic.name}</h1>
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 font-mono text-gray-600">
                v{topic.version || "1.0"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-3">
              <span>Doc Code: <b>{meta?.documentCode || "26e-BM/HR/HDCV/FSOFT"}</b></span>
              <span>&bull;</span>
              <span>Effective Date: {meta?.effectiveDate || "24/04/2020"}</span>
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200 text-[11px]">
              {topic.technicalGroup || "Java"}
            </span>
            <span className="text-gray-500">
              Allocated: <b className="text-gray-800">{totalH}h</b> ({chapters.reduce((acc, c) => acc + c.sessions.length, 0)} sessions)
            </span>
          </div>
        </div>

        {/* Tab Sub-navigation */}
        <div className="flex border-b border-gray-200 -mt-2">
          <button
            onClick={() => setActiveTab("syllabus")}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "syllabus"
                ? "border-[#5b52e0] text-[#5b52e0]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Syllabus Detail &amp; Principles
          </button>
          <button
            onClick={() => setActiveTab("schedule")}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "schedule"
                ? "border-[#5b52e0] text-[#5b52e0]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Schedule Detail Matrix ({chapters.reduce((acc, c) => acc + c.sessions.length, 0)} Sessions)
          </button>
        </div>

        {/* TAB 1: SYLLABUS DETAIL */}
        {activeTab === "syllabus" && (
          <div className="space-y-8">
            {/* Top 2 Columns: General Info & Time Allocation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Left: 1. General Info */}
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-3">1. General Info &amp; Governance</h2>
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white text-xs divide-y divide-gray-100">
                  <div className="flex">
                    <div className="w-40 px-4 py-2.5 font-semibold text-gray-500 bg-gray-50 border-r border-gray-100">
                      Topic Code
                    </div>
                    <div className="px-4 py-2.5 font-mono font-medium text-gray-800 flex-1">
                      {topic.code}
                    </div>
                  </div>

                  <div className="flex">
                    <div className="w-40 px-4 py-2.5 font-semibold text-gray-500 bg-gray-50 border-r border-gray-100">
                      Topic Name
                    </div>
                    <div className="px-4 py-2.5 font-medium text-gray-800 flex-1">
                      {topic.name}
                    </div>
                  </div>

                  <div className="flex">
                    <div className="w-40 px-4 py-2.5 font-semibold text-gray-500 bg-gray-50 border-r border-gray-100">
                      Version
                    </div>
                    <div className="px-4 py-2.5 font-mono text-gray-800 flex-1">
                      {topic.version || "1.0"}
                    </div>
                  </div>

                  <div className="flex">
                    <div className="w-40 px-4 py-2.5 font-semibold text-gray-500 bg-gray-50 border-r border-gray-100">
                      Technical Group
                    </div>
                    <div className="px-4 py-2.5 text-gray-800 flex-1">
                      {topic.technicalGroup || "JAVA"}
                    </div>
                  </div>

                  <div className="flex">
                    <div className="w-40 px-4 py-2.5 font-semibold text-gray-500 bg-gray-50 border-r border-gray-100">
                      Training Audience
                    </div>
                    <div className="px-4 py-2.5 text-gray-800 flex-1 leading-relaxed">
                      {meta?.trainingAudience || "Trainees who are software developers (SD) with basic background and skills on programming language"}
                    </div>
                  </div>

                  <div className="flex">
                    <div className="w-40 px-4 py-2.5 font-semibold text-gray-500 bg-gray-50 border-r border-gray-100">
                      Total Sessions &amp; Hours
                    </div>
                    <div className="px-4 py-2.5 text-gray-800 flex-1 font-medium">
                      {chapters.reduce((acc, c) => acc + c.sessions.length, 0)} Sessions &bull; {totalH} Hours ({totalH * 60} mins)
                    </div>
                  </div>

                  <div className="flex">
                    <div className="w-40 px-4 py-2.5 font-semibold text-gray-500 bg-gray-50 border-r border-gray-100">
                      Pass Criteria
                    </div>
                    <div className="px-4 py-2.5 text-gray-800 flex-1">
                      Total topic GPA &gt;= 6/10 (100% video, quiz, labs, and final test completed)
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: 2. Time Allocation */}
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-3">2. Time Allocation Matrix</h2>
                {pieData.length === 0 ? (
                  <div className="border border-gray-200 rounded-lg p-8 bg-white text-center">
                    <div className="size-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                      <Clock className="size-6" />
                    </div>
                    <h4 className="text-xs font-semibold text-gray-700">No Time Allocation Available</h4>
                    <p className="text-[11px] text-gray-400 mt-1 mb-4 max-w-xs mx-auto">
                      Time distribution will appear automatically when schedule sessions are imported or configured.
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsSyllabusImportOpen(true)}
                        className="text-xs gap-1.5"
                      >
                        <Upload className="size-3.5" />
                        Import CSV
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsOutlineEditorOpen(true)}
                        className="text-[#5b52e0] border-[#5b52e0]/30 hover:bg-purple-50 text-xs gap-1.5"
                      >
                        <BookOpen className="size-3.5" />
                        Configure Outline
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg p-5 bg-white">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <div className="w-44 h-44 relative flex-shrink-0">
                        <ResponsiveContainer width="100%" height={176}>
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              outerRadius={75}
                              dataKey="value"
                              label={({ percent }) =>
                                percent != null && percent > 0.05
                                  ? `${(percent * 100).toFixed(0)}%`
                                  : ""
                              }
                              labelLine={false}
                              fontSize={11}
                              fontWeight={600}
                            >
                              {pieData.map((d, i) => (
                                <Cell key={i} fill={d.color} stroke="#ffffff" strokeWidth={1.5} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(val: any, name: any) => [
                                `${val}h (${((val / totalH) * 100).toFixed(1)}%)`,
                                name,
                              ]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="space-y-2 text-xs flex-1">
                        <div className="flex items-center justify-between py-1 border-b border-gray-100">
                          <span className="flex items-center gap-2 text-gray-700">
                            <span className="size-2.5 rounded-full bg-[#4361ee]" />
                            Assignment/Lab:
                          </span>
                          <span className="font-semibold text-gray-800">{labHours}h ({labPct}%)</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-gray-100">
                          <span className="flex items-center gap-2 text-gray-700">
                            <span className="size-2.5 rounded-full bg-[#2ec4b6]" />
                            Concept/Lecture:
                          </span>
                          <span className="font-semibold text-gray-800">{lectureHours}h ({lecturePct}%)</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-gray-100">
                          <span className="flex items-center gap-2 text-gray-700">
                            <span className="size-2.5 rounded-full bg-[#ff9f1c]" />
                            Exam &amp; Quiz:
                          </span>
                          <span className="font-semibold text-gray-800">{examHours}h ({examPct}%)</span>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <span className="font-bold text-gray-900">Total Program Duration:</span>
                          <span className="font-bold text-indigo-600 text-sm">{totalH}h</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Course Objectives Box */}
            <div className="bg-gray-50/70 border border-gray-200 rounded-xl p-5 space-y-2">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <BookOpen className="size-4 text-indigo-600" />
                Course Objectives &amp; Scope
              </h2>
              <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">
                {topic.description ||
                  meta?.courseObjectives ||
                  "This topic is to introduce about programming language knowledge; adapt trainees with skills, lessons and practices which is specifically used in the Fsoft projects."}
              </p>
            </div>

            {/* 3. Assessment Scheme Table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    3. Assessment Scheme &amp; Passing Standard
                  </h2>
                  {hasCustomScheme ? (
                    <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                      Customized
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-gray-50 text-gray-600 border-gray-200">
                      FSOFT Standard
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {hasCustomScheme && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleResetAssessmentScheme}
                      className="h-8 text-xs text-gray-500 hover:text-gray-700 gap-1.5"
                    >
                      <RotateCcw className="size-3" />
                      Reset to Standard
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAssessmentSchemeDialogOpen(true)}
                    className="h-8 text-xs text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/60 border-indigo-200 gap-1.5 font-medium shadow-sm"
                  >
                    <SlidersHorizontal className="size-3.5" />
                    Adjust Scheme
                  </Button>
                </div>
              </div>

              {assessmentScheme.length === 0 ? (
                <div className="border border-gray-200 rounded-lg p-6 bg-white text-center text-xs text-gray-400">
                  No assessment criteria configured yet.
                  <div className="mt-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setIsAssessmentSchemeDialogOpen(true)}
                      className="text-xs"
                    >
                      Configure Assessment Scheme
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50/90 border-b border-gray-200 text-gray-600 font-semibold text-[11px]">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-gray-700">Assessment Category</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-700">Evaluation Method</th>
                        <th className="text-left px-4 py-3 w-36 font-semibold text-gray-700">Passing Score</th>
                        <th className="text-right px-4 py-3 w-28 font-semibold text-gray-700">Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {assessmentScheme.map((item, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                          onClick={() => setIsAssessmentSchemeDialogOpen(true)}
                          title="Click to adjust assessment scheme"
                        >
                          <td className="px-4 py-3 font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                            <span className="flex items-center gap-2">
                              {item.category}
                              <Pencil className="size-3 opacity-0 group-hover:opacity-100 text-indigo-500 transition-opacity" />
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 leading-relaxed">
                            {item.method || item.notes || "Standard evaluation method"}
                          </td>
                          <td className="px-4 py-3 font-mono font-medium text-gray-800">
                            {item.passingScore || ">= 6.0 / 10"}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-indigo-600 font-mono text-sm">
                            {item.weight}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-purple-50/60 font-bold text-gray-900 border-t border-purple-100">
                        <td className="px-4 py-3 text-[#5b52e0]">Overall Topic Result</td>
                        <td className="px-4 py-3 text-gray-500 font-normal text-[11px]">
                          Completed 100% Online video, Quiz, Labs, Final Test
                        </td>
                        <td className="px-4 py-3 text-[#5b52e0] font-mono text-sm">
                          {customPassScore || ">= 6.0 / 10"}
                        </td>
                        <td className="px-4 py-3 text-right text-[#5b52e0] font-mono text-sm font-extrabold">
                          100%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 4. Training Delivery Principles */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <ShieldCheck className="size-4 text-indigo-600" />
                4. Training Delivery Principles
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                {Object.entries(deliveryPrinciples as Record<string, string>).map(([k, v]) => (
                  <div key={k} className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1">
                    <span className="font-semibold text-gray-800 block text-[11px] uppercase tracking-wide">
                      {k}
                    </span>
                    <p className="text-gray-600 leading-relaxed whitespace-pre-line text-[11px]">
                      {v}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SCHEDULE DETAIL (Training Schedule Matrix) */}
        {activeTab === "schedule" && (
          <div className="space-y-4">
            {chapters.length === 0 ? (
              <div className="text-center py-16 px-6 bg-white border-2 border-dashed border-gray-300 rounded-xl shadow-sm space-y-4">
                <div className="size-14 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <FileSpreadsheet className="size-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-800">No Schedule Detail Matrix Configured</h3>
                  <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                    Upload an official FSOFT Syllabus CSV file or manually create chapters, sessions, and duration minutes.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button
                    onClick={() => setIsSyllabusImportOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-xs h-9 shadow-sm"
                  >
                    <Upload className="size-4" />
                    Import Syllabus CSV
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsOutlineEditorOpen(true)}
                    className="gap-2 text-xs h-9"
                  >
                    <Plus className="size-4" />
                    Create Manually
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Header Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-indigo-50/40 p-4 rounded-xl border border-indigo-100">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                      <Layers className="size-4 text-indigo-600" />
                      Training Schedule Matrix (scheduleDetail)
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Structured into {chapters.length} Units &bull; {chapters.reduce((acc, c) => acc + c.sessions.length, 0)} Sessions &bull; {totalH} Hours ({totalH * 60} mins)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsSyllabusImportOpen(true)}
                      className="gap-1.5 text-xs h-8 bg-white"
                    >
                      <Upload className="size-3.5 text-indigo-600" />
                      Re-import CSV
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setIsOutlineEditorOpen(true)}
                      className="bg-[#5b52e0] hover:bg-[#4a41d0] text-white gap-1.5 text-xs h-8 shadow-sm"
                    >
                      <BookOpen className="size-3.5" />
                      Edit Outline
                    </Button>
                  </div>
                </div>

                {chapters.map((ch, chIdx) => {
                  const isExpanded = isChapterOpen(ch.id, chIdx);
                  return (
                    <div key={ch.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                      {/* Accordion header */}
                      <button
                        onClick={() => toggleChapter(ch.id)}
                        className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50/80 hover:bg-gray-100 transition-colors text-left border-b border-gray-200/60"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="size-6 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">
                            {ch.unitNumber || chIdx + 1}
                          </span>
                          <span className="font-semibold text-sm text-gray-900">{ch.title}</span>
                          <span className="text-xs text-gray-500 font-normal">
                            ({ch.sessions.length} sessions)
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="size-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="size-4 text-gray-500" />
                        )}
                      </button>

                      {/* Accordion body */}
                      {isExpanded && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50/50 border-b border-gray-200 text-gray-600 font-semibold text-[11px]">
                              <tr>
                                <th className="text-center px-3 py-2.5 w-14">Session</th>
                                <th className="text-left px-3 py-2.5 w-56">Content</th>
                                <th className="text-left px-3 py-2.5">Learning Objectives</th>
                                <th className="text-left px-3 py-2.5 w-36">Delivery Type</th>
                                <th className="text-center px-3 py-2.5 w-24">Duration</th>
                                <th className="text-center px-3 py-2.5 w-20">Format</th>
                                <th className="text-left px-3 py-2.5 w-52">Materials / Logistics</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-gray-700">
                              {ch.sessions.map((sess, idx) => (
                                <tr key={idx} className="hover:bg-indigo-50/20">
                                  <td className="px-3 py-3 text-center font-bold text-gray-800">
                                    {sess.session}
                                  </td>
                                  <td className="px-3 py-3 font-medium whitespace-pre-line text-gray-900 leading-relaxed">
                                    {sess.content}
                                  </td>
                                  <td className="px-3 py-3 text-gray-600 leading-relaxed">
                                    {sess.objectives || "—"}
                                  </td>
                                  <td className="px-3 py-3">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                                        sess.deliveryType === "Concept/Lecture"
                                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                                          : sess.deliveryType === "Assignment/Lab"
                                          ? "bg-purple-50 text-purple-700 border border-purple-200"
                                          : sess.deliveryType === "Seminar/Workshop"
                                          ? "bg-cyan-50 text-cyan-700 border border-cyan-200"
                                          : sess.deliveryType === "Test/Quiz"
                                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                                          : sess.deliveryType === "Exam"
                                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                                          : "bg-gray-100 text-gray-700 border border-gray-200"
                                      }`}
                                    >
                                      {sess.deliveryType}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-center font-mono text-gray-700">
                                    {sess.durationMins ? `${sess.durationMins}m (${sess.durationHours}h)` : sess.duration}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                                        sess.trainingFormat === "Online"
                                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                          : "bg-slate-100 text-slate-700 border border-slate-200"
                                      }`}
                                    >
                                      {sess.trainingFormat}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-gray-600 text-[11px]">
                                    {sess.materials?.startsWith("http") ? (
                                      <a
                                        href={sess.materials}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[#5b52e0] hover:underline flex items-center gap-1 font-mono break-all"
                                      >
                                        {sess.materials}
                                        <ExternalLink className="size-3 shrink-0" />
                                      </a>
                                    ) : (
                                      <span className="font-mono text-gray-700">
                                        {sess.materials || "—"}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* Syllabus Outline Editor Modal */}
      <TopicSyllabusEditorDialog
        open={isOutlineEditorOpen}
        onOpenChange={setIsOutlineEditorOpen}
        topic={topic}
        onSaved={reloadSyllabus}
      />

      {/* Syllabus & Schedule Detail CSV Import Modal */}
      <SyllabusImportDialog
        open={isSyllabusImportOpen}
        onOpenChange={setIsSyllabusImportOpen}
        targetTopic={topic}
        onSuccess={() => reloadSyllabus()}
      />

      {/* Assessment Scheme Configuration Modal */}
      <AssessmentSchemeDialog
        open={isAssessmentSchemeDialogOpen}
        onOpenChange={setIsAssessmentSchemeDialogOpen}
        initialScheme={assessmentScheme}
        initialPassScore={customPassScore}
        topicName={topic.name}
        onSave={handleSaveAssessmentScheme}
      />
    </div>
  );
}
