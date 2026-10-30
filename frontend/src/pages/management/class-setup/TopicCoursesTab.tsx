import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  Lock,
  RotateCcw,
  Save,
  XCircle,
} from "lucide-react";
import type {
  ClassProgramSubjects,
  TopicCourseSaveItem,
} from "@/api/features/class-setup.api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ClassSetupTab } from "./ClassContextCard";

const UNASSIGNED_VALUE = "__NONE__";

interface TopicCoursesTabProps {
  classData: ClassProgramSubjects;
  canUpdateCourse: boolean;
  canReadCourseCatalog: boolean;
  saving: boolean;
  onSaveCourses: (items: TopicCourseSaveItem[]) => Promise<void>;
  onOpenTab: (tab: ClassSetupTab) => void;
}

export function TopicCoursesTab({
  classData,
  canUpdateCourse,
  canReadCourseCatalog,
  saving,
  onSaveCourses,
  onOpenTab,
}: TopicCoursesTabProps) {
  const [draftByPsId, setDraftByPsId] = useState<Record<number, string>>({});

  useEffect(() => {
    const initial: Record<number, string> = {};
    for (const subject of classData.subjects) {
      initial[subject.programSubjectId] = subject.course
        ? String(subject.course.courseId)
        : UNASSIGNED_VALUE;
    }
    setDraftByPsId(initial);
  }, [classData]);

  const isClassActive =
    !classData.classContext.status || classData.classContext.status.toLowerCase() === "active";

  const changedItems = useMemo(() => {
    const items: TopicCourseSaveItem[] = [];
    for (const subject of classData.subjects) {
      const currentVal = subject.course ? String(subject.course.courseId) : UNASSIGNED_VALUE;
      const draftVal = draftByPsId[subject.programSubjectId] ?? currentVal;
      if (draftVal !== currentVal) {
        items.push({
          programSubjectId: subject.programSubjectId,
          courseId: draftVal === UNASSIGNED_VALUE ? null : Number(draftVal),
        });
      }
    }
    return items;
  }, [classData.subjects, draftByPsId]);

  const resetDraft = () => {
    const reset: Record<number, string> = {};
    for (const subject of classData.subjects) {
      reset[subject.programSubjectId] = subject.course
        ? String(subject.course.courseId)
        : UNASSIGNED_VALUE;
    }
    setDraftByPsId(reset);
  };

  if (!classData.program) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="font-medium">Lớp {classData.classCode} chưa được gán chương trình đào tạo</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Hãy gán một chương trình ACTIVE ở tab Chương trình & Môn học trước khi gắn Course LMS theo từng Topic.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => onOpenTab("program")}>
            Mở tab Chương trình & Môn học
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {classData.courseChangeLockedByEnrollment && (
        <Alert className="border-amber-500/40 bg-amber-500/10">
          <Lock className="size-4 text-amber-700 dark:text-amber-400" aria-hidden="true" />
          <AlertTitle className="text-amber-900 dark:text-amber-200">
            Áp dụng quy tắc khóa Course sau ghi danh (SCR-52)
          </AlertTitle>
          <AlertDescription className="text-amber-900/90 dark:text-amber-300">
            Lớp {classData.classCode} đã có <strong>{classData.classContext.enrolledCount} học viên</strong> ghi danh.
            Các Topic đã gắn Course sẽ bị khóa đổi hoặc bỏ gán theo quy tắc SCR-52; các Topic chưa có Course vẫn có thể gắn Course ACTIVE lần đầu.
          </AlertDescription>
        </Alert>
      )}

      {!canUpdateCourse && (
        <Alert>
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertTitle>Chế độ chỉ xem bảng Course theo Topic</AlertTitle>
          <AlertDescription>
            Bạn đang xem danh sách Course LMS gắn cho từng môn của lớp. Cần quyền{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">CLASS_UPDATE_COURSE</code> để gán hoặc bỏ gán Course.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="size-5 text-primary" aria-hidden="true" />
              Bảng Course LMS theo Topic của lớp {classData.classCode}
            </CardTitle>
            <CardDescription>
              Mỗi Topic (môn học) chỉ cho phép chọn các Course LMS đang ACTIVE thuộc đúng Topic đó.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canReadCourseCatalog && (
              <Button size="sm" variant="outline" asChild>
                <Link to="/courses">
                  Danh mục Course LMS <ExternalLink className="size-3.5" />
                </Link>
              </Button>
            )}
            {canUpdateCourse && isClassActive && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={saving || changedItems.length === 0}
                  onClick={resetDraft}
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Đặt lại
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={saving || changedItems.length === 0}
                  onClick={() => void onSaveCourses(changedItems)}
                >
                  {saving ? (
                    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="size-4" aria-hidden="true" />
                  )}
                  Lưu thay đổi ({changedItems.length})
                </Button>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Thứ tự</TableHead>
                  <TableHead>Topic / Môn học</TableHead>
                  <TableHead>Course hiện tại</TableHead>
                  <TableHead className="min-w-72">Chọn Course ACTIVE thuộc Topic</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Bỏ gán</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classData.subjects.map((subject) => {
                  const currentVal = subject.course
                    ? String(subject.course.courseId)
                    : UNASSIGNED_VALUE;
                  const selectedVal = draftByPsId[subject.programSubjectId] ?? currentVal;
                  const isDirty = selectedVal !== currentVal;
                  const rowLocked =
                    !canUpdateCourse || !isClassActive || subject.courseChangeLocked;

                  // Include current course in select options if it became inactive later
                  const options = [...subject.availableCourses];
                  if (
                    subject.course &&
                    !options.some((opt) => opt.courseId === subject.course?.courseId)
                  ) {
                    options.unshift(subject.course);
                  }

                  let rowBadge = (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Chưa gắn Course
                    </Badge>
                  );
                  if (subject.courseChangeLocked) {
                    rowBadge = (
                      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300">
                        <Lock className="mr-1 size-3" /> Khóa SCR-52
                      </Badge>
                    );
                  } else if (isDirty && selectedVal === UNASSIGNED_VALUE) {
                    rowBadge = (
                      <Badge variant="destructive" className="text-xs">
                        Sẽ bỏ gán
                      </Badge>
                    );
                  } else if (isDirty && currentVal === UNASSIGNED_VALUE) {
                    rowBadge = (
                      <Badge className="bg-emerald-600 text-xs text-white hover:bg-emerald-600">
                        Sẽ gán mới
                      </Badge>
                    );
                  } else if (isDirty) {
                    rowBadge = (
                      <Badge className="bg-blue-600 text-xs text-white hover:bg-blue-600">
                        Sẽ đổi Course
                      </Badge>
                    );
                  } else if (subject.course) {
                    rowBadge = (
                      <Badge variant="secondary" className="bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="mr-1 size-3" /> Đang gắn
                      </Badge>
                    );
                  }

                  return (
                    <TableRow key={subject.programSubjectId}>
                      <TableCell className="font-mono font-semibold text-muted-foreground">
                        #{subject.orderIndex}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{subject.subjectName}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          <span className="font-mono">{subject.subjectCode}</span> · v{subject.subjectVersion} ·{" "}
                          {subject.durationHours} giờ
                        </div>
                      </TableCell>
                      <TableCell>
                        {subject.course ? (
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {subject.course.code && (
                                <Badge variant="outline" className="font-mono text-[11px]">
                                  {subject.course.code}
                                </Badge>
                              )}
                              <span className="text-sm font-medium">{subject.course.name}</span>
                            </div>
                            {subject.course.instructor && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Phụ trách học liệu: {subject.course.instructor}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Chưa gắn Course</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {options.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            Chưa có Course ACTIVE nào thuộc Topic {subject.subjectCode}
                          </span>
                        ) : (
                          <Select
                            value={selectedVal}
                            disabled={saving || rowLocked}
                            onValueChange={(value) =>
                              setDraftByPsId((prev) => ({
                                ...prev,
                                [subject.programSubjectId]: value,
                              }))
                            }
                          >
                            <SelectTrigger
                              aria-label={`Chọn Course cho ${subject.subjectCode}`}
                              className="w-full"
                            >
                              <SelectValue placeholder="Chọn Course ACTIVE..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={UNASSIGNED_VALUE}>
                                — Chưa gán / Bỏ gán Course —
                              </SelectItem>
                              {options.map((course) => (
                                <SelectItem key={course.courseId} value={String(course.courseId)}>
                                  {course.code ? `${course.code} — ` : ""}
                                  {course.name}
                                  {!course.active ? " (Ngừng HĐ)" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>{rowBadge}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={
                            saving ||
                            rowLocked ||
                            selectedVal === UNASSIGNED_VALUE
                          }
                          onClick={() =>
                            setDraftByPsId((prev) => ({
                              ...prev,
                              [subject.programSubjectId]: UNASSIGNED_VALUE,
                            }))
                          }
                        >
                          <XCircle className="size-4" aria-hidden="true" />
                          Bỏ gán
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

