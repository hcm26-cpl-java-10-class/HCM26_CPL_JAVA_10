import { departmentApi, enrollmentApi } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Enrollment } from "@/types";
import { useQueries, useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarDays, GraduationCap, UserRound } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { EnrollmentProgressBar } from "../management/demo/progress/EnrollmentProgressBar";
import type { DepartmentMember } from "@/types";
import { useAdminStudentPreview } from "./useAdminStudentPreview";
import { StudentCheckboxList, studentFullName } from "./StudentCheckboxList";

const formatEnrollmentDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN");
};

function CourseCards({ enrollments }: { enrollments: Enrollment[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {enrollments.map((enrollment) => (
        <article key={enrollment.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="h-40 overflow-hidden bg-gradient-to-br from-blue-100 via-indigo-100 to-violet-100">
            {enrollment.thumbnailUrl ? (
              <img src={enrollment.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <GraduationCap className="size-16 text-blue-900/25" />
              </div>
            )}
          </div>
          <div className="space-y-4 p-5">
            <div>
              <h3 className="line-clamp-2 min-h-12 text-lg font-semibold">{enrollment.courseName}</h3>
              {enrollment.instructor && (
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <UserRound className="size-4" /> {enrollment.instructor}
                </p>
              )}
            </div>
            {enrollment.enrolledAt && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="size-4" />
                Enrolled {formatEnrollmentDate(enrollment.enrolledAt)}
              </p>
            )}
            <EnrollmentProgressBar enrollmentId={enrollment.id} />
            <Button asChild className="w-full">
              <Link to={`/enrollments/${enrollment.id}/learn`}>
                <BookOpen className="size-4" /> Continue learning
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function AdminDepartmentStudentCourses() {
  const isAdminStudentPreview = useAdminStudentPreview();
  const [selectionMode, setSelectionMode] = useState<"student" | "department">("student");
  const [departmentId, setDepartmentId] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<DepartmentMember[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentPage, setStudentPage] = useState(0);

  const departmentsQuery = useQuery({
    queryKey: ["admin-student-preview-departments"],
    queryFn: () => departmentApi.getPage({ page: 0, size: 100, sort: "name,asc" }),
    enabled: isAdminStudentPreview,
  });

  const studentsQuery = useQuery({
    queryKey: ["admin-student-preview-members", departmentId, studentPage],
    queryFn: () => departmentApi.getMembers(Number(departmentId), studentPage, ""),
    enabled: isAdminStudentPreview && selectionMode === "department" && Boolean(departmentId),
  });

  const allStudentsQuery = useQuery({
    queryKey: ["admin-student-preview-students", studentSearch, studentPage],
    queryFn: () => enrollmentApi.searchStudents(studentPage, studentSearch.trim()),
    enabled: isAdminStudentPreview && selectionMode === "student",
  });

  const coursesQueries = useQueries({
    queries: selectedStudents.map((student) => ({
      queryKey: ["admin-student-preview-courses", selectionMode, departmentId, student.id],
      queryFn: () =>
        selectionMode === "department"
          ? enrollmentApi.getDepartmentStudentCourses(Number(departmentId), student.id)
          : enrollmentApi.getStudentCourses(student.id),
      enabled: isAdminStudentPreview && (selectionMode === "student" || Boolean(departmentId)),
    })),
  });

  if (!isAdminStudentPreview) {
    return null;
  }

  const departments = departmentsQuery.data?.content ?? [];
  const studentPageResult =
    selectionMode === "department" ? studentsQuery.data : allStudentsQuery.data;
  const students = studentPageResult?.content ?? [];
  const studentQuery = selectionMode === "department" ? studentsQuery : allStudentsQuery;

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">View a student&apos;s courses</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose any student directly, or select a department and one of its students.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-5">
        <label className="block space-y-2 text-sm font-medium">
          Enrollment target
          <Select
            value={selectionMode}
            onValueChange={(value) => {
              if (value !== "student" && value !== "department") return;
              setSelectionMode(value);
              setDepartmentId("");
              setSelectedStudents([]);
              setStudentSearch("");
              setStudentPage(0);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Choose a student</SelectItem>
              <SelectItem value="department">Choose a department, then a student</SelectItem>
            </SelectContent>
          </Select>
        </label>

        {selectionMode === "department" && (
          <label className="block space-y-2 text-sm font-medium">
            Department
            <Select
              value={departmentId}
              onValueChange={(value) => {
                setDepartmentId(value);
                setSelectedStudents([]);
                setStudentPage(0);
              }}
              disabled={departmentsQuery.isLoading || departmentsQuery.isError}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a department" />
              </SelectTrigger>
              <SelectContent>
                {departments.filter((department) => department.id !== undefined).map((department) => (
                  <SelectItem key={department.id} value={String(department.id)}>
                    {department.name || department.code || `Department ${department.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {departmentsQuery.isLoading && (
              <span className="text-xs text-muted-foreground">Loading departments...</span>
            )}
            {departmentsQuery.isError && (
              <span role="alert" className="block text-xs text-destructive">
                Could not load departments: {departmentsQuery.error instanceof Error
                  ? departmentsQuery.error.message
                  : "Unknown error"}
              </span>
            )}
          </label>
        )}

        {selectionMode === "student" && (
          <Input
            aria-label="Search students"
            placeholder="Search students by name or email"
            value={studentSearch}
            onChange={(event) => {
              setStudentSearch(event.target.value);
              setStudentPage(0);
            }}
          />
        )}

        <div className="block space-y-2 text-sm font-medium">
          Student
          <StudentCheckboxList
            students={students}
            selected={selectedStudents}
            onChange={setSelectedStudents}
            disabled={
              (selectionMode === "department" && !departmentId)
              || studentQuery.isLoading
              || studentQuery.isError
            }
            showDepartment={selectionMode === "student"}
          />
          {studentQuery.isLoading && <span className="text-xs text-muted-foreground">Loading students...</span>}
          {studentQuery.isError && (
            <span role="alert" className="block text-xs text-destructive">
              Could not load students: {studentQuery.error instanceof Error
                ? studentQuery.error.message
                : "Unknown error"}
            </span>
          )}
          {studentPageResult && studentPageResult.totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Page {studentPage + 1} of {studentPageResult.totalPages}</span>
              <span className="flex gap-2">
                <button
                  type="button"
                  className="underline disabled:opacity-50"
                  disabled={studentPage === 0}
                  onClick={() => {
                    setStudentPage((page) => page - 1);
                  }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="underline disabled:opacity-50"
                  disabled={studentPage >= studentPageResult.totalPages - 1}
                  onClick={() => {
                    setStudentPage((page) => page + 1);
                  }}
                >
                  Next
                </button>
              </span>
            </div>
          )}
        </div>
      </div>

      {selectionMode === "department" && departmentId && studentsQuery.data?.totalElements === 0 && (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No active students belong to this department.
        </p>
      )}
      {selectionMode === "student" && allStudentsQuery.data?.totalElements === 0 && (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {studentSearch.trim() ? "No students match this search." : "No active students are available."}
        </p>
      )}
      {selectedStudents.map((student, index) => {
        const query = coursesQueries[index];
        return (
          <div key={student.id} className="space-y-4">
            <div>
              <h3 className="font-semibold">{studentFullName(student)}&apos;s courses</h3>
              {query?.data && (
                <p className="text-sm text-muted-foreground">{query.data.length} enrolled courses</p>
              )}
            </div>
            {query?.isLoading && (
              <p role="status" className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
                Loading student courses...
              </p>
            )}
            {query?.isError && (
              <p role="alert" className="rounded-xl border border-destructive/30 p-5 text-sm text-destructive">
                Could not load student courses: {query.error instanceof Error
                  ? query.error.message
                  : "Unknown error"}
              </p>
            )}
            {query?.data && (
              query.data.length ? (
                <CourseCards enrollments={query.data} />
              ) : (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  This student has no enrolled courses.
                </p>
              )
            )}
          </div>
        );
      })}
    </section>
  );
}
