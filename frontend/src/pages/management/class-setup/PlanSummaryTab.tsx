import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Layers,
  UserCheck,
} from "lucide-react";
import type {
  ClassPlanSummary,
  ClassProgramSubjects,
  ClassSubjectOption,
} from "@/api/features/class-setup.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ClassSetupTab } from "./ClassContextCard";

interface PlanSummaryTabProps {
  classData: ClassProgramSubjects;
  summary: ClassPlanSummary | null;
  subjectOptions: ClassSubjectOption[];
  canUpdateCourse: boolean;
  canReadAssignment: boolean;
  canCreateAssignment: boolean;
  canCreateSession: boolean;
  canReadSession: boolean;
  onOpenTab: (tab: ClassSetupTab) => void;
}

export function PlanSummaryTab({
  classData,
  summary,
  subjectOptions,
  canUpdateCourse,
  canReadAssignment,
  canCreateAssignment,
  canCreateSession,
  canReadSession,
  onOpenTab,
}: PlanSummaryTabProps) {
  if (!classData.program || !summary) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="font-medium">Chưa có dữ liệu tổng hợp kế hoạch môn học</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Hãy gán một chương trình đào tạo ACTIVE cho lớp {classData.classCode} trước khi xem tổng hợp kế hoạch.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => onOpenTab("program")}>
            Mở tab Chương trình & Môn học
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI tổng hợp tiến độ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Tổng số môn & thời lượng</p>
            <p className="mt-1 text-2xl font-bold">{summary.totalSubjects} môn</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tổng thời lượng: {summary.totalDurationHours} giờ
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Liên kết Course LMS</p>
            <p className="mt-1 text-2xl font-bold">
              {summary.coursesAssignedCount}/{summary.totalSubjects}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.missingCourses.length === 0
                ? "Tất cả môn đã có Course"
                : `Còn thiếu ${summary.missingCourses.length} môn`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Phân công giảng dạy</p>
            <p className="mt-1 text-2xl font-bold">
              {summary.subjectsWithTrainerCount}/{summary.totalSubjects}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.missingAssignments.length === 0
                ? "Tất cả môn đã có giảng viên"
                : `Còn thiếu ${summary.missingAssignments.length} môn`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Xếp lịch buổi học</p>
            <p className="mt-1 text-2xl font-bold">
              {summary.subjectsWithScheduleCount}/{summary.totalSubjects}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tổng {summary.totalScheduledSessions} buổi đã tạo trên lịch
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3 Khối kiểm tra môn còn thiếu thiết lập + Điều hướng theo quyền */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* 1. Thiếu Course */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <BookOpen className="size-4 text-primary" aria-hidden="true" />
                Môn chưa có Course LMS
              </span>
              <Badge variant={summary.missingCourses.length ? "destructive" : "secondary"}>
                {summary.missingCourses.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Cần gắn Course ACTIVE đúng Topic trước khi triển khai học tập trên LMS.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-4">
            {summary.missingCourses.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="size-4 shrink-0" />
                Tất cả môn học đã gắn Course LMS.
              </div>
            ) : (
              <ul className="space-y-2 text-sm">
                {summary.missingCourses.map((item) => (
                  <li
                    key={item.programSubjectId}
                    className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">
                        #{item.orderIndex}. {item.subjectName}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {item.subjectCode} · v{item.subjectVersion} · {item.durationHours}h
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <Button variant="outline" className="w-full" onClick={() => onOpenTab("courses")}>
              {canUpdateCourse ? "Mở bảng gán Course theo Topic" : "Xem bảng Course theo Topic"}
            </Button>
          </CardContent>
        </Card>

        {/* 2. Thiếu Phân công giảng dạy */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <UserCheck className="size-4 text-primary" aria-hidden="true" />
                Môn chưa phân công giảng viên
              </span>
              <Badge variant={summary.missingAssignments.length ? "destructive" : "secondary"}>
                {summary.missingAssignments.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Mở màn hình phân công giảng dạy tương ứng theo quyền được cấp.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-4">
            {summary.missingAssignments.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="size-4 shrink-0" />
                Tất cả môn học đã được phân công giảng viên.
              </div>
            ) : (
              <ul className="space-y-2 text-sm">
                {summary.missingAssignments.map((item) => (
                  <li
                    key={item.programSubjectId}
                    className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        #{item.orderIndex}. {item.subjectName}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {item.subjectCode} · v{item.subjectVersion}
                      </p>
                    </div>
                    {canReadAssignment && (
                      <Button size="sm" variant="ghost" asChild>
                        <Link
                          to={`/teaching-assignments?classId=${classData.classId}&programSubjectId=${item.programSubjectId}`}
                        >
                          {canCreateAssignment ? "Phân công" : "Xem"} <ExternalLink className="size-3" />
                        </Link>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {canReadAssignment ? (
              <Button variant="outline" className="w-full" asChild>
                <Link to={`/teaching-assignments?classId=${classData.classId}`}>
                  Mở màn hình phân công giảng dạy <ExternalLink className="size-3.5" />
                </Link>
              </Button>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                Cần quyền ASSIGNMENT_READ để mở màn hình phân công.
              </p>
            )}
          </CardContent>
        </Card>

        {/* 3. Thiếu Xếp lịch */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                Môn chưa xếp lịch buổi học
              </span>
              <Badge variant={summary.missingSchedules.length ? "destructive" : "secondary"}>
                {summary.missingSchedules.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Mở màn hình tạo buổi học đơn, tạo lịch hàng loạt hoặc xem thời khóa biểu tuần.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-4">
            {summary.missingSchedules.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="size-4 shrink-0" />
                Tất cả môn học đã có buổi học trên lịch.
              </div>
            ) : (
              <ul className="space-y-2 text-sm">
                {summary.missingSchedules.map((item) => (
                  <li
                    key={item.programSubjectId}
                    className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        #{item.orderIndex}. {item.subjectName}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {item.subjectCode} · {item.durationHours} giờ
                      </p>
                    </div>
                    {canCreateSession && (
                      <Button size="sm" variant="ghost" asChild>
                        <Link
                          to={`/sessions/create?classId=${classData.classId}&subjectId=${item.subjectId}`}
                        >
                          Tạo buổi <ExternalLink className="size-3" />
                        </Link>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-2">
              {canCreateSession && (
                <>
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link to={`/sessions/create?classId=${classData.classId}`}>
                      Tạo buổi đơn <ExternalLink className="size-3.5" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link to="/schedule-validation">
                      Kiểm tra nhiều buổi <ExternalLink className="size-3.5" />
                    </Link>
                  </Button>
                </>
              )}
              {canReadSession && (
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link to={`/calendar/preview?classId=${classData.classId}`}>
                    Mở lịch tuần của lớp <ExternalLink className="size-3.5" />
                  </Link>
                </Button>
              )}
              {!canCreateSession && !canReadSession && (
                <p className="w-full text-center text-xs text-muted-foreground">
                  Cần quyền SESSION_READ hoặc SESSION_CREATE để mở màn hình lịch học.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bảng dữ liệu lựa chọn cung cấp cho phân công GV / tạo buổi / xếp lịch tuần */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="size-4 text-primary" aria-hidden="true" />
            Dữ liệu lựa chọn môn học của lớp (Cung cấp cho Phân công, Tạo buổi đơn & Lịch hàng loạt)
          </CardTitle>
          <CardDescription>
            Hợp đồng dữ liệu trả từ <code className="rounded bg-muted px-1 py-0.5 text-xs">GET /api/classes/{classData.classId}/subject-options</code> gồm{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">programSubjectId</code>,{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">subjectId</code>, thứ tự, thời lượng và Course đã gắn.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subjectOptions.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="size-4" /> Chưa có môn học nào trong danh sách lựa chọn.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>orderIndex</TableHead>
                    <TableHead>programSubjectId</TableHead>
                    <TableHead>subjectId & Tên môn</TableHead>
                    <TableHead>Thời lượng</TableHead>
                    <TableHead>Course liên kết (courseId / code / name)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjectOptions.map((opt) => (
                    <TableRow key={opt.programSubjectId}>
                      <TableCell className="font-mono">#{opt.orderIndex}</TableCell>
                      <TableCell className="font-mono text-xs">{opt.programSubjectId}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          [ID {opt.subjectId}]
                        </span>{" "}
                        <span className="font-medium">{opt.subjectName}</span>{" "}
                        <span className="text-xs text-muted-foreground">
                          ({opt.subjectCode} · v{opt.subjectVersion})
                        </span>
                      </TableCell>
                      <TableCell>{opt.durationHours} giờ</TableCell>
                      <TableCell>
                        {opt.courseId ? (
                          <span className="text-sm">
                            <span className="font-mono text-xs text-muted-foreground">
                              [#{opt.courseId}]
                            </span>{" "}
                            {opt.courseCode ? `${opt.courseCode} — ` : ""}
                            {opt.courseName}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">null (Chưa gán Course)</span>
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
    </div>
  );
}

