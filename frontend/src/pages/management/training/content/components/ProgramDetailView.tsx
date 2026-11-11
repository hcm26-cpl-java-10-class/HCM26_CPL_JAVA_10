import { useMemo } from "react";
import type { TrainingProgramItem } from "@/types/features/content";
import { Button } from "@/components/ui/button";
import { Download, ArrowLeft, Menu } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import { topicApi } from "@/api/features/topic.api";

interface ProgramDetailViewProps {
  program: TrainingProgramItem;
  onBack: () => void;
  onEdit: (program: TrainingProgramItem) => void;
  onSelectTopic?: (topicId: number, topicCode: string) => void;
}

// Slices colors matching frame_009.jpg
const SLICE_COLORS = [
  "#d946ef", // L4_MOCK_PROJECT: 36.6% (magenta)
  "#38bdf8", // L2_JA_JS: 14.2% (sky blue)
  "#22c55e", // L2_AN_AE: 12.1% (green)
  "#8b5cf6", // L3_JSFW: 8.6% (purple)
  "#f97316", // L2_JA_ORM: 4.7% (orange)
  "#84cc16", // L1_AL_AAE: 4.5% (lime green)
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f43f5e", // rose
  "#eab308", // amber
  "#6366f1", // indigo
  "#3b82f6", // blue
  "#10b981", // emerald
  "#a855f7", // purple
  "#f59e0b", // orange
  "#64748b", // slate
  "#fb7185", // salmon
];

