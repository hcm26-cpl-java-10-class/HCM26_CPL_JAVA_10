import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, GraduationCap, LoaderCircle, Plus } from "lucide-react";
import type {
  ClassProgramSubjects,
  SharedClass,
  SharedClassRequest,
} from "@/api/features/class-setup.api";
import type { TrainingProgramResponse } from "@/api/features/program.api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ClassCrudMode = "create" | "edit" | "view";

interface ClassCrudDialogProps {
  open: boolean;
  mode: ClassCrudMode;
  classItem: SharedClass | null;
  currentProgram: ClassProgramSubjects["program"] | null;
  programChangeBlocked: boolean;
  programs: TrainingProgramResponse[];
  canAssignProgram: boolean;
  saving: boolean;
  error: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    request: SharedClassRequest,
    selectedProgramId: string,
    programChanged: boolean,
  ) => Promise<void>;
}

const NO_PROGRAM_VALUE = "__NONE__";

function getTodayIsoDate(): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function toInitialForm(item: SharedClass | null): SharedClassRequest {
  return {
    code: item?.code ?? "",
    name: item?.name ?? "",
    startDate: item?.startDate ?? null,
    endDate: item?.endDate ?? null,
    status: item?.status?.toLowerCase() === "inactive" ? "inactive" : "active",
    plannedSize: item?.plannedSize ?? 25,
    deliveryType: item?.deliveryType ?? "Class",
    traineeType: item?.traineeType ?? "Fresher",
    formatType: item?.formatType ?? "Offline",
    skills: item?.skills ?? "",
    site: item?.site ?? "TP. Hồ Chí Minh",
    location: item?.location ?? "",
    subjectType: item?.subjectType ?? "IT Technical",
    scope: item?.scope ?? "Unit",
    supplierPartner: item?.supplierPartner ?? "",
    keyProgram: item?.keyProgram ?? "",
    jobRecommendation: item?.jobRecommendation ?? false,
  };
}

