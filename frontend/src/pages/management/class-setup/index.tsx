import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { classSetupApi, type AssignmentRole, type ClassProgramSubjects, type SharedClass, type SharedTrainer, type TeachingAssignment, type TeachingAssignmentRequest } from "@/api/features/class-setup.api";
import { programApi, type TrainingProgramResponse } from "@/api/features/program.api";
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

const emptyForm = (): AssignmentForm => ({
  programSubjectId: "",
  trainerId: "",
  role: "MAIN",
  effectiveFrom: today(),
  effectiveTo: "",
});

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if ([502, 503, 504].includes(error.response?.status ?? 0)) {
      return "Dịch vụ dữ liệu dùng chung đang không khả dụng. Vui lòng thử tải lại sau.";
    }
    const data = error.response?.data as { message?: unknown; error?: unknown } | undefined;
    if (typeof data?.message === "string") return data.message;
    if (typeof data?.error === "string") return data.error;
    if (!error.response) return "Không thể kết nối máy chủ. Hãy kiểm tra kết nối và thử lại.";
  }
  return error instanceof Error ? error.message : "Đã xảy ra lỗi khi tải dữ liệu.";
}

function StatusMessage({ error, notice }: { error: string; notice: string }) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle aria-hidden="true" />
        <AlertTitle>Không thể hoàn tất thao tác</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (notice) {
    return (
      <Alert className="border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 aria-hidden="true" />
        <AlertTitle>Đã cập nhật</AlertTitle>
        <AlertDescription>{notice}</AlertDescription>
      </Alert>
    );
  }
  return null;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <BookOpen className="size-5" aria-hidden="true" />
      </div>
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

