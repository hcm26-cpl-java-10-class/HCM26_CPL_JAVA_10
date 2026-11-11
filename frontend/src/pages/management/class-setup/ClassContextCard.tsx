import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  GraduationCap,
  MapPin,
  UserCheck,
  Users,
} from "lucide-react";
import type {
  ClassPlanSummary,
  ClassProgramSubjects,
  ClassSetupOverview,
} from "@/api/features/class-setup.api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ClassSetupTab = "program" | "courses" | "summary";

interface ClassContextCardProps {
  classes: ClassSetupOverview[];
  selectedClassId: string;
  classData: ClassProgramSubjects;
  summary: ClassPlanSummary | null;
  canUpdateProgram: boolean;
  canUpdateCourse: boolean;
  canReadAssignment: boolean;
  canCreateSession: boolean;
  canReadSession: boolean;
  onSelectClass: (classId: string) => void;
  onSelectTab: (tab: ClassSetupTab) => void;
}

export function ClassContextCard({
  classes,
  selectedClassId,
  classData,
  summary,
  canUpdateProgram,
  canUpdateCourse,
  canReadAssignment,
  canCreateSession,
  canReadSession,
  onSelectClass,
  onSelectTab,
}: ClassContextCardProps) {
  const ctx = classData.classContext;
  const active = !ctx.status || ctx.status.toLowerCase() === "active";
  const statusLabel = active
    ? "Đang hoạt động"
    : ctx.status?.toLowerCase() === "inactive"
      ? "Ngừng hoạt động"
      : ctx.status || "Không xác định";

  const missingCourseCount = summary?.missingCourses.length ?? 0;
  const missingAssignmentCount = summary?.missingAssignments.length ?? 0;
  const missingScheduleCount = summary?.missingSchedules.length ?? 0;
  const hasMissingSetup =
    !classData.program ||
    missingCourseCount > 0 ||
    missingAssignmentCount > 0 ||
    missingScheduleCount > 0;

  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardHeader className="gap-4 border-b bg-muted/20 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {classData.classCode}
              </Badge>
              <Badge
                variant={active ? "secondary" : "outline"}
                className={active ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300" : ""}
              >
                {statusLabel}
              </Badge>
              {ctx.formatType && <Badge variant="outline">{ctx.formatType}</Badge>}
            </div>
            <CardTitle className="text-xl">{classData.className}</CardTitle>
          </div>

          <div className="w-full sm:w-80">
            <Label htmlFor="quick-class-switcher" className="mb-1.5 block text-xs text-muted-foreground">
              Chuyển nhanh lớp học (giữ nguyên tab đang mở)
            </Label>
            <Select value={selectedClassId} onValueChange={onSelectClass}>
              <SelectTrigger id="quick-class-switcher" className="w-full bg-background">
                <SelectValue placeholder="Chọn lớp học" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((item) => (
                  <SelectItem key={item.classId} value={String(item.classId)}>
                    {item.code} — {item.name}
                    {item.status?.toLowerCase() === "inactive" ? " (Ngừng HĐ)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-start gap-3 rounded-lg border bg-card p-3.5">
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600">
              <CalendarDays className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Thời gian học của lớp</p>
              <p className="mt-0.5 text-sm font-semibold">
                {ctx.startDate || "Chưa có"} → {ctx.endDate || "Chưa có"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Ngữ cảnh lịch đào tạo</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border bg-card p-3.5">
            <div className="rounded-lg bg-violet-500/10 p-2 text-violet-600">
              <MapPin className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Địa điểm & cơ sở</p>
              <p className="mt-0.5 truncate text-sm font-semibold">
                {[ctx.site, ctx.location].filter(Boolean).join(" · ") || "Chưa cập nhật"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Hình thức: {ctx.formatType || "Tiêu chuẩn"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border bg-card p-3.5">
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
              <Users className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Số học viên ghi danh</p>
              <p className="mt-0.5 text-sm font-semibold">
                {ctx.enrolledCount} học viên
                {ctx.plannedSize != null ? ` / chỉ tiêu ${ctx.plannedSize}` : ""}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {ctx.enrolledCount > 0
                  ? "Khóa đổi/bỏ Course đã gán (SCR-52)"
                  : "Chưa có ghi danh — cho phép đổi Course"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border bg-card p-3.5">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
              <GraduationCap className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Chương trình đào tạo áp dụng</p>
              {classData.program ? (
                <>
                  <p className="mt-0.5 truncate text-sm font-semibold">
                    {classData.program.code} · v{classData.program.version}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" aria-hidden="true" />
                    {classData.subjects.length} môn · {classData.program.totalDurationHours} giờ
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-0.5 text-sm font-semibold text-amber-700 dark:text-amber-400">
                    Chưa gán chương trình
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Cần chọn chương trình ACTIVE</p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Thông báo môn còn thiếu thiết lập */}
      {!classData.program ? (
        <Alert className="border-amber-500/40 bg-amber-500/10">
          <AlertTriangle className="size-4 text-amber-700 dark:text-amber-400" aria-hidden="true" />
          <AlertTitle className="text-amber-900 dark:text-amber-200">
            Lớp {classData.classCode} chưa được gán chương trình đào tạo
          </AlertTitle>
          <AlertDescription className="mt-1 flex flex-wrap items-center justify-between gap-3 text-amber-800 dark:text-amber-300">
            <span>
              Hãy gán một chương trình đào tạo trạng thái ACTIVE để nạp danh sách môn học theo thứ tự trước khi gắn Course LMS, phân công giảng viên và xếp lịch.
            </span>
            {canUpdateProgram && active && (
              <Button size="sm" variant="outline" onClick={() => onSelectTab("program")}>
                Mở form gán chương trình
              </Button>
            )}
          </AlertDescription>
        </Alert>
      ) : hasMissingSetup ? (
        <Alert className="border-amber-500/40 bg-amber-500/10">
          <AlertTriangle className="size-4 text-amber-700 dark:text-amber-400" aria-hidden="true" />
          <AlertTitle className="text-amber-900 dark:text-amber-200">
            Thông báo môn còn thiếu thiết lập của lớp {classData.classCode}
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-2.5 text-amber-900/90 dark:text-amber-200">
            <p className="text-sm">
              Kế hoạch môn học của lớp hiện còn{" "}
              {[
                missingCourseCount > 0 ? `${missingCourseCount} môn chưa gắn Course LMS` : null,
                missingAssignmentCount > 0 ? `${missingAssignmentCount} môn chưa phân công giảng viên` : null,
                missingScheduleCount > 0 ? `${missingScheduleCount} môn chưa xếp lịch buổi học` : null,
              ]
                .filter(Boolean)
                .join(", ")}
              .
            </p>
            <div className="flex flex-wrap gap-2">
              {missingCourseCount > 0 && (
                <Button size="sm" variant="outline" className="bg-background" onClick={() => onSelectTab("courses")}>
                  <BookOpen className="size-3.5" aria-hidden="true" />
                  {canUpdateCourse ? `Gán Course (${missingCourseCount})` : `Xem Course thiếu (${missingCourseCount})`}
                </Button>
              )}
              {missingAssignmentCount > 0 && canReadAssignment && (
                <Button size="sm" variant="outline" className="bg-background" asChild>
                  <Link
                    to={`/teaching-assignments?classId=${classData.classId}${
                      summary?.missingAssignments[0]
                        ? `&programSubjectId=${summary.missingAssignments[0].programSubjectId}`
                        : ""
                    }`}
                  >
                    <UserCheck className="size-3.5" aria-hidden="true" />
                    Phân công giảng viên ({missingAssignmentCount})
                  </Link>
                </Button>
              )}
              {missingScheduleCount > 0 && (canCreateSession || canReadSession) && (
                <Button size="sm" variant="outline" className="bg-background" asChild>
                  <Link
                    to={
                      canCreateSession
                        ? `/sessions/create?classId=${classData.classId}${
                            summary?.missingSchedules[0]
                              ? `&subjectId=${summary.missingSchedules[0].subjectId}`
                              : ""
                          }`
                        : `/calendar/preview?classId=${classData.classId}`
                    }
                  >
                    <CalendarDays className="size-3.5" aria-hidden="true" />
                    {canCreateSession ? `Xếp lịch buổi học (${missingScheduleCount})` : `Xem lịch học (${missingScheduleCount})`}
                  </Link>
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => onSelectTab("summary")}>
                Xem chi tiết tổng hợp →
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          <AlertTitle>Kế hoạch môn học lớp {classData.classCode} đã hoàn tất thiết lập</AlertTitle>
          <AlertDescription>
            Tất cả {classData.subjects.length} môn thuộc chương trình {classData.program.code} (v{classData.program.version}) đều đã gắn Course LMS, có giảng viên phân công và có buổi học trên lịch.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

