import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  Lock,
  ShieldAlert,
  Trash2,
  UserCheck,
} from "lucide-react";
import type {
  ClassProgramSubjectItem,
  ClassProgramSubjects,
} from "@/api/features/class-setup.api";
import type { TrainingProgramResponse } from "@/api/features/program.api";
import ConfirmDialog from "@/components/ui/confirmdialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ClassSetupTab } from "./ClassContextCard";

interface ProgramSubjectsTabProps {
  classData: ClassProgramSubjects;
  enrichedSubjects: ClassProgramSubjectItem[];
  programs: TrainingProgramResponse[];
  canAssignProgram: boolean;
  canUpdateCourse: boolean;
  canReadAssignment: boolean;
  canCreateSession: boolean;
  canReadSession: boolean;
  saving: boolean;
  onAssignProgram: (programId: number) => Promise<void>;
  onRemoveProgram: () => Promise<void>;
  onOpenTab: (tab: ClassSetupTab) => void;
}

export function ProgramSubjectsTab({
  classData,
  enrichedSubjects,
  programs,
  canAssignProgram,
  canUpdateCourse,
  canReadAssignment,
  canCreateSession,
  canReadSession,
  saving,
  onAssignProgram,
  onRemoveProgram,
  onOpenTab,
}: ProgramSubjectsTabProps) {
  const [selectedProgramId, setSelectedProgramId] = useState(
    classData.program ? String(classData.program.id) : "",
  );
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  useEffect(() => {
    setSelectedProgramId(classData.program ? String(classData.program.id) : "");
  }, [classData.classId, classData.program]);

  const isClassActive =
    !classData.classContext.status || classData.classContext.status.toLowerCase() === "active";

  const hasCurrentProgram = Boolean(classData.program);
  const isDifferentProgramSelected = Boolean(
    selectedProgramId && (!classData.program || Number(selectedProgramId) !== classData.program.id),
  );
  const isChangeBlocked = hasCurrentProgram && classData.programChangeBlocked;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProgramId || !isClassActive) return;
    if (hasCurrentProgram && !isDifferentProgramSelected) return;
    if (hasCurrentProgram && isChangeBlocked) return;
    await onAssignProgram(Number(selectedProgramId));
  };

  return (
    <div className="space-y-6">
      {/* Form gán / đổi / bỏ chương trình */}
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="size-5 text-primary" aria-hidden="true" />
              Form gán chương trình đào tạo
            </CardTitle>
            <CardDescription>
              Chọn chương trình đào tạo trạng thái ACTIVE và phiên bản tương ứng để nạp danh sách môn học theo thứ tự vào kế hoạch lớp {classData.classCode}.
            </CardDescription>
          </div>
          {classData.program && (
            <Badge variant="secondary">
              Đang áp dụng: {classData.program.code} · v{classData.program.version}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!isClassActive && (
            <Alert>
              <AlertCircle className="size-4" aria-hidden="true" />
              <AlertTitle>Lớp đang ngừng hoạt động</AlertTitle>
              <AlertDescription>
                Lớp ở trạng thái ngừng hoạt động chỉ cho phép tra cứu kế hoạch môn học, không thể gán mới hoặc đổi chương trình.
              </AlertDescription>
            </Alert>
          )}

          {canAssignProgram ? (
            <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
              <div className="space-y-2">
                <Label htmlFor="active-program-select">Chương trình đào tạo ACTIVE & phiên bản</Label>
                <Select
                  value={selectedProgramId}
                  disabled={saving || !isClassActive || (hasCurrentProgram && isChangeBlocked)}
                  onValueChange={setSelectedProgramId}
                >
                  <SelectTrigger id="active-program-select" className="w-full">
                    <SelectValue placeholder="Chọn chương trình ACTIVE..." />
                  </SelectTrigger>
                  <SelectContent>
                    {classData.program &&
                      !programs.some((item) => item.id === classData.program?.id) && (
                        <SelectItem value={String(classData.program.id)}>
                          {classData.program.code} — {classData.program.name} · v{classData.program.version} ({classData.program.status})
                        </SelectItem>
                      )}
                    {programs.map((program) => (
                      <SelectItem key={program.id} value={String(program.id)}>
                        {program.code} — {program.name} · Phiên bản {program.version} ({program.totalDurationHours} giờ)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                disabled={
                  saving ||
                  !isClassActive ||
                  !selectedProgramId ||
                  (hasCurrentProgram && !isDifferentProgramSelected) ||
                  (hasCurrentProgram && isChangeBlocked)
                }
              >
                {saving ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                )}
                {hasCurrentProgram ? "Đổi chương trình" : "Gán chương trình"}
              </Button>

              {hasCurrentProgram && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={saving || !isClassActive || isChangeBlocked}
                  onClick={() => setConfirmRemoveOpen(true)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Bỏ chương trình
                </Button>
              )}
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tài khoản của bạn đang ở chế độ xem kế hoạch lớp (cần quyền <code className="rounded bg-muted px-1 py-0.5 text-xs">CLASS_UPDATE_PROGRAM</code> để gán, đổi hoặc bỏ chương trình).
            </p>
          )}

          {hasCurrentProgram && isChangeBlocked && (
            <Alert className="border-amber-500/40 bg-amber-500/10">
              <ShieldAlert className="size-4 text-amber-700 dark:text-amber-400" aria-hidden="true" />
              <AlertTitle className="text-amber-900 dark:text-amber-200">
                Đang khóa đổi / bỏ chương trình để bảo toàn dữ liệu lớp
              </AlertTitle>
              <AlertDescription className="mt-1 space-y-1 text-amber-900/90 dark:text-amber-300">
                <p>
                  Lớp {classData.classCode} không thể đổi hoặc gỡ chương trình vì đang có dữ liệu ràng buộc:{" "}
                  <strong>{classData.programChangeBlockReasons.join("; ")}</strong>.
                </p>
                <p className="text-xs">
                  Theo quy định nghiệp vụ, hệ thống chặn thao tác phá dữ liệu và tuyệt đối không tự động xóa phân công giảng dạy hay buổi học đã tạo.
                </p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Danh sách môn học theo thứ tự của lớp */}
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">Danh sách môn học trong kế hoạch lớp</CardTitle>
            <CardDescription>
              Hiển thị theo đúng thứ tự môn của chương trình kèm thời lượng, Course LMS đang gắn, phân công giảng dạy và số buổi đã xếp lịch.
            </CardDescription>
          </div>
          {classData.program && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => onOpenTab("courses")}>
                <BookOpen className="size-4" aria-hidden="true" />
                {canUpdateCourse ? "Gán Course theo Topic" : "Xem bảng Course theo Topic"}
              </Button>
              {canReadAssignment && (
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/teaching-assignments?classId=${classData.classId}`}>
                    <UserCheck className="size-4" aria-hidden="true" />
                    Màn hình phân công
                  </Link>
                </Button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!classData.program ? (
            <div className="rounded-lg border border-dashed px-6 py-12 text-center">
              <p className="font-medium">Lớp chưa có kế hoạch môn học</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Chọn một chương trình đào tạo ACTIVE ở biểu mẫu phía trên để nạp danh sách môn học cho lớp.
              </p>
            </div>
          ) : enrichedSubjects.length === 0 ? (
            <div className="rounded-lg border border-dashed px-6 py-12 text-center">
              <p className="font-medium">Chương trình đào tạo chưa có môn học</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Hãy bổ sung danh sách môn trong chức năng Quản lý chương trình đào tạo.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Thứ tự</TableHead>
                    <TableHead>Mã / Tên / Phiên bản môn</TableHead>
                    <TableHead className="w-28">Thời lượng</TableHead>
                    <TableHead>Course LMS đang gắn</TableHead>
                    <TableHead>Phân công giảng dạy</TableHead>
                    <TableHead>Số buổi đã xếp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrichedSubjects.map((subject) => (
                    <TableRow key={subject.programSubjectId}>
                      <TableCell className="font-mono font-semibold text-muted-foreground">
                        #{subject.orderIndex}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{subject.subjectName}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="font-mono">{subject.subjectCode}</span>
                          <span>·</span>
                          <Badge variant="outline" className="px-1.5 py-0 text-[11px]">
                            v{subject.subjectVersion}
                          </Badge>
                          {subject.technicalGroup && (
                            <>
                              <span>·</span>
                              <span>{subject.technicalGroup}</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium">
                        {subject.durationHours} giờ
                      </TableCell>
                      <TableCell>
                        {subject.course ? (
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {subject.course.code && (
                                <Badge variant="secondary" className="font-mono text-xs">
                                  {subject.course.code}
                                </Badge>
                              )}
                              <span className="text-sm font-medium">{subject.course.name}</span>
                            </div>
                            {subject.courseChangeLocked && (
                              <div className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                                <Lock className="size-3" aria-hidden="true" />
                                Khóa đổi/bỏ sau ghi danh (SCR-52)
                              </div>
                            )}
                          </div>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-auto px-2 py-1 text-xs text-amber-700 hover:text-amber-800 dark:text-amber-400"
                            onClick={() => onOpenTab("courses")}
                          >
                            + Chưa gắn Course (chọn trong tab Course)
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        {subject.assignments.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {subject.assignments.map((assignment) => (
                              <Badge
                                key={assignment.id}
                                variant={assignment.role === "MAIN" ? "default" : "outline"}
                              >
                                {assignment.trainerName || `GV #${assignment.trainerId}`} ·{" "}
                                {assignment.role === "MAIN" ? "Chính" : "Phụ"}
                              </Badge>
                            ))}
                          </div>
                        ) : canReadAssignment ? (
                          <Link
                            to={`/teaching-assignments?classId=${classData.classId}&programSubjectId=${subject.programSubjectId}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 underline hover:text-amber-800 dark:text-amber-400"
                          >
                            Chưa phân công <ExternalLink className="size-3" />
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">Chưa phân công</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {subject.scheduledSessionCount > 0 ? (
                          <div className="space-y-0.5 text-sm">
                            <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 dark:text-blue-300">
                              <CalendarDays className="mr-1 size-3" />
                              {subject.scheduledSessionCount} buổi
                            </Badge>
                            {subject.completedSessionCount > 0 && (
                              <div className="text-[11px] text-muted-foreground">
                                Đã hoàn thành: {subject.completedSessionCount}
                              </div>
                            )}
                          </div>
                        ) : canCreateSession ? (
                          <Link
                            to={`/sessions/create?classId=${classData.classId}&subjectId=${subject.subjectId}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 underline hover:text-amber-800 dark:text-amber-400"
                          >
                            0 buổi · Xếp lịch <ExternalLink className="size-3" />
                          </Link>
                        ) : canReadSession ? (
                          <Link
                            to={`/calendar/preview?classId=${classData.classId}`}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline"
                          >
                            0 buổi
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">0 buổi</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmRemoveOpen}
        title="Bỏ chương trình đào tạo khỏi lớp?"
        description={`Bạn sắp gỡ chương trình ${classData.program?.code ?? ""} khỏi lớp ${classData.classCode}. Thao tác này chỉ thực hiện được khi lớp chưa phát sinh ghi danh, Course đã gán, phân công giảng dạy hay buổi học.`}
        confirmLabel="Xác nhận bỏ chương trình"
        cancelLabel="Giữ lại"
        loading={saving}
        onCancel={() => setConfirmRemoveOpen(false)}
        onConfirm={() => {
          setConfirmRemoveOpen(false);
          void onRemoveProgram();
        }}
      />
    </div>
  );
}

