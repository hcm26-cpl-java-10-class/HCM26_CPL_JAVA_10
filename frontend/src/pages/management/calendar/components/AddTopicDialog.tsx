import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BookOpen, Plus } from "lucide-react";
import { DurationSplitFields } from "./DurationSplitFields";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type TopicOption = {
  code: string;
  name: string;
  durationHours: number;
};

type AddTopicDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableTopicOptions: TopicOption[];
  topicPreset: string;
  onTopicPresetChange: (preset: string) => void;
  topicCode: string;
  onTopicCodeChange: (code: string) => void;
  topicName: string;
  onTopicNameChange: (name: string) => void;
  totalHours: number;
  onTotalHoursChange: (hours: number) => void;
  sessionHours: number;
  onSessionHoursChange: (hours: number) => void;
  dailyStart: string;
  onDailyStartChange: (time: string) => void;
  skipWeekends: boolean;
  onSkipWeekendsChange: (skip: boolean) => void;
  onConfirmAdd: () => void;
};

export function AddTopicDialog({
  open,
  onOpenChange,
  availableTopicOptions,
  topicPreset,
  onTopicPresetChange,
  topicCode,
  onTopicCodeChange,
  topicName,
  onTopicNameChange,
  totalHours,
  onTotalHoursChange,
  sessionHours,
  onSessionHoursChange,
  dailyStart,
  onDailyStartChange,
  skipWeekends,
  onSkipWeekendsChange,
  onConfirmAdd,
}: AddTopicDialogProps) {
  const safeHours = Number(totalHours) > 0 ? Number(totalHours) : 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-5 text-primary" />
            Thêm chủ đề đào tạo (Add Training Topic)
          </DialogTitle>
          <DialogDescription className="text-xs">
            Chọn môn học từ danh mục hoặc nhập môn tùy chỉnh, hệ thống sẽ tự động chia số buổi theo thời lượng.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <label className="space-y-1 block font-medium">
            Nguồn môn học (Curriculum topic source)
            <select
              className={selectClass}
              value={topicPreset}
              onChange={(e) => {
                const value = e.target.value;
                onTopicPresetChange(value);
                const found = availableTopicOptions.find((p) => p.code === value);
                if (found) {
                  onTopicCodeChange(found.code);
                  onTopicNameChange(found.name);
                  if (found.durationHours) {
                    onTotalHoursChange(found.durationHours);
                  }
                }
              }}
            >
              <option value="CUSTOM">Custom topic (Tự nhập)</option>
              {availableTopicOptions.map((item) => (
                <option key={item.code} value={item.code}>
                  [{item.code}] {item.name} ({item.durationHours || 20}h)
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-1 block font-medium col-span-1">
              <div className="flex justify-between items-center text-xs">
                <span>Mã môn (Code)</span>
                <span className="text-[10px] text-muted-foreground font-normal">{topicCode.length}/30</span>
              </div>
              <Input
                maxLength={30}
                className="h-8 text-xs font-mono uppercase"
                value={topicCode}
                onChange={(e) => {
                  const cleaned = e.target.value.toUpperCase().replace(/[^A-Z0-9_\-\[\]]/g, "").slice(0, 30);
                  onTopicCodeChange(cleaned);
                }}
                placeholder="e.g. JAVA_CORE"
              />
            </label>
            <label className="space-y-1 block font-medium col-span-2">
              <div className="flex justify-between items-center text-xs">
                <span>Tên môn học (Name)</span>
                <span className="text-[10px] text-muted-foreground font-normal">{topicName.length}/100</span>
              </div>
              <Input
                maxLength={100}
                className="h-8 text-xs"
                value={topicName}
                onChange={(e) => onTopicNameChange(e.target.value.slice(0, 100))}
                placeholder="e.g. Java Core & OOP Fundamentals"
              />
            </label>
          </div>

          <DurationSplitFields
            totalHours={totalHours}
            onTotalHoursChange={onTotalHoursChange}
            sessionHours={sessionHours}
            onSessionHoursChange={onSessionHoursChange}
            dailyStart={dailyStart}
            onDailyStartChange={onDailyStartChange}
            skipWeekends={skipWeekends}
            onSkipWeekendsChange={onSkipWeekendsChange}
            skipCheckboxId="skipWeekendsCheckbox"
            previewVariant="add"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            size="sm"
            disabled={!topicCode.trim() || !topicName.trim()}
            className="bg-primary text-primary-foreground gap-1.5"
            onClick={onConfirmAdd}
          >
            <Plus className="size-4" />
            Thêm & Tự động tạo {Math.ceil(safeHours / sessionHours)} buổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

