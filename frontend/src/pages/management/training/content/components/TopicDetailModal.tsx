import { useState, useEffect } from "react";
import type { TopicItem } from "@/types/features/content";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Calendar, Clock, BookOpen, Upload, RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  getTopicSyllabusPackage,
  getCustomPassScore,
  getCustomAssessmentScheme,
  saveCustomAssessmentScheme,
  resetCustomAssessmentScheme,
} from "./topicSyllabusData";
import type { TopicSyllabusPackage, AssessmentItem } from "./topicSyllabusData";
import { TopicSyllabusEditorDialog } from "./TopicSyllabusEditorDialog";
import { SyllabusImportDialog } from "./SyllabusImportDialog";
import { AssessmentSchemeDialog } from "./AssessmentSchemeDialog";

interface TopicDetailModalProps {
  topic: TopicItem | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit?: (t: TopicItem) => void;
}

// Fixed colors matching TopicDetailView standard categories
const PIE_COLORS: Record<string, string> = {
  "Assignment/Lab": "#6366f1",
  "Concept/Lecture": "#10b981",
  "Exam & Quiz": "#f59e0b",
};
const PIE_COLOR_LIST = ["#6366f1", "#10b981", "#f59e0b"];

const RADIAN = Math.PI / 180;
const renderCustomizedPieLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) => {
  if (percent == null || percent < 0.05) return null;
  const radius = (innerRadius || 0) + (outerRadius - (innerRadius || 0)) * 0.58;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={10}
      fontWeight={700}
      style={{ pointerEvents: "none", filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.45))" }}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function TopicDetailModal({ topic, open, onOpenChange, onEdit }: TopicDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"syllabus" | "schedule">("syllabus");
  const [isOutlineEditorOpen, setIsOutlineEditorOpen] = useState(false);
  const [isSyllabusImportOpen, setIsSyllabusImportOpen] = useState(false);
  const [isAssessmentSchemeDialogOpen, setIsAssessmentSchemeDialogOpen] = useState(false);

  // Dynamic syllabus data
  const [pkg, setPkg] = useState<TopicSyllabusPackage | null>(null);
  const [customPassScore, setCustomPassScore] = useState<string>(">= 6.0 / 10");

  useEffect(() => {
    if (topic) {
      setPkg(getTopicSyllabusPackage(topic));
      setCustomPassScore(getCustomPassScore(topic.id) || ">= 6.0 / 10");
    }
  }, [topic]);

  if (!topic) return null;

  const currentPkg = pkg || getTopicSyllabusPackage(topic);
  const { chapters, totalSessions, timeAllocation } = currentPkg;
  const totalH = timeAllocation.total || topic.durationHours || 0;
  const totalMins = totalH * 60;

  const hasCustomScheme = !!(
    (topic.id && getCustomAssessmentScheme(topic.id)) ||
    (topic.code && getCustomAssessmentScheme(topic.code))
  );

  const handleSaveAssessmentScheme = (newScheme: AssessmentItem[], passScore: string) => {
    saveCustomAssessmentScheme(topic.id, newScheme, passScore, topic.code);
    setCustomPassScore(passScore);
    setPkg((prev) => prev ? { ...prev, assessmentScheme: newScheme } : prev);
  };

  const handleResetAssessmentScheme = () => {
    resetCustomAssessmentScheme(topic.id, topic.code);
    setCustomPassScore(">= 6.0 / 10");
    setPkg(getTopicSyllabusPackage(topic));
  };

  // Breakdown for pie chart from actual package — standardized categories matching TopicDetailView
  const pieData = [
    { name: "Assignment/Lab", value: timeAllocation.lab },
    { name: "Concept/Lecture", value: timeAllocation.lecture },
    { name: "Exam & Quiz", value: timeAllocation.exam },
  ].filter((d) => d.value > 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const pct = totalH > 0 ? ((item.value / totalH) * 100).toFixed(1) : "0";
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
          <p className="font-semibold text-gray-800">{item.name}</p>
          <p className="text-purple-600 font-bold">{item.value}h ({pct}%)</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl md:max-w-5xl max-h-[88vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-800">Topic Detail</DialogTitle>
          </DialogHeader>
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => { onOpenChange(false); onEdit?.(topic); }}
          >
            Edit Topic
          </Button>
        </div>

        {/* Tabs nav */}
        <div className="flex border-b border-gray-200 bg-white px-6">
          <button
            onClick={() => setActiveTab("syllabus")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "syllabus"
                ? "text-purple-700 border-purple-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            Syllabus Detail
          </button>
          <button
            onClick={() => setActiveTab("schedule")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ml-2 ${
              activeTab === "schedule"
                ? "text-purple-700 border-purple-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            Schedule Detail ({totalSessions} sessions)
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-5 space-y-6">

          {activeTab === "syllabus" && (
            <>
              {/* Section 1: General Info + Pie Chart (side by side) */}
              <div className="grid grid-cols-[1fr_310px] gap-4 items-start">
                {/* General Info */}
                <section>
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">1. General Info</h2>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    {[
                      ["Code", topic.code],
                      ["Name", topic.name],
                      ["Version", `v${topic.version}`],
                      ["Technical Group", topic.technicalGroup || "—"],
                      ["Total Duration", `${totalH} hours (${totalMins.toLocaleString()} mins)`],
                      ["Total Sessions", totalSessions > 0 ? `${totalSessions} sessions` : "Not scheduled yet"],
                      ["Pass Criteria", getCustomPassScore(topic.id) || ">= 6.0 / 10"],
                      ["Re-Test Allowed", "Up to 2 attempts"],
                      ["Status", topic.isActive ? "🟢 Active" : "⚪ Inactive"],
                    ].map(([label, value], i) => (
                      <div key={i} className="flex border-b border-gray-100 last:border-0">
                        <div className="w-40 px-4 py-2.5 text-xs font-medium text-gray-500 bg-gray-50 border-r border-gray-100 flex-shrink-0">
                          {label}
                        </div>
                        <div className="px-4 py-2.5 text-sm text-gray-800 break-words flex-1">
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Time Allocation Pie Chart */}
                <section>
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">2. Time Allocation</h2>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    {pieData.length === 0 ? (
                      <div className="h-44 flex items-center justify-center text-gray-400 text-xs">No data</div>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={35}
                              outerRadius={75}
                              dataKey="value"
                              label={renderCustomizedPieLabel}
                              labelLine={false}
                            >
                              {pieData.map((d, i) => (
                                <Cell key={i} fill={PIE_COLORS[d.name] ?? PIE_COLOR_LIST[i % PIE_COLOR_LIST.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="mt-2 space-y-1.5">
                          {pieData.map((d, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[d.name] ?? PIE_COLOR_LIST[i % PIE_COLOR_LIST.length] }} />
                              <span className="text-gray-600 truncate flex-1">{d.name}: {d.value}h</span>
                            </div>
                          ))}
                          <div className="flex items-center gap-2 text-xs pt-1 border-t border-gray-100 mt-1">
                            <span className="size-2.5 rounded-full flex-shrink-0 bg-red-500" />
                            <span className="font-semibold text-red-600">Total: {totalH}h ({totalMins}m)</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </section>
              </div>

              {/* Section 3: Assessment Scheme */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-700">3. Assessment Scheme</h2>
                  <div className="flex items-center gap-2">
                    {hasCustomScheme && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleResetAssessmentScheme}
                        className="h-7 text-xs text-gray-500 hover:text-gray-700 gap-1.5"
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
                      className="h-7 text-xs text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/60 border-indigo-200 gap-1.5 font-medium shadow-sm"
                    >
                      <SlidersHorizontal className="size-3.5" />
                      Adjust Scheme
                    </Button>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 w-12">No.</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Assessment Name</th>
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 w-24">Quantity</th>
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 w-32">Weight (%)</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Passing Criteria / Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {currentPkg.assessmentScheme && currentPkg.assessmentScheme.length > 0 ? (
                        currentPkg.assessmentScheme.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 text-gray-500 text-xs">{idx + 1}</td>
                            <td className="px-4 py-2.5 text-gray-800 text-sm font-medium">{item.category}</td>
                            <td className="px-4 py-2.5 text-center text-gray-700 text-sm">{item.count ?? 1}</td>
                            <td className="px-4 py-2.5 text-center text-gray-700 text-sm font-semibold">{item.weight}</td>
                            <td className="px-4 py-2.5 text-gray-500 text-xs">{item.passingScore || item.method || item.notes || "—"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center py-6 text-gray-400 text-xs">
                            Chưa cấu hình tiêu chí đánh giá
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Description */}
                {topic.description && (
                  <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description & Objectives</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{topic.description}</p>
                  </div>
                )}
              </section>
            </>
          )}

          {activeTab === "schedule" && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">Topic Schedule &amp; Delivery Plan</h2>
                  <p className="text-xs text-gray-500">Day-by-day session outline and lesson objectives</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mr-2">
                    <span className="flex items-center gap-1"><Clock className="size-3.5 text-purple-600" /> Total: {totalH}h</span>
                    <span className="flex items-center gap-1 ml-2"><Calendar className="size-3.5 text-purple-600" /> {totalSessions} Sessions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsSyllabusImportOpen(true)}
                      className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs gap-1.5"
                    >
                      <Upload className="size-3.5" />
                      Import Syllabus
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setIsOutlineEditorOpen(true)}
                      className="bg-[#5b52e0] hover:bg-[#4a41d0] text-white text-xs gap-1.5 shadow-sm"
                    >
                      <BookOpen className="size-3.5" />
                      Edit Outline
                    </Button>
                  </div>
                </div>
              </div>

              {chapters.length === 0 ? (
                <div className="text-center py-12 px-4 bg-white border border-dashed border-gray-200 rounded-lg">
                  <BookOpen className="size-8 text-gray-300 mx-auto mb-2" />
                  <p className="font-semibold text-xs text-gray-700">Chưa có lịch trình môn học</p>
                  <p className="text-[11px] text-gray-400 mt-1 mb-4">Bạn có thể tự cấu hình các chương và bài học hoặc import file Syllabus chuẩn.</p>
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setIsOutlineEditorOpen(true)}
                      className="bg-[#5b52e0] hover:bg-[#4a41d0] text-white text-xs gap-1.5"
                    >
                      <BookOpen className="size-3.5" />
                      Tự cấu hình lịch trình
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsSyllabusImportOpen(true)}
                      className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs gap-1.5"
                    >
                      <Upload className="size-3.5" />
                      Import Syllabus
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {chapters.map((ch) => (
                    <div key={ch.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                      <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                        <span className="font-semibold text-xs text-gray-800">{ch.title}</span>
                        <span className="text-[11px] text-gray-500 font-medium">
                          {ch.sessions.length} sessions &bull; {ch.sessions.reduce((a, b) => a + (Number(b.durationHours) || 0), 0)}h
                        </span>
                      </div>
                      <div className="p-3 space-y-2.5">
                        {ch.sessions.map((s) => (
                          <div key={s.session} className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50/60 transition-colors">
                            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-gray-100">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-700">
                                  Session {s.session}
                                </span>
                                <h4 className="text-xs font-semibold text-gray-800">{s.content}</h4>
                              </div>
                              <span className="text-xs font-mono font-medium text-gray-500">
                                {s.duration}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                              <div>
                                <span className="text-gray-400 block text-[11px]">Format &amp; Delivery</span>
                                <span className="text-gray-700 font-medium flex items-center gap-1">
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                                    s.deliveryType.includes("Lab") ? "bg-blue-50 text-blue-700" :
                                    s.deliveryType.includes("Exam") ? "bg-amber-50 text-amber-700" : "bg-purple-50 text-purple-700"
                                  }`}>
                                    {s.deliveryType}
                                  </span>
                                  &bull; {s.trainingFormat}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400 block text-[11px]">Learning Objectives</span>
                                <span className="text-gray-600 line-clamp-1">{s.objectives}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

        </div>
      </DialogContent>

      {/* Editor Modal */}
      <TopicSyllabusEditorDialog
        topic={topic}
        open={isOutlineEditorOpen}
        onOpenChange={setIsOutlineEditorOpen}
        onSaved={(newPkg) => setPkg(newPkg)}
      />

      {/* Syllabus Import Dialog for this topic */}
      {topic && (
        <SyllabusImportDialog
          targetTopic={topic}
          open={isSyllabusImportOpen}
          onOpenChange={setIsSyllabusImportOpen}
          onSuccess={() => {
            setPkg(getTopicSyllabusPackage(topic));
          }}
        />
      )}

      {/* Assessment Scheme Dialog */}
      <AssessmentSchemeDialog
        open={isAssessmentSchemeDialogOpen}
        onOpenChange={setIsAssessmentSchemeDialogOpen}
        topicName={topic.name}
        initialScheme={currentPkg.assessmentScheme}
        initialPassScore={customPassScore}
        onSave={handleSaveAssessmentScheme}
      />
    </Dialog>
  );
}
