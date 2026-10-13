import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ScheduleRole, ScheduleView, SessionCategory } from "@/types/features/schedule";
import { getWeekDays } from "@/utils/schedule.utils";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight, CalendarDays, CalendarRange } from "lucide-react";

interface ScheduleToolbarProps {
  view: ScheduleView;
  onViewChange: (view: ScheduleView) => void;
  anchor: dayjs.Dayjs;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  roleFilter: "ALL" | ScheduleRole;
  onRoleFilterChange: (value: "ALL" | ScheduleRole) => void;
  categoryFilter: "ALL" | SessionCategory;
  onCategoryFilterChange: (value: "ALL" | SessionCategory) => void;
}

const VIEW_OPTIONS: Array<{ value: ScheduleView; label: string; icon: typeof CalendarDays }> = [
  { value: "month", label: "Month", icon: CalendarDays },
  { value: "week", label: "Week", icon: CalendarRange },
];

const CATEGORY_OPTIONS: SessionCategory[] = ["LESSON", "REVIEW", "EXAM", "PROJECT", "MENTORING"];

const getTitle = (view: ScheduleView, anchor: dayjs.Dayjs): string => {
  if (view === "month") {
    return anchor.format("MMMM YYYY");
  }

  if (view === "week") {
    const [first, last] = [getWeekDays(anchor)[0], getWeekDays(anchor)[6]];

    if (first.month() === last.month()) {
      return `${first.format("MMM D")} – ${last.format("D, YYYY")}`;
    }

    if (first.year() === last.year()) {
      return `${first.format("MMM D")} – ${last.format("MMM D, YYYY")}`;
    }

    return `${first.format("MMM D, YYYY")} – ${last.format("MMM D, YYYY")}`;
  }

  return anchor.format("MMMM YYYY");
};

export function ScheduleToolbar({
  view,
  onViewChange,
  anchor,
  onToday,
  onPrev,
  onNext,
  roleFilter,
  onRoleFilterChange,
  categoryFilter,
  onCategoryFilterChange,
}: ScheduleToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
      {/* Left: navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onToday}>
          Today
        </Button>
        <div className="flex items-center">
          <Button variant="ghost" size="icon-sm" onClick={onPrev} aria-label="Previous">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onNext} aria-label="Next">
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <h2 className="min-w-44 px-1 text-lg font-semibold capitalize tracking-tight">
          {getTitle(view, anchor)}
        </h2>
      </div>

      {/* Right: filters + view switcher */}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Select value={roleFilter} onValueChange={(value) => onRoleFilterChange(value as "ALL" | ScheduleRole)}>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All roles</SelectItem>
            <SelectItem value="STUDENT">Student</SelectItem>
            <SelectItem value="TEACHER">Teacher</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={categoryFilter}
          onValueChange={(value) => onCategoryFilterChange(value as "ALL" | SessionCategory)}
        >
          <SelectTrigger size="sm" className="w-36">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {CATEGORY_OPTIONS.map((category) => (
              <SelectItem key={category} value={category}>
                {category.charAt(0) + category.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center rounded-lg border border-border bg-muted p-0.5">
          {VIEW_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => onViewChange(value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors",
                view === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
