import { useMemo, useState } from "react";
import type { TopicItem } from "@/types/features/content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileSpreadsheet,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { useTopicMutations, useTopicSyllabus } from "@/hooks/useTopics";
import { getTechnicalGroupBadgeClass } from "@/schemas/topic.schema";
import { describeApiError } from "@/utils/api-error.utils";
import { AssessmentSchemeDialog } from "./AssessmentSchemeDialog";
import { SyllabusImportDialog } from "./SyllabusImportDialog";
import { TopicSyllabusEditorDialog } from "./TopicSyllabusEditorDialog";
import {
  DEFAULT_PASS_SCORE,
  resetCustomAssessmentScheme,
  resolveTopicSyllabusPackage,
  saveCustomAssessmentScheme,
  type AssessmentItem,
  type TopicChapter,
} from "./topicSyllabusData";

const PIE_COLORS = {
  lab: "#4361ee",
  lecture: "#2ec4b6",
  exam: "#ff9f1c",
} as const;

const DELIVERY_BADGE_MAP: Record<string, string> = {
  "Concept/Lecture": "bg-blue-50 text-blue-700 border border-blue-200",
  "Assignment/Lab": "bg-purple-50 text-purple-700 border border-purple-200",
  "Seminar/Workshop": "bg-cyan-50 text-cyan-700 border border-cyan-200",
  "Test/Quiz": "bg-amber-50 text-amber-700 border border-amber-200",
  Exam: "bg-rose-50 text-rose-700 border border-rose-200",
};

const DEFAULT_DELIVERY_BADGE = "bg-gray-100 text-gray-700 border border-gray-200";
const RADIAN = Math.PI / 180;

interface PieLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}

function renderCustomizedPieLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  innerRadius = 0,
  outerRadius = 0,
  percent,
}: PieLabelProps) {
  if (percent == null || percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.58;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={700}
      style={{ pointerEvents: "none", filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.45))" }}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export interface TopicDetailContentProps {
  topic: TopicItem;
  canUpdate?: boolean;
  outlineEditorOpen?: boolean;
  onOutlineEditorOpenChange?: (open: boolean) => void;
  syllabusImportOpen?: boolean;
  onSyllabusImportOpenChange?: (open: boolean) => void;
  compact?: boolean;
}

export function TopicDetailContent({
  topic,
  canUpdate = false,
  outlineEditorOpen,
  onOutlineEditorOpenChange,
  syllabusImportOpen,
  onSyllabusImportOpenChange,
  compact = false,
}: TopicDetailContentProps) {
  const [activeTab, setActiveTab] = useState<"syllabus" | "schedule">("syllabus");
  const [internalOutlineOpen, setInternalOutlineOpen] = useState(false);
  const [internalImportOpen, setInternalImportOpen] = useState(false);
  const [isAssessmentDialogOpen, setIsAssessmentDialogOpen] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Record<number, boolean>>({});

  const isOutlineOpen = outlineEditorOpen ?? internalOutlineOpen;
  const setIsOutlineOpen = onOutlineEditorOpenChange ?? setInternalOutlineOpen;
  const isImportOpen = syllabusImportOpen ?? internalImportOpen;
  const setIsImportOpen = onSyllabusImportOpenChange ?? setInternalImportOpen;

  const { data: serverSyllabus, refetch: refetchSyllabus } = useTopicSyllabus(topic.id);
  const { saveTopicSyllabus, resetTopicSyllabus } = useTopicMutations();

  const resolvedPackage = useMemo(
    () => resolveTopicSyllabusPackage(topic, serverSyllabus),
    [topic, serverSyllabus]
  );

  const syllabusPackage = resolvedPackage;
  const customPassScore = resolvedPackage.passScore;
  const hasCustomScheme = resolvedPackage.hasCustomScheme;

  const reloadSyllabus = () => {
    void refetchSyllabus();
  };

  const handleSaveAssessmentScheme = async (newScheme: AssessmentItem[], passScore: string) => {
    try {
      await saveTopicSyllabus.mutateAsync({
        id: topic.id,
        payload: {
          passScore,
          meta: syllabusPackage.meta ?? serverSyllabus?.meta ?? null,
          chapters: syllabusPackage.chapters,
          assessmentScheme: newScheme,
        },
      });
      saveCustomAssessmentScheme(topic.id, newScheme, passScore, topic.code);
    } catch (err) {
      toast.error(describeApiError(err, "Failed to save assessment scheme").message);
    }
  };

  const handleResetAssessmentScheme = async () => {
    try {
      const hasChaptersOrMeta =
        syllabusPackage.chapters.length > 0 || Boolean(syllabusPackage.meta);
      if (hasChaptersOrMeta) {
        await saveTopicSyllabus.mutateAsync({
          id: topic.id,
          payload: {
            passScore: DEFAULT_PASS_SCORE,
            meta: syllabusPackage.meta ?? serverSyllabus?.meta ?? null,
            chapters: syllabusPackage.chapters,
            assessmentScheme: null,
          },
        });
      } else {
        await resetTopicSyllabus.mutateAsync(topic.id);
      }
      resetCustomAssessmentScheme(topic.id, topic.code);
      toast.success("Restored standard assessment scheme");
    } catch (err) {
      toast.error(describeApiError(err, "Failed to reset assessment scheme").message);
    }
  };

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
    return idx < 3;
  };

  const { chapters, timeAllocation, assessmentScheme, meta } = syllabusPackage;
  const totalSessions = useMemo(
    () => chapters.reduce((acc, c) => acc + c.sessions.length, 0),
    [chapters]
  );

  const totalH = timeAllocation.total;
  const labHours = timeAllocation.lab;
  const lectureHours = timeAllocation.lecture;
  const examHours = timeAllocation.exam;

  const labPct = totalH > 0 ? ((labHours / totalH) * 100).toFixed(1) : "0";
  const lecturePct = totalH > 0 ? ((lectureHours / totalH) * 100).toFixed(1) : "0";
  const examPct = totalH > 0 ? ((examHours / totalH) * 100).toFixed(1) : "0";

  const pieData = useMemo(
    () =>
      [
        { name: "Assignment/Lab", value: labHours, color: PIE_COLORS.lab },
        { name: "Concept/Lecture", value: lectureHours, color: PIE_COLORS.lecture },
        { name: "Exam & Quiz", value: examHours, color: PIE_COLORS.exam },
      ].filter((d) => d.value > 0),
    [labHours, lectureHours, examHours]
  );

  const deliveryPrinciples = meta?.deliveryPrinciples || null;

  return (
    <div className={compact ? "space-y-5" : "space-y-6"}>
      {/* Governance Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-gray-100 pb-4 gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-600 text-white">
              {topic.code}
            </span>
            <h1 className="text-lg font-bold text-gray-900">{topic.name}</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 font-mono text-gray-600">
              v{topic.version || "1.0"}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-3">
            <span>
              Doc Code: <b>{meta?.documentCode || `${topic.code}-SYL`}</b>
            </span>
            <span>&bull;</span>
            <span>
              Effective Date:{" "}
              {meta?.effectiveDate ||
                (topic.createdAt ? new Date(topic.createdAt).toLocaleDateString() : "—")}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span
            className={`px-2.5 py-1 rounded-full font-semibold border text-[11px] ${getTechnicalGroupBadgeClass(
              topic.technicalGroup
            )}`}
          >
            {topic.technicalGroup || "General"}
          </span>
          <span className="text-gray-500">
            Allocated: <b className="text-gray-800">{totalH}h</b> ({totalSessions} sessions)
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 -mt-2">
        <button
          type="button"
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
          type="button"
          onClick={() => setActiveTab("schedule")}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "schedule"
              ? "border-[#5b52e0] text-[#5b52e0]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Schedule Detail Matrix ({totalSessions} Sessions)
        </button>
      </div>

      {/* TAB 1: SYLLABUS DETAIL */}
      {activeTab === "syllabus" && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* 1. General Info */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                1. General Info &amp; Governance
              </h2>
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white text-xs divide-y divide-gray-100">
                <InfoRow label="Topic Code" value={topic.code} mono />
                <InfoRow label="Topic Name" value={topic.name} />
                <InfoRow label="Version" value={topic.version || "1.0"} mono />
                <InfoRow label="Technical Group" value={topic.technicalGroup || "—"} />
                <InfoRow
                  label="Training Audience"
                  value={meta?.trainingAudience || "Training audience not configured"}
                />
                <InfoRow
                  label="Total Sessions & Hours"
                  value={`${totalSessions} Sessions • ${totalH} Hours (${totalH * 60} mins)`}
                />
                <InfoRow
                  label="Pass Criteria"
                  value={
                    customPassScore
                      ? `Total topic GPA ${customPassScore}`
                      : `Total topic GPA ${DEFAULT_PASS_SCORE}`
                  }
                />
              </div>
            </div>

            {/* 2. Time Allocation Matrix */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                2. Time Allocation Matrix
              </h2>
              {pieData.length === 0 ? (
                <div className="border border-gray-200 rounded-lg p-8 bg-white text-center">
                  <div className="size-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                    <Clock className="size-6" />
                  </div>
                  <h4 className="text-xs font-semibold text-gray-700">
                    No Time Allocation Available
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-1 mb-4 max-w-xs mx-auto">
                    Time distribution will appear automatically when schedule sessions are imported or configured.
                  </p>
                  {canUpdate && (
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsImportOpen(true)}
                        className="text-xs gap-1.5"
                      >
                        <Upload className="size-3.5" />
                        Import CSV
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsOutlineOpen(true)}
                        className="text-[#5b52e0] border-[#5b52e0]/30 hover:bg-purple-50 text-xs gap-1.5"
                      >
                        <BookOpen className="size-3.5" />
                        Configure Outline
                      </Button>
                    </div>
                  )}
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
                            label={renderCustomizedPieLabel}
                            labelLine={false}
                          >
                            {pieData.map((d) => (
                              <Cell key={d.name} fill={d.color} stroke="#ffffff" strokeWidth={1.5} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(val, name) => {
                              const numVal = Number(val ?? 0);
                              const pct = totalH > 0 ? ((numVal / totalH) * 100).toFixed(1) : "0";
                              return [`${numVal}h (${pct}%)`, String(name ?? "")];
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-2 text-xs flex-1 w-full">
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="flex items-center gap-2 text-gray-700">
                          <span className="size-2.5 rounded-full bg-[#4361ee]" />
                          Assignment/Lab:
                        </span>
                        <span className="font-semibold text-gray-800">
                          {labHours}h ({labPct}%)
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="flex items-center gap-2 text-gray-700">
                          <span className="size-2.5 rounded-full bg-[#2ec4b6]" />
                          Concept/Lecture:
                        </span>
                        <span className="font-semibold text-gray-800">
                          {lectureHours}h ({lecturePct}%)
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="flex items-center gap-2 text-gray-700">
                          <span className="size-2.5 rounded-full bg-[#ff9f1c]" />
                          Exam &amp; Quiz:
                        </span>
                        <span className="font-semibold text-gray-800">
                          {examHours}h ({examPct}%)
                        </span>
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
              {topic.description || meta?.courseObjectives || "No course objectives configured."}
            </p>
          </div>

          {/* 3. Assessment Scheme Table */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  3. Assessment Scheme &amp; Passing Standard
                </h2>
                {hasCustomScheme ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-purple-50 text-purple-700 border-purple-200"
                  >
                    Customized
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-gray-50 text-gray-600 border-gray-200"
                  >
                    Standard Scheme
                  </Badge>
                )}
              </div>

              {canUpdate && (
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
                    onClick={() => setIsAssessmentDialogOpen(true)}
                    className="h-8 text-xs text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/60 border-indigo-200 gap-1.5 font-medium shadow-sm"
                  >
                    <SlidersHorizontal className="size-3.5" />
                    Adjust Scheme
                  </Button>
                </div>
              )}
            </div>

            {assessmentScheme.length === 0 ? (
              <div className="border border-gray-200 rounded-lg p-6 bg-white text-center text-xs text-gray-400">
                No assessment criteria configured yet.
                {canUpdate && (
                  <div className="mt-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setIsAssessmentDialogOpen(true)}
                      className="text-xs"
                    >
                      Configure Assessment Scheme
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50/90 border-b border-gray-200 text-gray-600 font-semibold text-[11px]">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">
                        Assessment Category
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">
                        Evaluation Method
                      </th>
                      <th className="text-left px-4 py-3 w-36 font-semibold text-gray-700">
                        Passing Score
                      </th>
                      <th className="text-right px-4 py-3 w-28 font-semibold text-gray-700">
                        Weight
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {assessmentScheme.map((item, idx) => (
                      <tr
                        key={`${item.category}-${idx}`}
                        className={
                          canUpdate
                            ? "hover:bg-slate-50/80 transition-colors cursor-pointer group"
                            : "hover:bg-slate-50/50 transition-colors"
                        }
                        onClick={() => {
                          if (canUpdate) setIsAssessmentDialogOpen(true);
                        }}
                        title={canUpdate ? "Click to adjust assessment scheme" : undefined}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                          <span className="flex items-center gap-2">
                            {item.category}
                            {canUpdate && (
                              <Pencil className="size-3 opacity-0 group-hover:opacity-100 text-indigo-500 transition-opacity" />
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 leading-relaxed">
                          {item.method || item.notes || "Standard evaluation method"}
                        </td>
                        <td className="px-4 py-3 font-mono font-medium text-gray-800">
                          {item.passingScore || DEFAULT_PASS_SCORE}
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
                        {customPassScore || DEFAULT_PASS_SCORE}
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
            {deliveryPrinciples && Object.keys(deliveryPrinciples).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                {Object.entries(deliveryPrinciples).map(([k, v]) => (
                  <div
                    key={k}
                    className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1"
                  >
                    <span className="font-semibold text-gray-800 block text-[11px] uppercase tracking-wide">
                      {k}
                    </span>
                    <p className="text-gray-600 leading-relaxed whitespace-pre-line text-[11px]">
                      {v}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400 text-xs border border-dashed border-gray-200 rounded-lg">
                No delivery principles configured yet. Import an official syllabus file to synchronize.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SCHEDULE DETAIL MATRIX */}
      {activeTab === "schedule" && (
        <div className="space-y-4">
          {chapters.length === 0 ? (
            <div className="text-center py-16 px-6 bg-white border-2 border-dashed border-gray-300 rounded-xl shadow-sm space-y-4">
              <div className="size-14 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <FileSpreadsheet className="size-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">
                  No Schedule Detail Matrix Configured
                </h3>
                <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                  Upload an official Syllabus CSV file or manually create chapters, sessions, and duration minutes.
                </p>
              </div>
              {canUpdate && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button
                    type="button"
                    onClick={() => setIsImportOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-xs h-9 shadow-sm"
                  >
                    <Upload className="size-4" />
                    Import Syllabus CSV
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOutlineOpen(true)}
                    className="gap-2 text-xs h-9"
                  >
                    <Plus className="size-4" />
                    Create Manually
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-indigo-50/40 p-4 rounded-xl border border-indigo-100">
                <div>
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <Layers className="size-4 text-indigo-600" />
                    Training Schedule Matrix
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Structured into {chapters.length} Units &bull; {totalSessions} Sessions &bull;{" "}
                    {totalH} Hours ({totalH * 60} mins)
                  </p>
                </div>
                {canUpdate && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsImportOpen(true)}
                      className="gap-1.5 text-xs h-8 bg-white"
                    >
                      <Upload className="size-3.5 text-indigo-600" />
                      Re-import CSV
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setIsOutlineOpen(true)}
                      className="bg-[#5b52e0] hover:bg-[#4a41d0] text-white gap-1.5 text-xs h-8 shadow-sm"
                    >
                      <BookOpen className="size-3.5" />
                      Edit Outline
                    </Button>
                  </div>
                )}
              </div>

              {chapters.map((ch, chIdx) => (
                <ScheduleChapterAccordion
                  key={ch.id}
                  chapter={ch}
                  index={chIdx}
                  expanded={isChapterOpen(ch.id, chIdx)}
                  onToggle={() => toggleChapter(ch.id)}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Outline, Syllabus Import, and Assessment Modals */}
      <TopicSyllabusEditorDialog
        open={isOutlineOpen}
        onOpenChange={setIsOutlineOpen}
        topic={topic}
        onSaved={reloadSyllabus}
      />

      <SyllabusImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        targetTopic={topic}
        onSuccess={reloadSyllabus}
      />

      <AssessmentSchemeDialog
        open={isAssessmentDialogOpen}
        onOpenChange={setIsAssessmentDialogOpen}
        initialScheme={assessmentScheme}
        initialPassScore={customPassScore}
        topicName={topic.name}
        onSave={handleSaveAssessmentScheme}
      />
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex">
      <div className="w-40 px-4 py-2.5 font-semibold text-gray-500 bg-gray-50 border-r border-gray-100 shrink-0">
        {label}
      </div>
      <div
        className={`px-4 py-2.5 text-gray-800 flex-1 ${mono ? "font-mono font-medium" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function ScheduleChapterAccordion({
  chapter,
  index,
  expanded,
  onToggle,
}: {
  chapter: TopicChapter;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50/80 hover:bg-gray-100 transition-colors text-left border-b border-gray-200/60"
      >
        <div className="flex items-center gap-2.5">
          <span className="size-6 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">
            {chapter.unitNumber || index + 1}
          </span>
          <span className="font-semibold text-sm text-gray-900">{chapter.title}</span>
          <span className="text-xs text-gray-500 font-normal">
            ({chapter.sessions.length} sessions)
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="size-4 text-gray-500" />
        ) : (
          <ChevronDown className="size-4 text-gray-500" />
        )}
      </button>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50/50 border-b border-gray-200 text-gray-600 font-semibold text-[11px]">
              <tr>
                <th className="text-center px-3 py-2.5 w-14">Session</th>
                <th className="text-center px-3 py-2.5 w-24">Shift</th>
                <th className="text-left px-3 py-2.5 w-56">Content</th>
                <th className="text-left px-3 py-2.5">Learning Objectives</th>
                <th className="text-left px-3 py-2.5 w-36">Delivery Type</th>
                <th className="text-center px-3 py-2.5 w-24">Duration</th>
                <th className="text-center px-3 py-2.5 w-20">Format</th>
                <th className="text-left px-3 py-2.5 w-52">Materials / Logistics</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {chapter.sessions.map((sess, idx) => (
                <tr key={`${sess.session}-${idx}`} className="hover:bg-indigo-50/20">
                  <td className="px-3 py-3 text-center font-bold text-gray-800">{sess.session}</td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    {sess.sessionTime === "Afternoon" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Afternoon
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        Morning
                      </span>
                    )}
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
                        DELIVERY_BADGE_MAP[sess.deliveryType] ?? DEFAULT_DELIVERY_BADGE
                      }`}
                    >
                      {sess.deliveryType}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-gray-700">
                    {sess.durationMins
                      ? `${sess.durationMins}m (${sess.durationHours}h)`
                      : sess.duration}
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
                      <span className="font-mono text-gray-700">{sess.materials || "—"}</span>
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
}