export function ClassCrudDialog({
  open,
  mode,
  classItem,
  currentProgram,
  programChangeBlocked,
  programs,
  canAssignProgram,
  saving,
  error,
  onOpenChange,
  onSubmit,
}: ClassCrudDialogProps) {
  const [form, setForm] = useState<SharedClassRequest>(() => toInitialForm(classItem));
  const [programId, setProgramId] = useState<string>(NO_PROGRAM_VALUE);
  const [originalProgramId, setOriginalProgramId] = useState<string>(NO_PROGRAM_VALUE);
  const [validationError, setValidationError] = useState("");

  const readOnly = mode === "view";
  const today = getTodayIsoDate();
  const existingStartDate = classItem?.startDate ?? null;

  useEffect(() => {
    if (!open) return;
    setForm(toInitialForm(classItem));
    const initialProg = currentProgram?.id
      ? String(currentProgram.id)
      : classItem?.programId
        ? String(classItem.programId)
        : NO_PROGRAM_VALUE;
    setProgramId(initialProg);
    setOriginalProgramId(initialProg);
    setValidationError("");
  }, [classItem, currentProgram, open]);

  const updateField = <K extends keyof SharedClassRequest>(
    key: K,
    value: SharedClassRequest[K],
  ) => {
    setValidationError("");
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly) {
      onOpenChange(false);
      return;
    }

    const trimmedCode = form.code.trim();
    const trimmedName = form.name.trim();
    if (!trimmedCode) {
      setValidationError("Mã lớp học (Class Code) không được để trống.");
      return;
    }
    if (!trimmedName) {
      setValidationError("Tên lớp học (Class Name) không được để trống.");
      return;
    }
    if (
      form.plannedSize != null &&
      (!Number.isInteger(form.plannedSize) || form.plannedSize < 1 || form.plannedSize > 10000)
    ) {
      setValidationError("Chỉ tiêu học viên (Planned Size) phải là số nguyên từ 1 đến 10.000.");
      return;
    }
    const unchangedExistingStart =
      mode === "edit" && existingStartDate != null && form.startDate === existingStartDate;
    if (form.startDate && !unchangedExistingStart && form.startDate < today) {
      setValidationError("Ngày bắt đầu dự kiến không được nằm trong quá khứ.");
      return;
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setValidationError("Ngày kết thúc dự kiến phải bằng hoặc sau ngày bắt đầu.");
      return;
    }

    const normalizedProgramId = programId === NO_PROGRAM_VALUE ? "" : programId;
    const normalizedOriginalProgramId =
      originalProgramId === NO_PROGRAM_VALUE ? "" : originalProgramId;

    await onSubmit(
      {
        ...form,
        code: trimmedCode,
        name: trimmedName,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      },
      normalizedProgramId,
      normalizedProgramId !== normalizedOriginalProgramId,
    );
  };

  const dialogTitle =
    mode === "create"
      ? "Tạo lớp học mới"
      : mode === "edit"
        ? `Chỉnh sửa lớp học: ${classItem?.code ?? ""}`
        : `Chi tiết lớp học: ${classItem?.code ?? ""}`;

  const dialogDescription =
    mode === "create"
      ? "Nhập thông tin lớp học để khởi tạo lớp mới và có thể gán ngay chương trình đào tạo ACTIVE."
      : mode === "edit"
        ? "Cập nhật thông tin hồ sơ lớp học dùng chung cho kế hoạch môn học, phân công và lịch học."
        : "Xem đầy đủ thông tin hồ sơ và ngữ cảnh vận hành của lớp học.";

  const combinedError = validationError || error;

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-4xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <GraduationCap className="size-5 text-primary" aria-hidden="true" />
              {dialogTitle}
            </DialogTitle>
            <Badge variant={form.status === "active" ? "secondary" : "outline"}>
              {form.status === "active" ? "Đang hoạt động" : "Ngừng hoạt động"}
            </Badge>
            {classItem?.enrolledCount != null && mode !== "create" && (
              <Badge variant="outline">
                Đã ghi danh: {classItem.enrolledCount} HV
              </Badge>
            )}
          </div>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleFormSubmit(e)} className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
            {combinedError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" aria-hidden="true" />
                <AlertTitle>Không thể lưu lớp học</AlertTitle>
                <AlertDescription>{combinedError}</AlertDescription>
              </Alert>
            )}

            {/* Nhóm 1: Thông tin định danh & trạng thái */}
            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="text-sm font-semibold">1. Thông tin cơ bản & Chương trình đào tạo</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="crud-class-code">
                    Mã lớp học (Class Code) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="crud-class-code"
                    placeholder="VD: HCM26_JAVA_01"
                    maxLength={50}
                    required
                    disabled={readOnly || saving}
                    value={form.code}
                    onChange={(e) => updateField("code", e.target.value)}
                    className="font-mono"
                  />
                </div>

                <div className="space-y-1.5 lg:col-span-2">
                  <Label htmlFor="crud-class-name">
                    Tên lớp học (Class Name) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="crud-class-name"
                    placeholder="VD: Fresher Java Fullstack Khóa 01"
                    maxLength={255}
                    required
                    disabled={readOnly || saving}
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="crud-class-status">Trạng thái lớp</Label>
                  <Select
                    value={form.status}
                    disabled={readOnly || saving}
                    onValueChange={(val) =>
                      updateField("status", val as SharedClassRequest["status"])
                    }
                  >
                    <SelectTrigger id="crud-class-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Đang hoạt động (Active)</SelectItem>
                      <SelectItem value="inactive">Ngừng hoạt động (Inactive)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="crud-class-size">Chỉ tiêu học viên (Planned Size)</Label>
                  <Input
                    id="crud-class-size"
                    type="number"
                    min={1}
                    max={10000}
                    step={1}
                    disabled={readOnly || saving}
                    value={form.plannedSize ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      updateField("plannedSize", raw === "" ? null : Number(raw));
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="crud-class-program">Chương trình đào tạo ACTIVE</Label>
                  <Select
                    value={programId}
                    disabled={
                      readOnly ||
                      saving ||
                      !canAssignProgram ||
                      form.status !== "active" ||
                      (mode === "edit" && programChangeBlocked)
                    }
                    onValueChange={setProgramId}
                  >
                    <SelectTrigger id="crud-class-program" className="w-full">
                      <SelectValue placeholder="Chọn chương trình (tùy chọn)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PROGRAM_VALUE}>
                        {mode === "create"
                          ? "— Gán chương trình sau —"
                          : "— Chưa gán / Bỏ gán chương trình —"}
                      </SelectItem>
                      {currentProgram &&
                        !programs.some((p) => p.id === currentProgram.id) && (
                          <SelectItem value={String(currentProgram.id)}>
                            {currentProgram.code} — {currentProgram.name} · v{currentProgram.version}
                          </SelectItem>
                        )}
                      {programs.map((program) => (
                        <SelectItem key={program.id} value={String(program.id)}>
                          {program.code} — {program.name} · v{program.version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {mode === "edit" && programChangeBlocked && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      Đang khóa đổi chương trình do lớp đã có dữ liệu kế hoạch.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Nhóm 2: Thời gian & Địa điểm */}
            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="text-sm font-semibold">2. Lịch trình & Địa điểm đào tạo</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="crud-start-date">Ngày bắt đầu dự kiến</Label>
                  <Input
                    id="crud-start-date"
                    type="date"
                    min={mode === "create" ? today : undefined}
                    disabled={readOnly || saving}
                    value={form.startDate ?? ""}
                    onChange={(e) => updateField("startDate", e.target.value || null)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="crud-end-date">Ngày kết thúc dự kiến</Label>
                  <Input
                    id="crud-end-date"
                    type="date"
                    min={form.startDate || undefined}
                    disabled={readOnly || saving}
                    value={form.endDate ?? ""}
                    onChange={(e) => updateField("endDate", e.target.value || null)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="crud-site">Khu vực / Site</Label>
                  <Input
                    id="crud-site"
                    placeholder="VD: TP. Hồ Chí Minh"
                    maxLength={150}
                    disabled={readOnly || saving}
                    value={form.site ?? ""}
                    onChange={(e) => updateField("site", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="crud-format-type">Hình thức học (Format)</Label>
                  <Select
                    value={form.formatType || "Offline"}
                    disabled={readOnly || saving}
                    onValueChange={(val) => updateField("formatType", val)}
                  >
                    <SelectTrigger id="crud-format-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Offline">Offline</SelectItem>
                      <SelectItem value="Online">Online</SelectItem>
                      <SelectItem value="Hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                  <Label htmlFor="crud-location">Địa điểm phòng học chi tiết (Location)</Label>
                  <Input
                    id="crud-location"
                    placeholder="VD: F-Town 3, Phòng A101"
                    maxLength={255}
                    disabled={readOnly || saving}
                    value={form.location ?? ""}
                    onChange={(e) => updateField("location", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Nhóm 3: Thuộc tính vận hành mở rộng */}
            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="text-sm font-semibold">3. Thông tin phân loại & Vận hành (Tùy chọn)</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="crud-delivery-type">Delivery Type</Label>
                  <Input
                    id="crud-delivery-type"
                    maxLength={100}
                    disabled={readOnly || saving}
                    value={form.deliveryType ?? ""}
                    onChange={(e) => updateField("deliveryType", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="crud-trainee-type">Trainee Type</Label>
                  <Input
                    id="crud-trainee-type"
                    maxLength={100}
                    disabled={readOnly || saving}
                    value={form.traineeType ?? ""}
                    onChange={(e) => updateField("traineeType", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="crud-subject-type">Subject Type</Label>
                  <Input
                    id="crud-subject-type"
                    maxLength={100}
                    disabled={readOnly || saving}
                    value={form.subjectType ?? ""}
                    onChange={(e) => updateField("subjectType", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="crud-scope">Scope</Label>
                  <Input
                    id="crud-scope"
                    maxLength={100}
                    disabled={readOnly || saving}
                    value={form.scope ?? ""}
                    onChange={(e) => updateField("scope", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="crud-skills">Kỹ năng đào tạo (Skills)</Label>
                  <Input
                    id="crud-skills"
                    placeholder="VD: Java, Spring Boot, SQL, React"
                    maxLength={255}
                    disabled={readOnly || saving}
                    value={form.skills ?? ""}
                    onChange={(e) => updateField("skills", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="crud-supplier">Supplier / Partner</Label>
                  <Input
                    id="crud-supplier"
                    maxLength={150}
                    disabled={readOnly || saving}
                    value={form.supplierPartner ?? ""}
                    onChange={(e) => updateField("supplierPartner", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="crud-key-program">Key Program</Label>
                  <Input
                    id="crud-key-program"
                    maxLength={150}
                    disabled={readOnly || saving}
                    value={form.keyProgram ?? ""}
                    onChange={(e) => updateField("keyProgram", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="crud-job-rec">Đề xuất việc làm (Job Recommendation)</Label>
                  <Select
                    value={form.jobRecommendation ? "yes" : "no"}
                    disabled={readOnly || saving}
                    onValueChange={(val) => updateField("jobRecommendation", val === "yes")}
                  >
                    <SelectTrigger id="crud-job-rec" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Có (Yes)</SelectItem>
                      <SelectItem value="no">Không (No)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              {readOnly ? "Đóng" : "Hủy"}
            </Button>
            {!readOnly && (
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : mode === "create" ? (
                  <Plus className="size-4" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                )}
                {mode === "create" ? "Tạo lớp học" : "Lưu cập nhật lớp"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
