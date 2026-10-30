import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserCheck,
} from "lucide-react";
import {
  classSetupApi,
  type AssignmentRole,
  type ClassSubjectOption,
  type SharedClass,
  type SharedTrainer,
  type TeachingAssignment,
  type TeachingAssignmentRequest,
} from "@/api/features/class-setup.api";
import { MainLayout } from "@/components/layout/MainLayout";
import ConfirmDialog from "@/components/ui/confirmdialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";

type AssignmentForm = {
  programSubjectId: string;
  trainerId: string;
  role: AssignmentRole;
  effectiveFrom: string;
  effectiveTo: string;
};

const today = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const emptyForm = (programSubjectId = ""): AssignmentForm => ({
  programSubjectId,
  trainerId: "",
  role: "MAIN",
  effectiveFrom: today(),
  effectiveTo: "",
});

const isClassActive = (item: SharedClass) => !item.status || item.status.toLowerCase() === "active";

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: unknown; error?: unknown } | undefined;
    if (typeof data?.message === "string") return data.message;
    if (typeof data?.error === "string") return data.error;
  }
  return error instanceof Error ? error.message : "Đã xảy ra lỗi khi xử lý phân công giảng dạy.";
}

export default function TeachingAssignmentPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = usePermissions();

  const canCreateAssignment = hasPermission("ASSIGNMENT_CREATE");
  const canUpdateAssignment = hasPermission("ASSIGNMENT_UPDATE");
  const canDeleteAssignment = hasPermission("ASSIGNMENT_DELETE");
  const canManageAssignments = canCreateAssignment || canUpdateAssignment;

  const queryClassId = searchParams.get("classId") ?? "";
  const queryProgramSubjectId = searchParams.get("programSubjectId") ?? "";

  const [classes, setClasses] = useState<SharedClass[]>([]);
  const [trainers, setTrainers] = useState<SharedTrainer[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<ClassSubjectOption[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingClass, setLoadingClass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TeachingAssignment | null>(null);
  const [form, setForm] = useState<AssignmentForm>(() => emptyForm(queryProgramSubjectId));

  const updateClassParam = useCallback(
    (nextClassId: string, nextPsId?: string) => {
      const next = new URLSearchParams(searchParams);
      if (nextClassId) next.set("classId", nextClassId);
      else next.delete("classId");
      if (nextPsId) next.set("programSubjectId", nextPsId);
      else next.delete("programSubjectId");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const loadBaseResources = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [classList, trainerList] = await Promise.all([
        classSetupApi.getClasses(),
        canManageAssignments ? classSetupApi.getActiveTrainers() : Promise.resolve([]),
      ]);
      setClasses(classList);
      setTrainers(trainerList);
      if (!queryClassId) {
        const defaultClass = classList.find(isClassActive) ?? classList[0];
        if (defaultClass) {
          updateClassParam(String(defaultClass.id), queryProgramSubjectId || undefined);
        }
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [canManageAssignments, queryClassId, queryProgramSubjectId, updateClassParam]);

  const loadClassAssignmentData = useCallback(
    async (classId: number) => {
      setLoadingClass(true);
      setError("");
      try {
        const [options, assignmentList] = await Promise.all([
          classSetupApi.getSubjectOptions(classId),
          classSetupApi.getAssignments(classId),
        ]);
        setSubjectOptions(options);
        setAssignments(assignmentList);
        setEditingId(null);
        const preferredPsId =
          queryProgramSubjectId && options.some((opt) => String(opt.programSubjectId) === queryProgramSubjectId)
            ? queryProgramSubjectId
            : options[0]
              ? String(options[0].programSubjectId)
              : "";
        setForm(emptyForm(preferredPsId));
      } catch (err) {
        setSubjectOptions([]);
        setAssignments([]);
        setError(getErrorMessage(err));
      } finally {
        setLoadingClass(false);
      }
    },
    [queryProgramSubjectId],
  );

  useEffect(() => {
    void loadBaseResources();
  }, [loadBaseResources]);

  useEffect(() => {
    if (queryClassId) {
      void loadClassAssignmentData(Number(queryClassId));
    }
  }, [loadClassAssignmentData, queryClassId]);

  const activeClasses = classes.filter(isClassActive);
  const selectedClass = classes.find((item) => String(item.id) === queryClassId);
  const canSubmit = editingId === null ? canCreateAssignment : canUpdateAssignment;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!queryClassId || !form.programSubjectId || !form.trainerId || !canSubmit) return;
    setSaving(true);
    setError("");
    setNotice("");
    const request: TeachingAssignmentRequest = {
      classId: Number(queryClassId),
      programSubjectId: Number(form.programSubjectId),
      trainerId: Number(form.trainerId),
      role: form.role,
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo || null,
    };
    try {
      if (editingId === null) {
        await classSetupApi.createAssignment(request);
        setNotice("Đã tạo phân công giảng viên cho môn học của lớp.");
      } else {
        await classSetupApi.updateAssignment(editingId, request);
        setNotice("Đã cập nhật phân công giảng viên.");
      }
      await loadClassAssignmentData(Number(queryClassId));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (assignment: TeachingAssignment) => {
    setEditingId(assignment.id);
    setForm({
      programSubjectId: String(assignment.programSubjectId),
      trainerId: String(assignment.trainerId),
      role: assignment.role,
      effectiveFrom: assignment.effectiveFrom,
      effectiveTo: assignment.effectiveTo || "",
    });
    setError("");
    setNotice("");
  };

  const handleDelete = async () => {
    if (!pendingDelete || !queryClassId) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await classSetupApi.deleteAssignment(pendingDelete.id);
      setPendingDelete(null);
      await loadClassAssignmentData(Number(queryClassId));
      setNotice("Đã xóa phân công giảng viên.");
    } catch (err) {
      setError(getErrorMessage(err));
      setPendingDelete(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout pathName={{ "teaching-assignments": "Phân công giảng dạy" }}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserCheck className="size-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Phân công giảng dạy theo môn của lớp</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Gán giảng viên chính/phụ cho các môn thuộc kế hoạch chương trình đào tạo của lớp.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {queryClassId && (
              <Button variant="outline" asChild>
                <Link to={`/class-setup?classId=${queryClassId}`}>
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Kế hoạch môn học lớp
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              disabled={loading || loadingClass || saving}
              onClick={() => {
                if (queryClassId) void loadClassAssignmentData(Number(queryClassId));
                else void loadBaseResources();
              }}
            >
              <RefreshCw className={`size-4 ${loading || loadingClass ? "animate-spin" : ""}`} aria-hidden="true" />
              Làm mới
            </Button>
          </div>
        </header>

        {error && (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Không thể thực hiện thao tác</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {notice && (
          <Alert className="border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 aria-hidden="true" />
            <AlertTitle>Đã cập nhật</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Chọn lớp học</CardTitle>
            <CardDescription>Danh sách môn học lựa chọn được lấy từ kế hoạch môn học của lớp đang chọn.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-10 w-full max-w-md" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="ta-class-select">Lớp đang hoạt động</Label>
                  <Select
                    value={queryClassId}
                    onValueChange={(value) => {
                      setNotice("");
                      setError("");
                      updateClassParam(value);
                    }}
                  >
                    <SelectTrigger id="ta-class-select" className="w-full">
                      <SelectValue placeholder="Chọn lớp học" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeClasses.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {item.code} — {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedClass && (
                  <p className="text-sm text-muted-foreground sm:pb-2">
                    Thời gian lớp: <span className="font-medium text-foreground">{selectedClass.startDate || "—"} → {selectedClass.endDate || "—"}</span>
                    {" · "}Địa điểm: <span className="font-medium text-foreground">{selectedClass.location || selectedClass.site || "—"}</span>
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {loadingClass ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : queryClassId && !subjectOptions.length ? (
          <Alert>
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Lớp chưa có danh sách môn học</AlertTitle>
            <AlertDescription>
              Hãy mở trang{" "}
              <Link className="font-medium underline" to={`/class-setup?classId=${queryClassId}&tab=program`}>
                Kế hoạch môn học lớp
              </Link>{" "}
              để gán chương trình ACTIVE cho lớp trước khi phân công giảng viên.
            </AlertDescription>
          </Alert>
        ) : (
          queryClassId && (
            <Card>
              <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="size-5 text-primary" aria-hidden="true" />
                    {editingId === null ? "Tạo phân công giảng viên" : `Chỉnh sửa phân công #${editingId}`}
                  </CardTitle>
                  <CardDescription>
                    Môn học hiển thị theo đúng thứ tự kế hoạch lớp kèm thông tin Course LMS đã gắn.
                  </CardDescription>
                </div>
                <Badge variant="outline">{assignments.length} phân công</Badge>
              </CardHeader>
              <CardContent className="space-y-6">
                {canManageAssignments ? (
                  <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="space-y-2 xl:col-span-2">
                      <Label htmlFor="ta-subject">Môn thuộc kế hoạch lớp</Label>
                      <Select
                        value={form.programSubjectId}
                        onValueChange={(value) => setForm((cur) => ({ ...cur, programSubjectId: value }))}
                      >
                        <SelectTrigger id="ta-subject" className="w-full">
                          <SelectValue placeholder="Chọn môn học" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjectOptions.map((opt) => (
                            <SelectItem key={opt.programSubjectId} value={String(opt.programSubjectId)}>
                              {opt.orderIndex}. {opt.subjectCode} (v{opt.subjectVersion}) — {opt.subjectName} · {opt.durationHours}h
                              {opt.courseCode ? ` [${opt.courseCode}]` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 xl:col-span-2">
                      <Label htmlFor="ta-trainer">Giảng viên đang hoạt động</Label>
                      <Select
                        value={form.trainerId}
                        onValueChange={(value) => setForm((cur) => ({ ...cur, trainerId: value }))}
                      >
                        <SelectTrigger id="ta-trainer" className="w-full">
                          <SelectValue placeholder="Chọn giảng viên" />
                        </SelectTrigger>
                        <SelectContent>
                          {trainers.map((trainer) => (
                            <SelectItem key={trainer.id} value={String(trainer.id)}>
                              {trainer.name}
                              {trainer.email ? ` · ${trainer.email}` : ` · #${trainer.id}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ta-role">Vai trò</Label>
                      <Select
                        value={form.role}
                        onValueChange={(value) => setForm((cur) => ({ ...cur, role: value as AssignmentRole }))}
                      >
                        <SelectTrigger id="ta-role" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MAIN">Giảng viên chính</SelectItem>
                          <SelectItem value="ASSISTANT">Giảng viên phụ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ta-from">Hiệu lực từ</Label>
                      <Input
                        id="ta-from"
                        type="date"
                        required
                        value={form.effectiveFrom}
                        onChange={(e) =>
                          setForm((cur) => ({
                            ...cur,
                            effectiveFrom: e.target.value,
                            effectiveTo: cur.effectiveTo && cur.effectiveTo < e.target.value ? "" : cur.effectiveTo,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ta-to">Hiệu lực đến (tùy chọn)</Label>
                      <Input
                        id="ta-to"
                        type="date"
                        min={form.effectiveFrom}
                        value={form.effectiveTo}
                        onChange={(e) => setForm((cur) => ({ ...cur, effectiveTo: e.target.value }))}
                      />
                    </div>
                    <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-3">
                      <Button type="submit" disabled={saving || !canSubmit || !form.programSubjectId || !form.trainerId}>
                        {saving ? (
                          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                        ) : editingId === null ? (
                          <Plus className="size-4" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 className="size-4" aria-hidden="true" />
                        )}
                        {editingId === null ? "Tạo phân công" : "Lưu thay đổi"}
                      </Button>
                      {editingId !== null && (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={saving}
                          onClick={() => {
                            setEditingId(null);
                            setForm(emptyForm(subjectOptions[0] ? String(subjectOptions[0].programSubjectId) : ""));
                          }}
                        >
                          Hủy chỉnh sửa
                        </Button>
                      )}
                    </div>
                  </form>
                ) : (
                  <Alert>
                    <AlertCircle aria-hidden="true" />
                    <AlertTitle>Chế độ chỉ xem</AlertTitle>
                    <AlertDescription>Tài khoản của bạn có quyền xem danh sách phân công giảng dạy.</AlertDescription>
                  </Alert>
                )}

                {assignments.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Môn học</TableHead>
                        <TableHead>Giảng viên</TableHead>
                        <TableHead>Vai trò</TableHead>
                        <TableHead>Hiệu lực</TableHead>
                        <TableHead className="text-right">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignments.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">{item.subjectName}</div>
                            <div className="font-mono text-xs text-muted-foreground">{item.subjectCode}</div>
                          </TableCell>
                          <TableCell className="font-medium">{item.trainerName || `#${item.trainerId}`}</TableCell>
                          <TableCell>
                            <Badge variant={item.role === "MAIN" ? "default" : "outline"}>
                              {item.role === "MAIN" ? "Chính" : "Phụ"}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {item.effectiveFrom} → {item.effectiveTo || "Không thời hạn"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {canUpdateAssignment && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Sửa phân công ${item.subjectCode}`}
                                  onClick={() => handleEdit(item)}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                              )}
                              {canDeleteAssignment && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Xóa phân công ${item.subjectCode}`}
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setPendingDelete(item)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              )}
                              {!canUpdateAssignment && !canDeleteAssignment && (
                                <span className="text-xs text-muted-foreground">Chỉ xem</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Lớp hiện chưa có phân công giảng viên nào.
                  </p>
                )}
              </CardContent>
            </Card>
          )
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Xóa phân công giảng dạy?"
        description={
          pendingDelete
            ? `Bạn sắp xóa phân công môn ${pendingDelete.subjectCode} của giảng viên ${pendingDelete.trainerName || `#${pendingDelete.trainerId}`}.`
            : undefined
        }
        confirmLabel="Xóa phân công"
        cancelLabel="Giữ lại"
        loading={saving}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void handleDelete()}
      />
    </MainLayout>
  );
}