export default function ClassSetupPage() {
  const { hasPermission } = usePermissions();
  const canAssignProgram = hasPermission("CLASS_UPDATE_PROGRAM");
  const canCreateAssignment = hasPermission("ASSIGNMENT_CREATE");
  const canUpdateAssignment = hasPermission("ASSIGNMENT_UPDATE");
  const canDeleteAssignment = hasPermission("ASSIGNMENT_DELETE");
  const canManageAssignments = canCreateAssignment || canUpdateAssignment;
  const navigate = useNavigate();

  const [classes, setClasses] = useState<SharedClass[]>([]);
  const [trainers, setTrainers] = useState<SharedTrainer[]>([]);
  const [programs, setPrograms] = useState<TrainingProgramResponse[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [programId, setProgramId] = useState("");
  const [classData, setClassData] = useState<ClassProgramSubjects | null>(null);
  const [loadingResources, setLoadingResources] = useState(true);
  const [loadingClass, setLoadingClass] = useState(false);
  const [sampleData, setSampleData] = useState(false);
  const [resourceErrors, setResourceErrors] = useState({ classes: "", programs: "", trainers: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingRevision, setEditingRevision] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TeachingAssignment | null>(null);
  const [form, setForm] = useState<AssignmentForm>(emptyForm);

  const loadResources = useCallback(async () => {
    setLoadingResources(true);
    setResourceErrors({ classes: "", programs: "", trainers: "" });
    try {
      const [classResult, programResult, trainerResult, sourceResult] = await Promise.allSettled([
        classSetupApi.getActiveClasses(),
        canAssignProgram ? programApi.getAll({ status: "ACTIVE" }) : Promise.resolve([]),
        canManageAssignments ? classSetupApi.getActiveTrainers() : Promise.resolve([]),
        classSetupApi.getDataSource(),
      ]);
      const classList = classResult.status === "fulfilled" ? classResult.value : [];
      setClasses(classList);
      setPrograms(programResult.status === "fulfilled" ? programResult.value : []);
      setTrainers(trainerResult.status === "fulfilled" ? trainerResult.value : []);
      setSampleData(sourceResult.status === "fulfilled" && sourceResult.value.sampleData);
      setResourceErrors({
        classes: classResult.status === "rejected" ? getErrorMessage(classResult.reason) : "",
        programs: programResult.status === "rejected" ? getErrorMessage(programResult.reason) : "",
        trainers: trainerResult.status === "rejected" ? getErrorMessage(trainerResult.reason) : "",
      });
      setSelectedClassId((current) => classList.some((item) => String(item.id) === current)
        ? current : (classList[0] ? String(classList[0].id) : ""));
      return classList;
    } finally {
      setLoadingResources(false);
    }
  }, [canAssignProgram, canManageAssignments]);

  const loadClass = useCallback(async (classId: number) => {
    setLoadingClass(true);
    setError("");
    try {
      const response = await classSetupApi.getProgramSubjects(classId);
      setClassData(response);
      setProgramId(response.program ? String(response.program.id) : "");
      setEditingId(null);
      setForm(emptyForm());
    } catch (loadError) {
      setClassData(null);
      setError(getErrorMessage(loadError));
    } finally {
      setLoadingClass(false);
    }
  }, []);

  const refreshData = async () => {
    setError("");
    setNotice("");
    const classList = await loadResources();
    if (classList.some((item) => String(item.id) === selectedClassId)) {
      await loadClass(Number(selectedClassId));
    }
  };

  useEffect(() => { void loadResources(); }, [loadResources]);
  useEffect(() => {
    if (selectedClassId) void loadClass(Number(selectedClassId));
    else setClassData(null);
  }, [loadClass, selectedClassId]);

  const assignments = useMemo(
    () => classData?.subjects.flatMap((subject) => subject.assignments) ?? [],
    [classData],
  );
  const selectedClass = classes.find((item) => String(item.id) === selectedClassId);
  const programChangeBlocked = Boolean(
    classData?.program && Number(programId) !== classData.program.id && assignments.length,
  );
  const programChanged = Boolean(classData?.program && Number(programId) !== classData.program.id);
  const canSubmitAssignment = editingId === null ? canCreateAssignment : canUpdateAssignment;

  const resetAssignmentForm = () => {
    setEditingId(null);
    setEditingRevision(null);
    setForm(emptyForm());
  };

  const assignProgram = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedClassId || !programId || programChangeBlocked) return;
    setError("");
    setNotice("");
    setSaving(true);
    try {
      await classSetupApi.assignProgram(Number(selectedClassId), Number(programId));
      await loadClass(Number(selectedClassId));
      setNotice("Đã gán chương trình cho lớp.");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const saveAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedClassId || !classData?.program || !form.programSubjectId || !form.trainerId || !canSubmitAssignment) return;
    setError("");
    setNotice("");
    setSaving(true);
    const request: TeachingAssignmentRequest = {
      classId: Number(selectedClassId),
      programSubjectId: Number(form.programSubjectId),
      trainerId: Number(form.trainerId),
      role: form.role,
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo || null,
    };
    try {
      if (editingId === null) await classSetupApi.createAssignment(request);
      else {
        if (editingRevision === null) throw new Error("Reload the assignment before editing.");
        await classSetupApi.updateAssignment(editingId, { ...request, revision: editingRevision });
      }
      const successMessage = editingId === null ? "Đã tạo phân công giảng dạy." : "Đã cập nhật phân công giảng dạy.";
      resetAssignmentForm();
      await loadClass(Number(selectedClassId));
      setNotice(successMessage);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const editAssignment = (assignment: TeachingAssignment) => {
    setEditingId(assignment.id);
    setEditingRevision(assignment.revision);
    setForm({
      programSubjectId: String(assignment.programSubjectId),
      trainerId: String(assignment.trainerId),
      role: assignment.role,
      effectiveFrom: assignment.effectiveFrom,
      effectiveTo: assignment.effectiveTo || "",
    });
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteAssignment = async () => {
    if (!pendingDelete) return;
    setError("");
    setNotice("");
    setSaving(true);
    try {
      await classSetupApi.deleteAssignment(pendingDelete.id);
      setPendingDelete(null);
      if (selectedClassId) await loadClass(Number(selectedClassId));
      setNotice("Đã xóa phân công.");
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
      setPendingDelete(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout pathName={{ "class-setup": "Gán chương trình" }}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GraduationCap className="size-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Gán chương trình & phân công giảng dạy</h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Gắn chương trình đào tạo cho lớp và phân công giảng viên theo từng môn, vai trò, thời hạn.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => navigate(`/schedule-generation${selectedClassId ? `?classId=${selectedClassId}` : ""}`)}
            >
              <CalendarDays className="size-4" />
              Tạo lịch theo tuần
            </Button>
            <Button variant="outline" onClick={() => void refreshData()} disabled={loadingResources || loadingClass || saving}>
              <RefreshCw className={`size-4 ${loadingResources ? "animate-spin" : ""}`} aria-hidden="true" />
              Làm mới dữ liệu
            </Button>
          </div>
        </header>

        <StatusMessage error={error} notice={notice} />

        {sampleData && (
          <Alert>
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Đang dùng dữ liệu mẫu</AlertTitle>
            <AlertDescription>Lớp và giảng viên là dữ liệu để chạy thử trên máy. Các thay đổi sẽ mất khi khởi động lại backend.</AlertDescription>
          </Alert>
        )}

        <StatusMessage error={[
          resourceErrors.classes && `Không tải được danh sách lớp: ${resourceErrors.classes}`,
          resourceErrors.programs && `Không tải được chương trình: ${resourceErrors.programs}`,
          resourceErrors.trainers && `Không tải được giảng viên: ${resourceErrors.trainers}`,
        ].filter(Boolean).join(" ")} notice="" />

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg"><Users className="size-5 text-primary" aria-hidden="true" /> Chọn lớp</CardTitle>
            <CardDescription>Danh sách lớp đang hoạt động được tải từ hệ thống dùng chung.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingResources ? (
              <Skeleton className="h-10 w-full max-w-2xl" />
            ) : classes.length ? (
              <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="class-select">Lớp đang hoạt động</Label>
                  <Select value={selectedClassId} disabled={loadingResources || loadingClass || saving} onValueChange={(value) => { setSelectedClassId(value); setNotice(""); setError(""); }}>
                    <SelectTrigger id="class-select" className="w-full"><SelectValue placeholder="Chọn lớp" /></SelectTrigger>
                    <SelectContent>
                      {classes.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.code} — {item.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm text-muted-foreground sm:pb-2">
                  {selectedClass ? <><span className="font-medium text-foreground">{selectedClass.code}</span> · {selectedClass.name} · ID {selectedClass.id}</> : "Chọn lớp để xem chương trình và phân công."}
                </p>
              </div>
            ) : resourceErrors.classes ? (
              <EmptyState title="Không tải được danh sách lớp" detail="Dữ liệu lớp hiện chưa tải được. Nhấn Làm mới dữ liệu để thử lại." />
            ) : (
              <EmptyState title="Chưa có lớp đang hoạt động" detail="Kiểm tra dữ liệu lớp trên hệ thống dùng chung rồi tải lại danh sách." />
            )}
          </CardContent>
        </Card>

        {loadingClass && (
          <div className="grid gap-4 lg:grid-cols-2" aria-live="polite" aria-label="Đang tải dữ liệu lớp">
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="h-56 rounded-xl" />
          </div>
        )}

        {classData && !loadingClass && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card><CardContent className="flex items-center gap-3 pt-6">
                <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><Users className="size-5" aria-hidden="true" /></div>
                <div><p className="text-sm text-muted-foreground">Lớp đang chọn</p><p className="font-semibold">{classData.classCode}</p></div>
              </CardContent></Card>
              <Card><CardContent className="flex items-center gap-3 pt-6">
                <div className="rounded-lg bg-blue-500/10 p-2.5 text-blue-600"><BookOpen className="size-5" aria-hidden="true" /></div>
                <div><p className="text-sm text-muted-foreground">Môn trong chương trình</p><p className="font-semibold">{classData.program ? classData.subjects.length : "—"}</p></div>
              </CardContent></Card>
              <Card><CardContent className="flex items-center gap-3 pt-6">
                <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-600"><GraduationCap className="size-5" aria-hidden="true" /></div>
                <div><p className="text-sm text-muted-foreground">Lượt phân công</p><p className="font-semibold">{classData.program ? assignments.length : "—"}</p></div>
              </CardContent></Card>
            </div>

            <Card>
              <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2"><BookOpen className="size-5 text-primary" aria-hidden="true" /> Chương trình đào tạo</CardTitle>
                  <CardDescription>Chương trình ACTIVE quyết định danh sách môn có thể phân công cho lớp {classData.classCode}.</CardDescription>
                </div>
                {classData.program && <Badge variant="secondary">Đang áp dụng</Badge>}
              </CardHeader>
              <CardContent className="space-y-5">
                {canAssignProgram ? (
                  <form onSubmit={assignProgram} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <div className="space-y-2">
                      <Label htmlFor="program-select">Chương trình ACTIVE</Label>
                      <Select value={programId} onValueChange={setProgramId}>
                        <SelectTrigger id="program-select" className="w-full"><SelectValue placeholder="Chọn chương trình" /></SelectTrigger>
                        <SelectContent>
                          {programs.map((program) => <SelectItem key={program.id} value={String(program.id)}>{program.code} · {program.name} · v{program.version}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" disabled={saving || !programId || programChangeBlocked || !programs.length || !programChanged && Boolean(classData.program)}>
                      {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
                      {classData.program ? "Cập nhật chương trình" : "Gán chương trình"}
                    </Button>
                  </form>
                ) : (
                  <p className="text-sm text-muted-foreground">Bạn có quyền xem nhưng không có quyền gán chương trình.</p>
                )}

                {canAssignProgram && !loadingResources && !resourceErrors.programs && !programs.length && (
                  <p className="text-sm text-muted-foreground">Chưa có chương trình ACTIVE. Hãy tạo và kích hoạt chương trình trong phần Training Programs trước khi gán cho lớp.</p>
                )}

                {programChangeBlocked && (
                  <Alert>
                    <AlertCircle aria-hidden="true" />
                    <AlertTitle>Chưa thể đổi chương trình</AlertTitle>
                    <AlertDescription>Lớp đang có phân công giảng dạy. Hãy kết thúc hoặc gỡ các phân công trước để giữ đúng lịch sử môn học.</AlertDescription>
                  </Alert>
                )}

                {classData.program ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-4 py-3 text-sm">
                      <span className="text-muted-foreground">Đang dùng:</span>
                      <span className="font-medium">{classData.program.code} — {classData.program.name}</span>
                      <Badge variant="outline">Phiên bản {classData.program.version}</Badge>
                      <Badge variant="secondary">{classData.program.status}</Badge>
                    </div>

                    {classData.subjects.length ? (
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead className="w-16">#</TableHead>
                          <TableHead>Môn học</TableHead>
                          <TableHead className="w-32">Thời lượng</TableHead>
                          <TableHead>Giảng viên</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {classData.subjects.map((subject) => (
                            <TableRow key={subject.programSubjectId}>
                              <TableCell className="text-muted-foreground">{subject.orderIndex}</TableCell>
                              <TableCell><div className="font-medium">{subject.subjectName}</div><div className="text-xs text-muted-foreground">{subject.subjectCode}</div></TableCell>
                              <TableCell>{subject.durationHours} giờ</TableCell>
                              <TableCell>
                                {subject.assignments.length ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {subject.assignments.map((assignment) => (
                                      <Badge key={assignment.id} variant={assignment.role === "MAIN" ? "default" : "outline"}>
                                        {assignment.trainerName || `#${assignment.trainerId}`} · {assignment.role === "MAIN" ? "Chính" : "Phụ"}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : <span className="text-sm text-muted-foreground">Chưa phân công</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <EmptyState title="Chương trình chưa có môn học" detail="Thêm môn học trong phần quản lý chương trình trước khi phân công giảng viên." />
                    )}
                  </div>
                ) : (
                  <EmptyState title="Lớp chưa được gán chương trình" detail="Chọn chương trình ACTIVE ở trên để mở danh sách môn và bắt đầu phân công giảng viên." />
                )}
              </CardContent>
            </Card>

            {classData.program && (
              <Card>
                <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5">
                    <CardTitle className="flex items-center gap-2"><CalendarDays className="size-5 text-primary" aria-hidden="true" /> {editingId === null ? "Phân công giảng viên" : `Chỉnh sửa phân công #${editingId}`}</CardTitle>
                    <CardDescription>Mỗi phân công gắn giảng viên với một môn trong chương trình và khoảng thời gian hiệu lực.</CardDescription>
                  </div>
                  {editingId === null && canCreateAssignment && <Badge variant="outline">{assignments.length} phân công</Badge>}
                </CardHeader>
                <CardContent className="space-y-6">
                  {canManageAssignments ? (
                    <form onSubmit={saveAssignment} className="grid gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 xl:grid-cols-5">
                      <div className="space-y-2 xl:col-span-2">
                        <Label htmlFor="assignment-subject">Môn trong chương trình</Label>
                        <Select value={form.programSubjectId} onValueChange={(value) => setForm((current) => ({ ...current, programSubjectId: value }))}>
                          <SelectTrigger id="assignment-subject" className="w-full"><SelectValue placeholder="Chọn môn học" /></SelectTrigger>
                          <SelectContent>
                            {classData.subjects.map((subject) => <SelectItem key={subject.programSubjectId} value={String(subject.programSubjectId)}>{subject.orderIndex}. {subject.subjectCode} — {subject.subjectName}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 xl:col-span-2">
                        <Label htmlFor="assignment-trainer">Giảng viên đang hoạt động</Label>
                        <Select value={form.trainerId} onValueChange={(value) => setForm((current) => ({ ...current, trainerId: value }))}>
                          <SelectTrigger id="assignment-trainer" className="w-full"><SelectValue placeholder="Chọn giảng viên" /></SelectTrigger>
                          <SelectContent>
                            {trainers.map((trainer) => <SelectItem key={trainer.id} value={String(trainer.id)}>{trainer.name}{trainer.email ? ` · ${trainer.email}` : ` · #${trainer.id}`}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="assignment-role">Vai trò</Label>
                        <Select value={form.role} onValueChange={(value) => setForm((current) => ({ ...current, role: value as AssignmentRole }))}>
                          <SelectTrigger id="assignment-role" className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MAIN">Giảng viên chính</SelectItem>
                            <SelectItem value="ASSISTANT">Giảng viên phụ</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="effective-from">Hiệu lực từ</Label>
                        <Input id="effective-from" type="date" required value={form.effectiveFrom} onChange={(event) => setForm((current) => ({ ...current, effectiveFrom: event.target.value, effectiveTo: current.effectiveTo && current.effectiveTo < event.target.value ? "" : current.effectiveTo }))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="effective-to">Hiệu lực đến <span className="font-normal text-muted-foreground">(không bắt buộc)</span></Label>
                        <Input id="effective-to" type="date" min={form.effectiveFrom} value={form.effectiveTo} onChange={(event) => setForm((current) => ({ ...current, effectiveTo: event.target.value }))} />
                      </div>
                      <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-5">
                        <Button type="submit" disabled={saving || !canSubmitAssignment || !classData.subjects.length || !trainers.length}>
                          {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : editingId === null ? <Plus className="size-4" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
                          {editingId === null ? "Tạo phân công" : "Lưu thay đổi"}
                        </Button>
                        {editingId !== null && <Button type="button" variant="outline" disabled={saving} onClick={resetAssignmentForm}>Hủy chỉnh sửa</Button>}
                        {!canSubmitAssignment && <span className="text-sm text-muted-foreground">Bạn không có quyền cho thao tác này.</span>}
                        {!trainers.length && <span className="text-sm text-muted-foreground">{resourceErrors.trainers ? "Chưa tải được giảng viên. Hãy thử làm mới dữ liệu." : "Không có giảng viên đang hoạt động để chọn."}</span>}
                      </div>
                    </form>
                  ) : (
                    <Alert><AlertCircle aria-hidden="true" /><AlertTitle>Chế độ chỉ xem</AlertTitle><AlertDescription>Bạn có thể xem phân công nhưng không có quyền tạo hoặc sửa.</AlertDescription></Alert>
                  )}

                  {assignments.length ? (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Môn học</TableHead>
                        <TableHead>Giảng viên</TableHead>
                        <TableHead>Vai trò</TableHead>
                        <TableHead>Thời hạn</TableHead>
                        <TableHead className="text-right">Thao tác</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {assignments.map((assignment) => (
                          <TableRow key={assignment.id}>
                            <TableCell><div className="font-medium">{assignment.subjectName}</div><div className="text-xs text-muted-foreground">{assignment.subjectCode}</div></TableCell>
                            <TableCell><div className="font-medium">{assignment.trainerName || `#${assignment.trainerId}`}</div></TableCell>
                            <TableCell><Badge variant={assignment.role === "MAIN" ? "default" : "outline"}>{assignment.role === "MAIN" ? "Chính" : "Phụ"}</Badge></TableCell>
                            <TableCell className="whitespace-nowrap">{assignment.effectiveFrom} <span className="text-muted-foreground">→</span> {assignment.effectiveTo || "Không thời hạn"}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {canUpdateAssignment && <Button type="button" variant="ghost" size="icon-sm" aria-label={`Sửa phân công ${assignment.subjectCode}`} disabled={saving} onClick={() => editAssignment(assignment)}><Pencil className="size-4" /></Button>}
                                {canDeleteAssignment && <Button type="button" variant="ghost" size="icon-sm" aria-label={`Xóa phân công ${assignment.subjectCode}`} className="text-destructive hover:text-destructive" disabled={saving} onClick={() => setPendingDelete(assignment)}><Trash2 className="size-4" /></Button>}
                                {!canUpdateAssignment && !canDeleteAssignment && <span className="text-sm text-muted-foreground">Chỉ xem</span>}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <EmptyState title="Chưa có phân công giảng dạy" detail="Chọn môn, giảng viên và thời hạn ở biểu mẫu phía trên để tạo phân công đầu tiên." />
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Xóa phân công giảng dạy?"
        description={pendingDelete ? `Bạn sắp xóa phân công ${pendingDelete.subjectCode} — ${pendingDelete.trainerName || `#${pendingDelete.trainerId}`}. Thao tác này không thể hoàn tác.` : undefined}
        confirmLabel="Xóa phân công"
        cancelLabel="Giữ lại"
        loading={saving}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void deleteAssignment()}
      />
    </MainLayout>
  );
}
