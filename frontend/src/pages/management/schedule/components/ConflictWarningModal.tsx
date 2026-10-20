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
import { Textarea } from "@/components/ui/textarea";
import type { SessionDTO } from "@/types";
import { AlertTriangle, Clock, MapPin, User, ShieldAlert } from "lucide-react";
import { useState } from "react";

interface ConflictWarningModalProps {
  open: boolean;
  onClose: () => void;
  conflictMessage: string;
  conflictingSessions?: SessionDTO[];
  onConfirmOverride: (reason: string) => void;
  isSubmitting?: boolean;
}

export function ConflictWarningModal({
  open,
  onClose,
  conflictMessage,
  conflictingSessions,
  onConfirmOverride,
  isSubmitting = false,
}: ConflictWarningModalProps) {
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const handleOverrideSubmit = () => {
    if (!overrideReason.trim()) {
      setReasonError("Vui lòng nhập lý do ghi đè lịch.");
      return;
    }
    setReasonError("");
    onConfirmOverride(overrideReason.trim());
  };

  const handleClose = () => {
    setShowOverrideForm(false);
    setOverrideReason("");
    setReasonError("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <div className="flex items-center gap-3 text-amber-600">
            <div className="rounded-full bg-amber-100 p-2">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                Cảnh báo Xung đột Lịch học
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                Kiểm tra các buổi học trùng thời gian trước khi tiếp tục.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2 space-y-4 text-sm">
          <div className="rounded-lg border border-red-200 bg-red-50/80 p-3.5 text-red-800">
            <p className="font-medium">{conflictMessage}</p>
          </div>

          {conflictingSessions && conflictingSessions.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Chi tiết buổi học đang bị trùng:
              </span>
              {conflictingSessions.map((session, idx) => (
                <div
                  key={session.id ?? idx}
                  className="rounded border border-slate-200 bg-white p-2.5 text-xs text-slate-700 space-y-1 shadow-sm"
                >
                  <div className="font-semibold text-slate-900">
                    [{session.classCode}] {session.title}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600">
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      {session.trainerName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {session.startTime.replace("T", " ")} - {session.endTime.replace("T", " ")}
                    </span>
                    {session.room && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        {session.room}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {showOverrideForm ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-4 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-amber-900">
                <ShieldAlert className="h-4 w-4" />
                <span>Ghi đè lịch trùng</span>
              </div>
              <p className="text-xs text-slate-600">
                Chỉ tiếp tục khi bạn có quyền ghi đè lịch và đã xác nhận lý do.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="override-reason" className="text-xs font-medium text-slate-800">
                  Lý do ghi đè (bắt buộc) <span className="text-red-500">*</span>:
                </Label>
                <Textarea
                  id="override-reason"
                  maxLength={255}
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => {
                    setOverrideReason(e.target.value);
                    if (e.target.value.trim()) setReasonError("");
                  }}
                  placeholder="Ví dụ: Học bù đột xuất theo yêu cầu Ban Đào tạo đã được duyệt..."
                  className="text-xs"
                />
                {reasonError && <p className="text-xs text-red-600 font-medium">{reasonError}</p>}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic">
              Bạn có thể chọn <strong>"Chỉnh sửa lại giờ"</strong> hoặc xác nhận{" "}
              <strong>"Ghi đè lịch"</strong> kèm lý do.
            </div>
          )}
        </div>

        <DialogFooter className="mt-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Chỉnh sửa lại giờ
          </Button>

          {!showOverrideForm ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowOverrideForm(true)}
              disabled={isSubmitting}
            >
              <ShieldAlert className="mr-1.5 h-4 w-4" />
              Ghi đè lịch (Override)
            </Button>
          ) : (
            <Button
              type="button"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleOverrideSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang xử lý..." : "Xác nhận Override & Lưu"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
