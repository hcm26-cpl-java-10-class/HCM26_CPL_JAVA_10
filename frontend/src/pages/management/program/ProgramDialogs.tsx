import { useState, type FormEvent } from "react";
import { AlertCircle, BookOpen, CheckCircle2, Clock3, CopyPlus, LoaderCircle, MapPin } from "lucide-react";
import type { TrainingProgramResponse } from "@/api/features/program.api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage, primaryButtonClass, ProgramStatusBadge } from "./program-ui";

interface ProgramDetailsProps {
  program: TrainingProgramResponse;
  canCreate: boolean;
  canUpdate: boolean;
  onClose: () => void;
  onClone: () => void;
  onActivate: () => void;
}

export function ProgramDetails({ program, canCreate, canUpdate, onClose, onClone, onActivate }: ProgramDetailsProps) {
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 sm:max-w-2xl">
      <DialogHeader className="space-y-3 px-6 pt-6 pr-12">
        <div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold text-blue-700 dark:text-blue-300">{program.code}</span><span className="text-muted-foreground">Phiên bản {program.version}</span><ProgramStatusBadge status={program.status} /></div>
        <DialogTitle className="break-words text-xl font-semibold leading-7">{program.name}</DialogTitle>
        <DialogDescription>Danh sách môn và thứ tự giảng dạy của chương trình.</DialogDescription>
      </DialogHeader>
      <div className="space-y-5 px-6 pb-2">
        <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-4">
          <div><p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground"><BookOpen className="size-3.5" />Môn học</p><p className="font-semibold">{program.subjects.length} môn</p></div>
          <div><p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" />Thời lượng</p><p className="font-semibold">{program.totalDurationHours} giờ</p></div>
          <div><p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3.5" />Khu vực</p><p className="break-words font-semibold">{program.region || "Chưa đặt"}</p></div>
        </div>
        <ol className="divide-y rounded-lg border px-4">
          {[...program.subjects].sort((a, b) => a.orderIndex - b.orderIndex).map((subject) => <li key={subject.id} className="flex items-start gap-3 py-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{subject.orderIndex}</span>
            <div className="min-w-0 flex-1"><p className="font-medium leading-5">{subject.name}</p><p className="mt-1 text-xs text-muted-foreground">{subject.code} · Phiên bản {subject.version}</p></div>
            <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs">{subject.durationHours} giờ</span>
          </li>)}
          {!program.subjects.length && <li className="py-8 text-center text-muted-foreground">Chưa có môn học trong chương trình.</li>}
        </ol>
        <p className="text-xs leading-5 text-muted-foreground">{program.status === "ACTIVE" ? "Chương trình đang được sử dụng. Tạo phiên bản mới để thay đổi nội dung mà không ảnh hưởng lớp đã gán." : "Chương trình đã ngừng sử dụng. Có thể kích hoạt lại sau khi kiểm tra các môn học."}</p>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t bg-muted/30 p-4">
        <Button variant="outline" onClick={onClose}>Đóng</Button>
        {canCreate && <Button variant="outline" onClick={onClone}><CopyPlus />Tạo phiên bản mới</Button>}
        {canUpdate && program.status !== "ACTIVE" && <Button className={primaryButtonClass} onClick={onActivate}><CheckCircle2 />{program.status === "INACTIVE" ? "Kích hoạt lại" : "Kích hoạt"}</Button>}
      </div>
    </DialogContent>
  </Dialog>;
}

export type ProgramAction = { type: "clone" | "activate"; program: TrainingProgramResponse };

export function ProgramActionDialog({ action, programs, onClose, onConfirm }: {
  action: ProgramAction;
  programs: TrainingProgramResponse[];
  onClose: () => void;
  onConfirm: (version: string) => Promise<void>;
}) {
  const [version, setVersion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isClone = action.type === "clone";
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isClone && programs.some((program) => program.code === action.program.code && program.version === version.trim())) {
      setError("Phiên bản này đã tồn tại. Vui lòng chọn số phiên bản khác."); return;
    }
    if (isClone && !version.trim()) { setError("Vui lòng nhập phiên bản mới."); return; }
    setSaving(true); setError("");
    try { await onConfirm(version.trim()); }
    catch (actionError) { setError(errorMessage(actionError, "Không thể hoàn tất thao tác. Vui lòng thử lại.")); }
    finally { setSaving(false); }
  };
  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
    <DialogContent className="sm:max-w-md" showCloseButton={!saving}>
      <DialogHeader><DialogTitle className="text-lg font-semibold">{isClone ? "Tạo phiên bản mới" : "Kích hoạt chương trình?"}</DialogTitle>
        <DialogDescription>{isClone ? "Sao chép đầy đủ thông tin, môn học và thứ tự sang một phiên bản ACTIVE mới." : "Chương trình sẽ sẵn sàng để gán cho lớp. Sau khi kích hoạt, bạn cần tạo phiên bản mới để chỉnh sửa nội dung."}</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3"><p className="font-medium">{action.program.name}</p><p className="mt-1 text-xs text-muted-foreground">{action.program.code} · Phiên bản {action.program.version} · {action.program.subjects.length} môn</p></div>
        {isClone && <div className="space-y-2"><Label htmlFor="clone-version">Phiên bản mới <span className="text-destructive">*</span></Label><Input id="clone-version" required autoFocus maxLength={30} placeholder="VD: 1.1 hoặc 2.0" disabled={saving} value={version} aria-invalid={Boolean(error)} onChange={(event) => { setVersion(event.target.value); setError(""); }} /></div>}
        {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Hủy</Button>
          <Button type="submit" className={primaryButtonClass} disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : isClone ? <CopyPlus /> : <CheckCircle2 />}{saving ? "Đang xử lý…" : isClone ? "Tạo phiên bản ACTIVE" : "Kích hoạt"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
