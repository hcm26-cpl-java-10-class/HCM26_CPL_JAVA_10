import { RefreshCw, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PeriodPreset } from "../dashboard-api";

interface CourseOption {
  id: number;
  name: string;
}

interface DashboardFilterBarProps {
  preset: PeriodPreset;
  from: string;
  to: string;
  zone?: string;
  courseId?: number;
  courses?: CourseOption[];
  loading?: boolean;
  onPresetChange: (preset: PeriodPreset) => void;
  onDateChange: (from: string, to: string) => void;
  onCourseChange?: (courseId?: number) => void;
  onRefresh: () => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
  onGenerateAi: () => void;
}

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "THIS_WEEK", label: "This week" },
  { value: "THIS_MONTH", label: "This month" },
  { value: "LAST_30_DAYS", label: "Last 30 days" },
  { value: "THIS_QUARTER", label: "This quarter" },
  { value: "CUSTOM", label: "Custom" },
];

export function DashboardFilterBar({
  preset,
  from,
  to,
  zone,
  courseId,
  courses,
  loading,
  onPresetChange,
  onDateChange,
  onCourseChange,
  onRefresh,
  onExportPdf,
  onExportExcel,
  onGenerateAi,
}: DashboardFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant={preset === item.value ? "default" : "outline"}
              onClick={() => onPresetChange(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={onExportPdf}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            PDF
          </Button>
          <Button size="sm" variant="outline" onClick={onExportExcel}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Excel
          </Button>
          <Button size="sm" onClick={onGenerateAi}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Generate AI Report
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        {preset === "CUSTOM" && (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              aria-label="From date"
              value={from}
              max={to}
              onChange={(e) => onDateChange(e.target.value, to)}
              className="h-8 w-auto"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              aria-label="To date"
              value={to}
              min={from}
              onChange={(e) => onDateChange(from, e.target.value)}
              className="h-8 w-auto"
            />
          </div>
        )}
        {onCourseChange && courses && courses.length > 0 && (
          <select
            aria-label="Filter by course"
            value={courseId ?? ""}
            onChange={(e) => onCourseChange(e.target.value ? Number(e.target.value) : undefined)}
            className="h-8 rounded-md border bg-background px-2.5 text-sm"
          >
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          Range: <strong className="font-medium text-foreground">{from}</strong> –{" "}
          <strong className="font-medium text-foreground">{to}</strong>
          {zone ? ` · ${zone}` : ""}
        </span>
      </div>
    </div>
  );
}
