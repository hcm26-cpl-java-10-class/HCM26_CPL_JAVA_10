import { useMemo } from "react";
import type { TrainingProgramItem } from "@/types/features/content";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ProgramDetailModalProps {
  program: TrainingProgramItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (program: TrainingProgramItem) => void;
}

const COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#c084fc",
  "#f59e0b", "#10b981", "#ef4444", "#3b82f6",
  "#ec4899", "#14b8a6", "#f97316", "#84cc16",
  "#06b6d4", "#64748b", "#d946ef", "#0ea5e9",
];

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

export function ProgramDetailModal({
  program,
  open,
  onOpenChange,
  onEdit,
}: ProgramDetailModalProps) {
  if (!program) return null;

  const subjects = useMemo(
    () => [...(program.subjects || [])].sort((a, b) => a.orderIndex - b.orderIndex),
    [program]
  );

  const pieData = useMemo(() =>
    subjects.map((s) => ({
      name: s.code,
      value: s.durationHours || 0,
      fullName: s.name,
    })),
    [subjects]
  );

  const totalHours = subjects.reduce((acc, s) => acc + (s.durationHours || 0), 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const pct = totalHours > 0 ? ((item.value / totalHours) * 100).toFixed(1) : "0";
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
          <p className="font-semibold text-gray-800">{item.name}</p>
          <p className="text-gray-500 mt-0.5 max-w-[180px] line-clamp-2">{item.fullName}</p>
          <p className="text-purple-600 font-bold mt-1">{item.value}h ({pct}%)</p>
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
            <DialogTitle className="text-lg font-semibold text-gray-800">
              Training Program Detail
            </DialogTitle>
          </DialogHeader>
          {onEdit && (
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => { onOpenChange(false); onEdit(program); }}
            >
              Edit
            </Button>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 bg-gray-50">

          {/* Section 1: Training Program Info */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">1. Training Program Info</h2>
            <div className="grid grid-cols-2 gap-0 border border-gray-200 rounded-lg overflow-hidden bg-white">
              {[
                ["Course Code", program.code],
                ["Version", program.version],
                ["Name", program.name],
                ["Technical Group", program.technicalGroup || "—"],
                ["Region", program.region || "—"],
                ["Content Link", program.contentLink || "—"],
                ["Description", program.description || "—"],
                ["Status", program.status === "ACTIVE" ? "🟢 Active" : "⚪ Inactive"],
              ].map(([label, value], i) => (
                <div key={i} className={`flex border-b border-gray-100 ${i % 2 === 0 ? "" : ""}`}>
                  <div className="w-40 px-4 py-2.5 text-xs font-semibold text-gray-500 bg-gray-50 border-r border-gray-100 flex-shrink-0">
                    {label}
                  </div>
                  <div className="px-4 py-2.5 text-sm text-gray-800 flex-1 break-words">
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 2 + 3: Topics table + Pie chart */}
          <section className="grid grid-cols-[1fr_340px] gap-4 items-start">
            {/* Topic table */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">2. Topic Info</h2>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 w-10">No.</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 w-32">Topic Code - Version</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Topic Name</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 w-20">Training Time</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {subjects.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-gray-400 text-xs">
                          No topics assigned
                        </td>
                      </tr>
                    ) : (
                      subjects.map((s, idx) => (
                        <tr key={s.subjectId} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-500 text-xs">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <span className="text-gray-800 hover:text-[#5b52e0] text-xs font-mono font-semibold cursor-pointer transition-colors">
                              {s.code} - {s.version}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-700 text-xs">{s.name}</td>
                          <td className="px-3 py-2 text-right text-gray-700 text-xs font-medium">
                            {s.durationHours ? `${s.durationHours}h` : "—"}
                          </td>
                          <td className="px-2 py-2">
                            <button className="text-gray-300 hover:text-gray-500">
                              <Download className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pie chart */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">3. Topic Info chart</h2>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                {pieData.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-gray-400 text-xs">No data</div>
                ) : (
                  <div>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={85}
                          dataKey="value"
                          label={renderCustomizedPieLabel}
                          labelLine={false}
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Legend */}
                    <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                      {subjects.map((s, i) => {
                        return (
                          <div key={s.subjectId} className="flex items-center gap-2 text-xs">
                            <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="font-mono text-gray-600 truncate flex-1">{s.code}: {s.durationHours}h</span>
                          </div>
                        );
                      })}
                      <div className="flex items-center gap-2 text-xs pt-1 border-t border-gray-100 mt-1">
                        <span className="size-2.5 rounded-full flex-shrink-0 bg-red-500" />
                        <span className="font-semibold text-red-600">Total: {totalHours}h</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
