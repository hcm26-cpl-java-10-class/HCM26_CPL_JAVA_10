import { useState, useMemo } from "react";
import type { TopicItem } from "@/types/features/content";
import { Button } from "@/components/ui/button";
import { Download, ArrowLeft, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { topicApi } from "@/api/features/topic.api";
import { getTopicSyllabusPackage } from "./topicSyllabusData";

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

  // Dynamic syllabus data generated specifically for this topic
  const syllabusPackage = useMemo(() => getTopicSyllabusPackage(topic), [topic]);
  const { chapters, totalSessions, timeAllocation, assessmentScheme } = syllabusPackage;

  // Track expanded state for all chapters
  const [expandedChapters, setExpandedChapters] = useState<Record<number, boolean>>({});

  const toggleChapter = (chapterId: number) => {
    setExpandedChapters((prev) => ({
      ...prev,
      // Default first two open if not explicitly toggled
      [chapterId]: prev[chapterId] !== undefined ? !prev[chapterId] : false,
    }));
  };

  const isChapterOpen = (chapterId: number, idx: number) => {
    if (expandedChapters[chapterId] !== undefined) {
      return expandedChapters[chapterId];
    }
    // Default open first 2 chapters, rest closed
    return idx < 2;
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

  const handleDownload = async () => {
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

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 text-gray-600 hover:text-gray-900 -ml-2"
        >
          <ArrowLeft className="size-4" />
          Back to Syllabus / Topic List
        </Button>
        <div className="flex items-center gap-2">
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(topic)}
              className="text-gray-700"
            >
              Edit Topic
            </Button>
          )}
          <Button
            onClick={handleDownload}
            className="bg-[#5b52e0] hover:bg-[#4d44cb] text-white px-5 py-2 rounded-lg font-medium shadow-sm gap-2"
          >
            <Download className="size-4" />
            Download
          </Button>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-6">
        <h1 className="text-xl font-bold text-gray-800">Topic Detail</h1>

        {/* Tab Sub-navigation (matching nav_07.jpg) */}
        <div className="flex border-b border-gray-200 -mt-2">
          <button
            onClick={() => setActiveTab("syllabus")}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "syllabus"
                ? "border-[#5b52e0] text-[#5b52e0]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Syllabus Detail
          </button>
          <button
            onClick={() => setActiveTab("schedule")}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "schedule"
                ? "border-[#5b52e0] text-[#5b52e0]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Schedule Detail
          </button>
        </div>

        {/* TAB 1: SYLLABUS DETAIL */}
        {activeTab === "syllabus" && (
          <div className="space-y-8">
            {/* Top 2 Columns: General Info & Time Allocation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Left: 1. General Info */}
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-3">1. General Info</h2>
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white text-xs divide-y divide-gray-100">
                  <div className="flex">
                    <div className="w-40 px-4 py-3 font-semibold text-gray-500 bg-gray-50 border-r border-gray-100">
                      Code
                    </div>
                    <div className="px-4 py-3 font-mono font-medium text-gray-800 flex-1">
                      {topic.code}
                    </div>
                  </div>

                  <div className="flex">
                    <div className="w-40 px-4 py-3 font-semibold text-gray-500 bg-gray-50 border-r border-gray-100">
                      Name
                    </div>
                    <div className="px-4 py-3 font-medium text-gray-800 flex-1">
                      {topic.name}
                    </div>
                  </div>

                  <div className="flex">
                    <div className="w-40 px-4 py-3 font-semibold text-gray-500 bg-gray-50 border-r border-gray-100">
                      Version
                    </div>
                    <div className="px-4 py-3 font-mono text-gray-800 flex-1">
                      {topic.version}
                    </div>
                  </div>

                  <div className="flex">
                    <div className="w-40 px-4 py-3 font-semibold text-gray-500 bg-gray-50 border-r border-gray-100">
                      Technical Group
                    </div>
                    <div className="px-4 py-3 text-gray-800 flex-1">
                      {topic.technicalGroup || "JAVA"}
                    </div>
                  </div>

                  <div className="flex">
                    <div className="w-40 px-4 py-3 font-semibold text-gray-500 bg-gray-50 border-r border-gray-100">
                      Total Session/Day
                    </div>
                    <div className="px-4 py-3 text-gray-800 flex-1 font-medium">
                      {totalSessions}
                    </div>
                  </div>

                  <div className="flex">
                    <div className="w-40 px-4 py-3 font-semibold text-gray-500 bg-gray-50 border-r border-gray-100">
                      Pass Criteria
                    </div>
                    <div className="px-4 py-3 text-gray-800 flex-1">
                      Total topic GPA &gt;= 6/10
                    </div>
                  </div>

                  <div className="flex">
                    <div className="w-40 px-4 py-3 font-semibold text-gray-500 bg-gray-50 border-r border-gray-100">
                      Re-Test Number
                    </div>
                    <div className="px-4 py-3 text-gray-800 flex-1">
                      2 Times
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: 2. Time Allocation */}
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-3">2. Time Allocation</h2>
                <div className="border border-gray-200 rounded-lg p-5 bg-white">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="w-48 h-48 relative flex-shrink-0">
                      <ResponsiveContainer width="100%" height={192}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                            label={({ percent }) =>
                              percent != null && percent > 0.05
                                ? `${(percent * 100).toFixed(1)}%`
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
                      <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full bg-[#4361ee] flex-shrink-0" />
                        <span className="text-gray-700">Assignment/Lab: <b>{labHours}h</b> ({labPct}%)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full bg-[#2ec4b6] flex-shrink-0" />
                        <span className="text-gray-700">Concept/Lecture: <b>{lectureHours}h</b> ({lecturePct}%)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full bg-[#ff9f1c] flex-shrink-0" />
                        <span className="text-gray-700">Exam: <b>{examHours}h</b> ({examPct}%)</span>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                        <span className="size-3 rounded-full bg-red-500 flex-shrink-0" />
                        <span className="text-red-600 font-bold">Total: {totalH}h</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom: 3. Assessment Scheme */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">3. Assessment Scheme</h2>
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                    <tr>
                      <th className="text-left px-4 py-3">Assessment Category</th>
                      <th className="text-left px-4 py-3">Evaluation Method</th>
                      <th className="text-center px-4 py-3 w-32">Passing Score</th>
                      <th className="text-right px-4 py-3 w-28">Weight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {assessmentScheme.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{item.category}</td>
                        <td className="px-4 py-3 text-gray-500">{item.method}</td>
                        <td className="px-4 py-3 text-center">{item.passingScore}</td>
                        <td className="px-4 py-3 text-right font-semibold">{item.weight}</td>
                      </tr>
                    ))}
                    <tr className="bg-purple-50/50 font-bold text-gray-900 border-t border-purple-100">
                      <td className="px-4 py-3" colSpan={2}>Overall Topic Result</td>
                      <td className="px-4 py-3 text-center text-[#5b52e0]">&gt;= 6.0 / 10</td>
                      <td className="px-4 py-3 text-right text-[#5b52e0]">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SCHEDULE DETAIL (matching nav_06.jpg) */}
        {activeTab === "schedule" && (
          <div className="space-y-4">
            {chapters.map((ch, chIdx) => {
              const isExpanded = isChapterOpen(ch.id, chIdx);
              return (
                <div key={ch.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                  {/* Accordion header */}
                  <button
                    onClick={() => toggleChapter(ch.id)}
                    className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <span className="font-semibold text-sm text-gray-800">{ch.title}</span>
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
                        <thead className="bg-gray-50/50 border-b border-t border-gray-200 text-gray-600 font-semibold">
                          <tr>
                            <th className="text-center px-3 py-2.5 w-16">Session</th>
                            <th className="text-left px-3 py-2.5 w-48">Content</th>
                            <th className="text-left px-3 py-2.5 w-56">Learning Objectives</th>
                            <th className="text-left px-3 py-2.5 w-32">Delivery Type</th>
                            <th className="text-center px-3 py-2.5 w-20">Duration</th>
                            <th className="text-center px-3 py-2.5 w-24">Training Format</th>
                            <th className="text-left px-3 py-2.5">Training Materials / Logistics &amp; General Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                          {ch.sessions.map((sess, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/80">
                              <td className="px-3 py-3 text-center font-semibold text-gray-600">
                                {sess.session}
                              </td>
                              <td className="px-3 py-3 font-medium whitespace-pre-line text-gray-800">
                                {sess.content}
                              </td>
                              <td className="px-3 py-3 text-gray-600">
                                {sess.objectives}
                              </td>
                              <td className="px-3 py-3">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                                    sess.deliveryType === "Concept/Lecture"
                                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                                      : sess.deliveryType === "Assignment/Lab"
                                      ? "bg-purple-50 text-purple-700 border border-purple-200"
                                      : sess.deliveryType === "Exam"
                                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                                      : "bg-teal-50 text-teal-700 border border-teal-200"
                                  }`}
                                >
                                  {sess.deliveryType}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-center font-mono font-medium">
                                {sess.duration}
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                                    sess.trainingFormat === "Online"
                                      ? "bg-green-50 text-green-700 border border-green-200"
                                      : "bg-gray-100 text-gray-700 border border-gray-200"
                                  }`}
                                >
                                  {sess.trainingFormat}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-gray-600 break-all">
                                {sess.materials.startsWith("http") ? (
                                  <a
                                    href={sess.materials}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[#5b52e0] hover:underline inline-flex items-center gap-1 font-medium"
                                  >
                                    {sess.materials}
                                    <ExternalLink className="size-3" />
                                  </a>
                                ) : (
                                  <span className="font-mono text-gray-700">{sess.materials}</span>
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
          </div>
        )}
      </div>
    </div>
  );
}
