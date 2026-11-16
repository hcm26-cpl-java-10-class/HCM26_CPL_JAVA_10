import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";
import type { TrainingTopic } from "../calendar.types";
import { DurationSplitFields } from "./DurationSplitFields";

type SplitSessionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: TrainingTopic | null;
  totalHours: number;
  onTotalHoursChange: (hours: number) => void;
  sessionHours: number;
  onSessionHoursChange: (hours: number) => void;
  startDate: string;
  onStartDateChange: (date: string) => void;
  dailyStart: string;
  onDailyStartChange: (time: string) => void;
  skipWeekends: boolean;
  onSkipWeekendsChange: (skip: boolean) => void;
  onConfirmSplit: () => void;
};

export function SplitSessionsDialog({
  open,
  onOpenChange,
  topic,
  totalHours,
  onTotalHoursChange,
  sessionHours,
  onSessionHoursChange,
  startDate,
  onStartDateChange,
  dailyStart,
  onDailyStartChange,
  skipWeekends,
  onSkipWeekendsChange,
  onConfirmSplit,
}: SplitSessionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Sparkles className="size-4" />
            Tự động chia buổi theo Duration : {topic?.code}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Hệ thống sẽ tự động tính toán lại số ngày (Days) và hoạt động (Activities) dựa trên tổng thời lượng của môn{" "}
            {topic?.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <DurationSplitFields
            totalHours={totalHours}
            onTotalHoursChange={onTotalHoursChange}
            sessionHours={sessionHours}
            onSessionHoursChange={onSessionHoursChange}
            startDate={startDate}
            onStartDateChange={onStartDateChange}
            dailyStart={dailyStart}
            onDailyStartChange={onDailyStartChange}
            skipWeekends={skipWeekends}
            onSkipWeekendsChange={onSkipWeekendsChange}
            skipCheckboxId="splitSkipWeekendsCheckbox"
            previewVariant="split"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Hủy bỏ
          </Button>
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={onConfirmSplit}
          >
            <Sparkles className="size-3.5 mr-1" />
            Xác nhận chia lại
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

