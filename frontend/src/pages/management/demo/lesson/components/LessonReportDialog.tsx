import { lessonReportApi } from "@/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { LessonReportReason } from "@/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { LESSON_REPORT_REASONS } from "./lessonReportReasons";

const MAX_DETAIL = 1000; // keep in sync with LessonReportService.MAX_DETAIL_LENGTH

function errorMessage(error: any, fallback: string): string {
  const data = error?.response?.data;
  const firstFieldError = data?.errors
    ? (Object.values(data.errors).flat()[0] as string | undefined)
    : undefined;
  return firstFieldError || data?.message || fallback;
}

interface LessonReportDialogProps {
  lessonId: number;
  lessonTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Hộp thoại báo cáo bài học: bắt buộc chọn lý do; chọn "Other" thì bắt buộc mô tả. */
export function LessonReportDialog({
  lessonId,
  lessonTitle,
  open,
  onOpenChange,
}: LessonReportDialogProps) {
  const [reason, setReason] = useState<LessonReportReason | "">("");
  const [detail, setDetail] = useState("");

  const trimmedDetail = detail.trim();
  const needsDetail = reason === "OTHER";
  const canSubmit = reason !== "" && (!needsDetail || trimmedDetail.length > 0);

  const close = (next: boolean) => {
    if (!next) {
      setReason("");
      setDetail("");
    }
    onOpenChange(next);
  };

  const mutation = useMutation({
    mutationFn: () =>
      lessonReportApi.create(lessonId, {
        reason: reason as LessonReportReason,
        detail: trimmedDetail || undefined,
      }),
    onSuccess: () => {
      toast.success("Thanks! Your report has been sent.");
      close(false);
    },
    onError: (error) => toast.error(errorMessage(error, "Could not send the report")),
  });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report this lesson</DialogTitle>
          <DialogDescription>
            {lessonTitle ? `“${lessonTitle}” — ` : ""}tell us what is wrong so the instructor can fix it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>
              Reason <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={reason}
              onValueChange={(value) => setReason(value as LessonReportReason)}
              disabled={mutation.isPending}
            >
              {LESSON_REPORT_REASONS.map((item) => (
                <div key={item.value} className="flex items-center gap-2">
                  <RadioGroupItem value={item.value} id={`report-reason-${item.value}`} />
                  <Label htmlFor={`report-reason-${item.value}`} className="font-normal">
                    {item.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-detail">
              Details {needsDetail && <span className="text-destructive">*</span>}
              {!needsDetail && <span className="text-muted-foreground"> (optional)</span>}
            </Label>
            <Textarea
              id="report-detail"
              rows={4}
              value={detail}
              maxLength={MAX_DETAIL}
              disabled={mutation.isPending}
              className="max-h-40 resize-none overflow-y-auto"
              placeholder="Describe the problem..."
              onChange={(event) => setDetail(event.target.value)}
            />
            <p className="text-right text-xs text-muted-foreground">
              {detail.length}/{MAX_DETAIL} characters
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={mutation.isPending}
            onClick={() => close(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Sending..." : "Send report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
