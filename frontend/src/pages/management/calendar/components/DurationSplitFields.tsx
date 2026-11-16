import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Sparkles } from "lucide-react";
import { calculateEndTime } from "../calendar.utils";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type DurationSplitFieldsProps = {
  totalHours: number;
  onTotalHoursChange: (hours: number) => void;
  sessionHours: number;
  onSessionHoursChange: (hours: number) => void;
  dailyStart: string;
  onDailyStartChange: (time: string) => void;
  skipWeekends: boolean;
  onSkipWeekendsChange: (skip: boolean) => void;
  startDate?: string;
  onStartDateChange?: (date: string) => void;
  skipCheckboxId: string;
  previewVariant?: "add" | "split";
};

/**
 * Shared duration / session-length / daily-start / skip-weekends controls
 * reused by both AddTopicDialog and SplitSessionsDialog.
 */
export function DurationSplitFields({
  totalHours,
  onTotalHoursChange,
  sessionHours,
  onSessionHoursChange,
  dailyStart,
  onDailyStartChange,
  skipWeekends,
  onSkipWeekendsChange,
  startDate,
  onStartDateChange,
  skipCheckboxId,
  previewVariant = "add",
}: DurationSplitFieldsProps) {
  const safeHours = Number(totalHours) > 0 ? Number(totalHours) : 1;
  const sessionCount = Math.ceil(safeHours / sessionHours);
  const endTime = calculateEndTime(dailyStart, sessionHours);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/60">
        <label className="space-y-1 block font-medium">
          <div className="flex justify-between items-center text-xs">
            <span>Tổng thời lượng môn (giờ)</span>
            <span className="text-[10px] text-muted-foreground font-normal">Tối đa 300h</span>
          </div>
          <Input
            type="number"
            min={1}
            max={300}
            className="h-8 text-xs font-mono"
            value={totalHours || ""}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-", "."].includes(e.key)) {
                e.preventDefault();
              }
            }}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                onTotalHoursChange("" as unknown as number);
                return;
              }
              const val = parseInt(raw, 10);
              if (!Number.isNaN(val)) {
                onTotalHoursChange(Math.max(0, Math.min(300, val)));
              }
            }}
            onBlur={() => {
              if (!totalHours || Number(totalHours) <= 0) {
                onTotalHoursChange(1);
              }
            }}
          />
        </label>

        <label className="space-y-1 block font-medium">
          Thời lượng 1 buổi (Session)
          <select
            className={selectClass}
            value={sessionHours}
            onChange={(e) => onSessionHoursChange(Number(e.target.value))}
          >
            <option value={1.5}>1.5 giờ (90 phút)</option>
            <option value={2.0}>2.0 giờ (120 phút)</option>
            <option value={2.25}>2h15m (135 phút - Slot chuẩn)</option>
            <option value={2.5}>2.5 giờ (150 phút - Chuẩn FAMS)</option>
            <option value={3.0}>3.0 giờ (180 phút)</option>
            <option value={4.0}>4.0 giờ (240 phút - Nửa ngày)</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {onStartDateChange !== undefined && (
          <label className="space-y-1 block font-medium">
            Ngày bắt đầu môn học
            <Input
              type="date"
              className="h-8 text-xs"
              value={startDate || ""}
              onChange={(e) => onStartDateChange(e.target.value)}
            />
          </label>
        )}

        <label className="space-y-1 block font-medium">
          Giờ bắt đầu mỗi ngày
          <Input
            type="time"
            className="h-8 text-xs font-mono"
            value={dailyStart}
            onChange={(e) => onDailyStartChange(e.target.value)}
          />
        </label>

        {onStartDateChange === undefined && (
          <div className="flex items-center gap-2 pt-4">
            <input
              type="checkbox"
              id={skipCheckboxId}
              checked={skipWeekends}
              onChange={(e) => onSkipWeekendsChange(e.target.checked)}
              className="rounded border-input text-primary focus:ring-primary h-4 w-4"
            />
            <Label htmlFor={skipCheckboxId} className="text-xs cursor-pointer">
              Chỉ học Thứ 2 – Thứ 6
            </Label>
          </div>
        )}
      </div>

      {onStartDateChange !== undefined && (
        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id={skipCheckboxId}
            checked={skipWeekends}
            onChange={(e) => onSkipWeekendsChange(e.target.checked)}
            className="rounded border-input text-primary focus:ring-primary h-4 w-4"
          />
          <Label htmlFor={skipCheckboxId} className="text-xs cursor-pointer">
            Bỏ qua Thứ 7 và Chủ Nhật (Chỉ học Thứ 2 – Thứ 6)
          </Label>
        </div>
      )}

      <div className="rounded-md border border-indigo-200 bg-indigo-50/70 dark:border-indigo-800 dark:bg-indigo-950/40 p-2.5 text-xs text-indigo-950 dark:text-indigo-200 space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-indigo-700 dark:text-indigo-300">
          {previewVariant === "add" ? <Sparkles className="size-3.5" /> : <Clock className="size-3.5" />}
          {previewVariant === "add"
            ? "Cơ chế tự động chia buổi (Auto-split by Duration)"
            : "Kết quả dự kiến:"}
        </div>
        {previewVariant === "add" ? (
          <p>
            Tổng <strong>{totalHours}h</strong> chia <strong>{sessionHours}h/buổi</strong> ➔ Sinh ra{" "}
            <strong>{sessionCount} buổi học</strong> ({dailyStart} – {endTime}).
          </p>
        ) : (
          <p>
            Sẽ sinh ra <strong>{sessionCount} buổi học</strong> ({dailyStart} – {endTime}), tổng cộng{" "}
            <strong>{totalHours} giờ</strong>.
          </p>
        )}
      </div>
    </>
  );
}

