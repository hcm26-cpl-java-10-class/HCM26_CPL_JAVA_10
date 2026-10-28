import { departmentApi, enrollmentApi } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DepartmentMemberPicker } from "@/pages/student/DepartmentMemberPicker.tsx";
import { StudentCheckboxList } from "@/pages/student/StudentCheckboxList";
import type { CatalogCourse, DepartmentBatchEnrollmentResult, DepartmentMember } from "@/types";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, LoaderCircle, UserRound, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type EnrollmentTarget = "department" | "student";

export function CourseEnrollmentAssignmentDialog({
  course,
}: {
  course: CatalogCourse;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<EnrollmentTarget>("department");
  // Các department đang được chọn (chọn nhiều cùng lúc)
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<number[]>([]);
  // Thành viên bị BỎ tick theo từng department: { [departmentId]: memberIds[] }
  const [excludedByDept, setExcludedByDept] = useState<Record<number, number[]>>({});
  const [departmentSearch, setDepartmentSearch] = useState("");
  // Kết quả thật sau khi assign (hiển thị ai đã được enroll)
  const [batchResult, setBatchResult] = useState<DepartmentBatchEnrollmentResult | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<DepartmentMember[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentPage, setStudentPage] = useState(0);
  const queryClient = useQueryClient();

  const departmentsQuery = useQuery({
    queryKey: ["course-assignment-departments"],
    enabled: open && target === "department",
    queryFn: async () => {
      const firstPage = await departmentApi.getPage(
        { page: 0, size: 100, sort: "name,asc" },
      );
      const remainingPages = await Promise.all(
        Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) =>
          departmentApi.getPage({ page: index + 1, size: 100, sort: "name,asc" }),
        ),
      );
      return [firstPage, ...remainingPages]
        .flatMap((page) => page.content)
        .filter((department) => department.isActive !== false && department.id !== undefined);
    },
  });

  const assignedQuery = useQuery({
    queryKey: ["course-assigned-departments", course.id],
    enabled: open && target === "department",
    queryFn: () => enrollmentApi.getAssignedDepartmentIds(course.id),
  });

  const availableDepartments = useMemo(() => {
    const hidden = new Set(assignedQuery.data ?? []);
    return (departmentsQuery.data ?? []).filter(
      (department) => department.id !== undefined && !hidden.has(department.id),
    );
  }, [departmentsQuery.data, assignedQuery.data]);

  const filteredDepartments = useMemo(() => {
    const keyword = departmentSearch.trim().toLowerCase();
    if (!keyword) return availableDepartments;
    return availableDepartments.filter((department) =>
      `${department.name ?? ""} ${department.code ?? ""}`.toLowerCase().includes(keyword),
    );
  }, [availableDepartments, departmentSearch]);

  const studentsQuery = useQuery({
    queryKey: ["course-assignment-students", studentSearch, studentPage],
    enabled: open && target === "student",
    queryFn: () => enrollmentApi.searchStudents(studentPage, studentSearch.trim()),
  });

  const membersQueries = useQueries({
    queries: selectedDepartmentIds.map((id) => ({
      queryKey: ["course-assignment-members", id],
      enabled: open && target === "department",
      queryFn: () => departmentApi.getAllMembers(id),
    })),
  });
  const membersLoading = membersQueries.some((query) => query.isLoading);
  const membersError = membersQueries.find((query) => query.isError)?.error;
  const membersReady =
    selectedDepartmentIds.length > 0 && membersQueries.every((query) => query.isSuccess);

  const batchRequest = useMemo(
    () => ({
      courseId: course.id,
      departments: selectedDepartmentIds.map((id) => ({
        departmentId: id,
        excludedStudentIds: excludedByDept[id] ?? [],
      })),
    }),
    [course.id, selectedDepartmentIds, excludedByDept],
  );

  const previewQuery = useQuery({
    queryKey: ["course-assignment-preview", batchRequest],
    enabled: open && target === "department" && membersReady && !batchResult,
    placeholderData: (previous) => previous,
    queryFn: () => enrollmentApi.previewDepartments(batchRequest),
  });

  // Những người đã enroll sẵn (để hiện badge + khóa checkbox)
  const enrolledIds = useMemo(
    () =>
      new Set(
        (previewQuery.data?.departments ?? []).flatMap((department) =>
          department.alreadyEnrolledMembers.map((member) => member.id),
        ),
      ),
    [previewQuery.data],
  );

  const refreshCourseData = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["department-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["course-catalog"] }),
      queryClient.invalidateQueries({ queryKey: ["course-detail"] }),
    ]);

  const departmentMutation = useMutation({
    mutationFn: () => enrollmentApi.enrollDepartments(batchRequest),
    onSuccess: async (result) => {
      toast.success(
        `${result.totalNewEnrollments} student${result.totalNewEnrollments === 1 ? "" : "s"} enrolled in ${result.courseName}.`,
      );
      setBatchResult(result);
      await Promise.all([
        refreshCourseData(),
        queryClient.invalidateQueries({ queryKey: ["course-assigned-departments", course.id] }),
        queryClient.invalidateQueries({ queryKey: ["course-assignment-preview"] }),
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Department enrollment failed.");
    },
  });

  const studentMutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        selectedStudents.map((student) =>
          enrollmentApi.enrollStudent({ studentId: student.id, courseId: course.id }),
        ),
      );
      const failed = results.filter((result) => result.status === "rejected").length;
      return { total: results.length, failed };
    },
    onSuccess: async ({ total, failed }) => {
      const succeeded = total - failed;
      if (succeeded > 0) {
        toast.success(`${succeeded} student${succeeded === 1 ? "" : "s"} enrolled in this course.`);
      }
      if (failed > 0) {
        toast.error(`${failed} student${failed === 1 ? "" : "s"} could not be enrolled.`);
      }
      await refreshCourseData();
      if (failed === 0) {
        setOpen(false);
      } else {
        setSelectedStudents([]);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Student enrollment failed.");
    },
  });

  const isPending = departmentMutation.isPending || studentMutation.isPending;

  const resetDepartmentSelection = () => {
    setSelectedDepartmentIds([]);
    setExcludedByDept({});
    setDepartmentSearch("");
    setBatchResult(null);
  };

  const resetForm = () => {
    setTarget("department");
    resetDepartmentSelection();
    setSelectedStudents([]);
    setStudentSearch("");
    setStudentPage(0);
  };

  const toggleDepartment = (departmentId: number, checked: boolean) => {
    setSelectedDepartmentIds((ids) =>
      checked ? [...ids.filter((id) => id !== departmentId), departmentId] : ids.filter((id) => id !== departmentId),
    );
    if (!checked) {
      setExcludedByDept((current) => {
        const rest = { ...current };
        delete rest[departmentId];
        return rest;
      });
    }
  };

  const departmentName = (departmentId: number) => {
    const department = (departmentsQuery.data ?? []).find((item) => item.id === departmentId);
    return department?.name || department?.code || `Department ${departmentId}`;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen && !isPending) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="flex-1">
          Assign
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enroll in {course.name}</DialogTitle>
          <DialogDescription>
            Choose one or more departments to enroll their active students, or choose individual students.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Select
            value={target}
            onValueChange={(value) => {
              if (value !== "department" && value !== "student") return;
              setTarget(value);
              resetDepartmentSelection();
              setSelectedStudents([]);
              setStudentPage(0);
            }}
            disabled={isPending}
          >
            <SelectTrigger aria-label="Enrollment target" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="department">
                <span className="inline-flex items-center gap-2">
                  <Users className="size-4" /> Department
                </span>
              </SelectItem>
              <SelectItem value="student">
                <span className="inline-flex items-center gap-2">
                  <UserRound className="size-4" /> Student
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          {target === "department" ? (
            departmentsQuery.isLoading || assignedQuery.isLoading ? (
              <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" /> Loading departments...
              </p>
            ) : departmentsQuery.isError ? (
              <div role="alert" className="space-y-2">
                <p className="text-sm text-destructive">
                  {departmentsQuery.error instanceof Error
                    ? departmentsQuery.error.message
                    : "Could not load departments."}
                </p>
                <Button variant="outline" size="sm" onClick={() => void departmentsQuery.refetch()}>
                  Try again
                </Button>
              </div>
            ) : batchResult ? (
              <BatchResultView
                result={batchResult}
                onAssignMore={resetDepartmentSelection}
                onClose={() => {
                  setOpen(false);
                  resetForm();
                }}
              />
            ) : availableDepartments.length ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Input
                    aria-label="Search departments"
                    placeholder="Search departments"
                    value={departmentSearch}
                    onChange={(event) => setDepartmentSearch(event.target.value)}
                    disabled={isPending}
                  />
                  <div className="rounded-md border">
                    <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-sm font-medium">
                      <span>Departments</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {selectedDepartmentIds.length} selected
                      </span>
                    </div>
                    <ul className="max-h-40 divide-y overflow-y-auto">
                      {filteredDepartments.length ? (
                        filteredDepartments.map((department) => {
                          const id = department.id as number;
                          return (
                            <li key={id}>
                              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40">
                                <Checkbox
                                  checked={selectedDepartmentIds.includes(id)}
                                  disabled={isPending}
                                  onCheckedChange={(value) => toggleDepartment(id, value === true)}
                                />
                                <span className="min-w-0 flex-1 truncate">
                                  {department.name || department.code || `Department ${id}`}
                                </span>
                              </label>
                            </li>
                          );
                        })
                      ) : (
                        <li className="px-3 py-3 text-sm text-muted-foreground">No department matches.</li>
                      )}
                    </ul>
                  </div>
                </div>

                {selectedDepartmentIds.length > 0 && membersLoading && (
                  <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" /> Loading members...
                  </p>
                )}
                {membersError && (
                  <p role="alert" className="text-sm text-destructive">
                    {membersError instanceof Error ? membersError.message : "Could not load department members."}
                  </p>
                )}

                {selectedDepartmentIds.map((id, index) => {
                  const members = membersQueries[index]?.data;
                  if (!members) return null;
                  return (
                    <DepartmentMemberPicker
                      key={id}
                      title={departmentName(id)}
                      members={members}
                      excludedIds={excludedByDept[id] ?? []}
                      enrolledIds={enrolledIds}
                      onExcludedChange={(ids) =>
                        setExcludedByDept((current) => ({ ...current, [id]: ids }))
                      }
                      onRemoveDepartment={() => toggleDepartment(id, false)}
                      disabled={isPending}
                    />
                  );
                })}

                {previewQuery.isError && (
                  <p role="alert" className="text-sm text-destructive">
                    {previewQuery.error instanceof Error
                      ? previewQuery.error.message
                      : "Could not check department enrollment."}
                  </p>
                )}
                {previewQuery.data && selectedDepartmentIds.length > 0 && (
                  <div className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">
                      {previewQuery.data.totalNewEnrollments} new enrollment
                      {previewQuery.data.totalNewEnrollments === 1 ? "" : "s"} across{" "}
                      {selectedDepartmentIds.length} department
                      {selectedDepartmentIds.length === 1 ? "" : "s"}
                    </p>
                    {previewQuery.data.totalAlreadyEnrolled > 0 && (
                      <p className="mt-1 text-muted-foreground">
                        {previewQuery.data.totalAlreadyEnrolled} already enrolled (skipped).
                      </p>
                    )}
                  </div>
                )}
                <Button
                  className="w-full"
                  disabled={
                    !previewQuery.data
                    || previewQuery.isFetching
                    || previewQuery.data.totalNewEnrollments === 0
                    || previewQuery.isError
                    || selectedDepartmentIds.length === 0
                    || isPending
                  }
                  onClick={() => departmentMutation.mutate()}
                >
                  {departmentMutation.isPending && <LoaderCircle className="size-4 animate-spin" />}
                  Enroll {selectedDepartmentIds.length > 1 ? "departments" : "department"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {departmentsQuery.data?.length
                  ? "All departments are already assigned to this course."
                  : "No active departments available."}
              </p>
            )
          ) : (
            <div className="space-y-3">
              <Input
                aria-label="Search students"
                placeholder="Search students by name or email"
                value={studentSearch}
                onChange={(event) => {
                  setStudentSearch(event.target.value);
                  setStudentPage(0);
                }}
              />
              {studentsQuery.isLoading ? (
                <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" /> Loading students...
                </p>
              ) : studentsQuery.isError ? (
                <div role="alert" className="space-y-2">
                  <p className="text-sm text-destructive">
                    {studentsQuery.error instanceof Error
                      ? studentsQuery.error.message
                      : "Could not load students."}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => void studentsQuery.refetch()}>
                    Try again
                  </Button>
                </div>
              ) : studentsQuery.data?.content.length ? (
                <>
                  <StudentCheckboxList
                    students={studentsQuery.data.content}
                    selected={selectedStudents}
                    onChange={setSelectedStudents}
                    disabled={isPending}
                  />
                  {studentsQuery.data.totalPages > 1 && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Page {studentPage + 1} of {studentsQuery.data.totalPages}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={studentPage === 0}
                          onClick={() => {
                            setStudentPage((page) => page - 1);
                          }}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={studentPage >= studentsQuery.data.totalPages - 1}
                          onClick={() => {
                            setStudentPage((page) => page + 1);
                          }}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                  {selectedStudents.length > 0 && (
                    <Button
                      className="w-full"
                      disabled={isPending}
                      onClick={() => studentMutation.mutate()}
                    >
                      {studentMutation.isPending && <LoaderCircle className="size-4 animate-spin" />}
                      Enroll {selectedStudents.length} student{selectedStudents.length === 1 ? "" : "s"}
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {studentSearch.trim()
                    ? "No students match this search."
                    : "No active students available."}
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function memberName(member: DepartmentMember) {
  return [member.firstName, member.lastName].filter(Boolean).join(" ");
}

function BatchResultView({
  result,
  onAssignMore,
  onClose,
}: {
  result: DepartmentBatchEnrollmentResult;
  onAssignMore: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-green-600/30 bg-green-50 p-3 text-sm dark:bg-green-950/20">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
        <div>
          <p className="font-medium">
            {result.totalNewEnrollments} student{result.totalNewEnrollments === 1 ? "" : "s"} enrolled in{" "}
            {result.courseName}
          </p>
          {result.totalAlreadyEnrolled > 0 && (
            <p className="text-muted-foreground">
              {result.totalAlreadyEnrolled} were already enrolled and skipped.
            </p>
          )}
        </div>
      </div>

      <div className="max-h-80 space-y-3 overflow-y-auto">
        {result.departments.map((department) => (
          <div key={department.departmentId} className="rounded-md border">
            <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2 text-sm">
              <span className="min-w-0 truncate font-medium">{department.departmentName}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {department.newEnrollments} enrolled · {department.alreadyEnrolled} already ·{" "}
                {department.excludedCount} unticked
              </span>
            </div>
            <ul className="divide-y text-sm">
              {department.newMembers.map((member) => (
                <li key={`new-${member.id}`} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate">
                    {memberName(member)} ({member.email})
                  </span>
                  <Badge className="shrink-0 bg-green-600 text-[10px] text-white">Enrolled</Badge>
                </li>
              ))}
              {department.alreadyEnrolledMembers.map((member) => (
                <li key={`already-${member.id}`} className="flex items-center gap-2 px-3 py-1.5 text-muted-foreground">
                  <span className="min-w-0 flex-1 truncate">
                    {memberName(member)} ({member.email})
                  </span>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">Already enrolled</Badge>
                </li>
              ))}
              {department.excludedMembers.map((member) => (
                <li key={`excluded-${member.id}`} className="flex items-center gap-2 px-3 py-1.5 text-muted-foreground">
                  <span className="min-w-0 flex-1 truncate line-through">
                    {memberName(member)} ({member.email})
                  </span>
                  <Badge variant="outline" className="shrink-0 text-[10px]">Not selected</Badge>
                </li>
              ))}
              {department.studentCount === 0 && (
                <li className="px-3 py-2 text-muted-foreground">No active students.</li>
              )}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onAssignMore}>
          Assign more
        </Button>
        <Button className="flex-1" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
