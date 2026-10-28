import { departmentApi, enrollmentApi } from "@/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StudentCheckboxList } from "@/pages/student/StudentCheckboxList";
import type { CatalogCourse, DepartmentMember } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, UserRound, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type EnrollmentTarget = "department" | "student";

export function CourseEnrollmentAssignmentDialog({
  course,
}: {
  course: CatalogCourse;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<EnrollmentTarget>("department");
  const [departmentId, setDepartmentId] = useState("");
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

  const studentsQuery = useQuery({
    queryKey: ["course-assignment-students", studentSearch, studentPage],
    enabled: open && target === "student",
    queryFn: () => enrollmentApi.searchStudents(studentPage, studentSearch.trim()),
  });

  const previewQuery = useQuery({
    queryKey: ["course-assignment-preview", course.id, departmentId],
    enabled: open && target === "department" && Boolean(departmentId),
    queryFn: () =>
      enrollmentApi.previewDepartment({
        departmentId: Number(departmentId),
        courseId: course.id,
      }),
  });

  const refreshCourseData = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["department-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["course-catalog"] }),
      queryClient.invalidateQueries({ queryKey: ["course-detail"] }),
    ]);

  const departmentMutation = useMutation({
    mutationFn: () =>
      enrollmentApi.enrollDepartment({
        departmentId: Number(departmentId),
        courseId: course.id,
      }),
    onSuccess: async (result) => {
      toast.success(
        `${result.newEnrollments} student${result.newEnrollments === 1 ? "" : "s"} enrolled in ${result.courseName}.`,
      );
      await refreshCourseData();
      setOpen(false);
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

  const selectedDepartment = departmentsQuery.data?.find(
    (department) => String(department.id) === departmentId,
  );
  const isPending = departmentMutation.isPending || studentMutation.isPending;

  const resetForm = () => {
    setTarget("department");
    setDepartmentId("");
    setSelectedStudents([]);
    setStudentSearch("");
    setStudentPage(0);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enroll in {course.name}</DialogTitle>
          <DialogDescription>
            Choose a department to enroll all its active students, or choose one student.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Select
            value={target}
            onValueChange={(value) => {
              if (value !== "department" && value !== "student") return;
              setTarget(value);
              setDepartmentId("");
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
            departmentsQuery.isLoading ? (
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
            ) : departmentsQuery.data?.length ? (
              <div className="space-y-3">
                <Select
                  value={departmentId}
                  onValueChange={setDepartmentId}
                  disabled={isPending}
                >
                  <SelectTrigger aria-label="Department" className="w-full">
                    <SelectValue placeholder="Choose a department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentsQuery.data.map((department) => (
                      <SelectItem key={department.id} value={String(department.id)}>
                        {department.name || department.code || `Department ${department.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {departmentId && previewQuery.isLoading && (
                  <p role="status" className="text-sm text-muted-foreground">
                    Checking department enrollment...
                  </p>
                )}
                {departmentId && previewQuery.isError && (
                  <p role="alert" className="text-sm text-destructive">
                    {previewQuery.error instanceof Error
                      ? previewQuery.error.message
                      : "Could not check department enrollment."}
                  </p>
                )}
                {previewQuery.data && (
                  <div className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{selectedDepartment?.name}</p>
                    <p className="mt-1 text-muted-foreground">
                      {previewQuery.data.newEnrollments} of {previewQuery.data.studentCount} active
                      students will be enrolled.
                    </p>
                  </div>
                )}
                <Button
                  className="w-full"
                  disabled={
                    !previewQuery.data
                    || previewQuery.data.newEnrollments === 0
                    || previewQuery.isError
                    || isPending
                  }
                  onClick={() => departmentMutation.mutate()}
                >
                  {departmentMutation.isPending && <LoaderCircle className="size-4 animate-spin" />}
                  Enroll department
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active departments available.</p>
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