export function formatDuration(hours?: number | null, isLegend = false): string {
  if (hours == null || isNaN(hours) || hours <= 0) return isLegend ? "0h" : "0h";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return isLegend ? `0h ${m}m` : `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const RADIAN = Math.PI / 180;
const renderCustomizedPieLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) => {
  if (percent == null || percent < 0.04) return null;
  const radius = (innerRadius || 0) + (outerRadius - (innerRadius || 0)) * 0.62;
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
      style={{ pointerEvents: "none", filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.5))" }}
    >
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  );
};

export function ProgramDetailView({
  program,
  onBack,
  onEdit,
  onSelectTopic,
}: ProgramDetailViewProps) {
  const subjects = useMemo(
    () => [...(program.subjects || [])].sort((a, b) => a.orderIndex - b.orderIndex),
    [program]
  );

  const totalHours = useMemo(
    () => subjects.reduce((acc, s) => acc + (s.durationHours || 0), 0),
    [subjects]
  );

  const pieData = useMemo(() => {
    return subjects.map((s, idx) => ({
      name: s.code,
      value: s.durationHours || 1,
      fullName: s.name,
      color: SLICE_COLORS[idx % SLICE_COLORS.length],
    }));
  }, [subjects]);

  const handleDownloadTopic = async (topicCode: string) => {
    try {
      const blob = await topicApi.exportFile("EXCEL");
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${topicCode}_Syllabus.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success(`Downloaded syllabus for ${topicCode}`);
    } catch {
      toast.error("Download failed");
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const pct = totalHours > 0 ? ((item.value / totalHours) * 100).toFixed(1) : "0";
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-xl px-3 py-2 text-xs z-50">
          <p className="font-semibold text-gray-800">{item.name}</p>
          <p className="text-gray-500 mt-0.5 max-w-[220px]">{item.fullName}</p>
          <p className="text-[#5b52e0] font-bold mt-1">
            {formatDuration(item.value)} ({pct}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Back button */}
      <div>
        <button
          onClick={onBack}
          className="text-gray-500 hover:text-gray-800 text-xs flex items-center gap-1.5 font-medium transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Training Program List
        </button>
      </div>

      {/* Main card matching frame_009.jpg */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8 space-y-6">
        {/* Header: Title + Edit button */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Training Program Detail</h1>
          <Button
            onClick={() => onEdit(program)}
            className="bg-[#5b52e0] hover:bg-[#4d44cb] text-white px-7 py-2 rounded-lg font-medium text-sm shadow-sm"
          >
            Edit
          </Button>
        </div>

        {/* 1. Training Program Info (exact 4-row grid from frame_009.jpg) */}
        <section>
          <h2 className="text-sm font-semibold text-gray-800 mb-3">1. Training Program Info</h2>
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white text-xs">
            {/* Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_140px_1fr] border-b border-gray-200">
              <div className="bg-[#f8f9fa] font-semibold text-gray-700 px-4 py-3 border-r border-gray-200 flex items-center">
                Course Code
              </div>
              <div className="px-4 py-3 border-r border-gray-200 text-gray-800 font-medium flex items-center">
                {program.code}
              </div>
              <div className="bg-[#f8f9fa] font-semibold text-gray-700 px-4 py-3 border-r border-gray-200 flex items-center">
                Version
              </div>
              <div className="px-4 py-3 text-gray-800 font-mono flex items-center">
                {program.version}
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_140px_1fr] border-b border-gray-200">
              <div className="bg-[#f8f9fa] font-semibold text-gray-700 px-4 py-3 border-r border-gray-200 flex items-center">
                Name
              </div>
              <div className="px-4 py-3 border-r border-gray-200 text-gray-800 font-medium flex items-center">
                {program.name}
              </div>
              <div className="bg-[#f8f9fa] font-semibold text-gray-700 px-4 py-3 border-r border-gray-200 flex items-center">
                Technical Group
              </div>
              <div className="px-4 py-3 text-gray-800 flex items-center">
                {program.technicalGroup || "JAVA"}
              </div>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_140px_1fr] border-b border-gray-200">
              <div className="bg-[#f8f9fa] font-semibold text-gray-700 px-4 py-3 border-r border-gray-200 flex items-center">
                Region
              </div>
              <div className="px-4 py-3 border-r border-gray-200 text-gray-800 flex items-center">
                {program.region || "-"}
              </div>
              <div className="bg-[#f8f9fa] font-semibold text-gray-700 px-4 py-3 border-r border-gray-200 flex items-center">
                Content Link
              </div>
              <div className="px-4 py-3 text-gray-800 truncate flex items-center">
                {program.contentLink ? (
                  <a
                    href={program.contentLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#2563eb] hover:underline"
                  >
                    {program.contentLink}
                  </a>
                ) : (
                  "-"
                )}
              </div>
            </div>

            {/* Row 4 */}
            <div className="grid grid-cols-1 md:grid-cols-[140px_1fr]">
              <div className="bg-[#f8f9fa] font-semibold text-gray-700 px-4 py-3 border-r border-gray-200 flex items-center">
                Description
              </div>
              <div className="px-4 py-3 text-gray-800 flex items-center">
                {program.description || "—"}
              </div>
            </div>
          </div>
        </section>

        {/* 2. Topic Info & 3. Topic Info chart (Side-by-side matching frame_009.jpg) */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-6 items-start pt-2">
          {/* Left Column: 2. Topic Info table */}
          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-3">2. Topic Info</h2>
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#f8f9fa] border-b border-gray-200 text-gray-700">
                    <tr>
                      <th className="text-center px-3 py-3 font-semibold w-12">No.</th>
                      <th className="text-left px-3 py-3 font-semibold w-40">Topic Code - Version</th>
                      <th className="text-left px-3 py-3 font-semibold">Topic Name</th>
                      <th className="text-center px-3 py-3 font-semibold w-28">Total Section/Day</th>
                      <th className="text-center px-3 py-3 font-semibold w-24">Training Time</th>
                      <th className="text-center px-3 py-3 font-semibold w-14">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {subjects.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-gray-400">
                          No topics assigned
                        </td>
                      </tr>
                    ) : (
                      subjects.map((s, idx) => {
                        const sessions = Math.max(1, Math.round((s.durationHours || 4) / 4));
                        const durationStr = formatDuration(s.durationHours);

                        return (
                          <tr key={s.subjectId} className="hover:bg-gray-50/80 transition-colors">
                            <td className="px-3 py-3 text-center text-gray-500 font-medium">{idx + 1}</td>
                            <td className="px-3 py-3">
                              <button
                                onClick={() => onSelectTopic?.(s.subjectId, s.code)}
                                className="font-mono text-[#2563eb] hover:underline text-left cursor-pointer"
                              >
                                {s.code} - {s.version}
                              </button>
                            </td>
                            <td className="px-3 py-3">
                              <button
                                onClick={() => onSelectTopic?.(s.subjectId, s.code)}
                                title="Topic Details"
                                className="text-[#2563eb] hover:underline font-medium text-left line-clamp-2 cursor-pointer"
                              >
                                {s.name}
                              </button>
                            </td>
                            <td className="px-3 py-3 text-center text-gray-700">
                              {sessions}
                            </td>
                            <td className="px-3 py-3 text-center text-gray-800 font-medium">
                              {durationStr}
                            </td>
                            <td className="px-2 py-3 text-center">
                              <button
                                title="Download topic syllabus"
                                onClick={() => handleDownloadTopic(s.code)}
                                className="text-gray-500 hover:text-[#5b52e0] transition-colors p-1"
                              >
                                <Download className="size-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: 3. Topic Info chart (Pie + scrollable Legend matching frame_009.jpg) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">3. Topic Info chart</h2>
              <Menu className="size-4 text-gray-400 cursor-pointer hover:text-gray-600" />
            </div>

            <div className="border border-gray-200 rounded-lg p-4 bg-white flex flex-col md:flex-row items-center gap-4">
              {pieData.length === 0 ? (
                <div className="h-60 w-full flex items-center justify-center text-gray-400 text-xs">
                  No data available for chart
                </div>
              ) : (
                <>
                  {/* Left: Solid Pie Chart with percentages directly inside slices */}
                  <div className="w-[280px] h-[280px] relative flex-shrink-0">
                    <ResponsiveContainer width={280} height={280}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          outerRadius={105}
                          innerRadius={0}
                          dataKey="value"
                          label={renderCustomizedPieLabel}
                          labelLine={false}
                        >
                          {pieData.map((d, i) => (
                            <Cell
                              key={i}
                              fill={d.color}
                              stroke="#ffffff"
                              strokeWidth={1.5}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Right: Scrollable Legend list matching frame_009.jpg */}
                  <div className="w-full flex-1 max-h-[280px] overflow-y-auto pr-2 space-y-2 text-xs border-t md:border-t-0 md:border-l border-gray-100 pt-3 md:pt-0 md:pl-3">
                    {subjects.map((s, idx) => {
                      const legendDuration = formatDuration(s.durationHours, true);
                      const color = SLICE_COLORS[idx % SLICE_COLORS.length];

                      return (
                        <div
                          key={s.subjectId}
                          onClick={() => onSelectTopic?.(s.subjectId, s.code)}
                          className="flex items-center gap-2 hover:bg-gray-50 px-1 py-0.5 rounded cursor-pointer"
                        >
                          <span
                            className="size-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="font-mono text-gray-700 truncate flex-1 font-medium">
                            {s.code}: {legendDuration}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
