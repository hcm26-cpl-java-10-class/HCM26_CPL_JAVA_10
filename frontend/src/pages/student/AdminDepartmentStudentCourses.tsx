import { departmentApi, enrollmentApi } from "@/api";
import { Button } from "@/components/ui/button";
import type { Enrollment } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarDays, GraduationCap, UserRound } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { EnrollmentProgressBar } from "../management/demo/progress/EnrollmentProgressBar";
import { useAdminStudentPreview } from "./useAdminStudentPreview";

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
  const [departmentId, setDepartmentId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentPage, setStudentPage] = useState(0);

  const departmentsQuery = useQuery({
    queryKey: ["admin-student-preview-departments"],
    queryFn: () => departmentApi.getPage({ page: 0, size: 100, sort: "name,asc" }),
    enabled: isAdminStudentPreview,
  });

  const studentsQuery = useQuery({
    queryKey: ["admin-student-preview-members", departmentId, studentPage],
    queryFn: () => departmentApi.getMembers(Number(departmentId), studentPage, ""),
    enabled: isAdminStudentPreview && Boolean(departmentId),
  });

  const coursesQuery = useQuery({
    queryKey: ["admin-student-preview-courses", departmentId, studentId],
    queryFn: () => enrollmentApi.getDepartmentStudentCourses(Number(departmentId), Number(studentId)),
    enabled: isAdminStudentPreview && Boolean(departmentId) && Boolean(studentId),
  });

  if (!isAdminStudentPreview) {
    return null;
  }

  const departments = departmentsQuery.data?.content ?? [];
  const students = studentsQuery.data?.content ?? [];
  const selectedStudent = students.find((student) => String(student.id) === studentId);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">View a student&apos;s courses</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a department and student to see the courses assigned to that account.
        </p>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          Department
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={departmentId}
            onChange={(event) => {
              setDepartmentId(event.target.value);
              setStudentId("");
              setStudentPage(0);
            }}
            disabled={departmentsQuery.isLoading || departmentsQuery.isError}
          >
            <option value="">Choose a department</option>
            {departments.filter((department) => department.id !== undefined).map((department) => (
              <option key={department.id} value={department.id}>
                {department.name || department.code || `Department ${department.id}`}
              </option>
            ))}
          </select>
          {departmentsQuery.isLoading && <span className="text-xs text-muted-foreground">Loading departments...</span>}
          {departmentsQuery.isError && (
            <span role="alert" className="block text-xs text-destructive">
              Could not load departments: {departmentsQuery.error instanceof Error
                ? departmentsQuery.error.message
                : "Unknown error"}
            </span>
          )}
          {!departmentsQuery.isLoading && !departmentsQuery.isError && departments.length === 0 && (
            <span className="block text-xs text-muted-foreground">No departments found.</span>
          )}
        </label>

        <label className="space-y-2 text-sm font-medium">
          Student
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            disabled={!departmentId || studentsQuery.isLoading || studentsQuery.isError}
          >
            <option value="">Choose a student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {[student.firstName, student.lastName].filter(Boolean).join(" ")} ({student.email})
              </option>
            ))}
          </select>
          {studentsQuery.isLoading && <span className="text-xs text-muted-foreground">Loading students...</span>}
          {studentsQuery.isError && (
            <span role="alert" className="block text-xs text-destructive">
              Could not load students: {studentsQuery.error instanceof Error
                ? studentsQuery.error.message
                : "Unknown error"}
            </span>
          )}
          {studentsQuery.data && studentsQuery.data.totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Page {studentPage + 1} of {studentsQuery.data.totalPages}</span>
              <span className="flex gap-2">
                <button
                  type="button"
                  className="underline disabled:opacity-50"
                  disabled={studentPage === 0}
                  onClick={() => {
                    setStudentId("");
                    setStudentPage((page) => page - 1);
                  }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="underline disabled:opacity-50"
                  disabled={studentPage >= studentsQuery.data.totalPages - 1}
                  onClick={() => {
                    setStudentId("");
                    setStudentPage((page) => page + 1);
                  }}
                >
                  Next
                </button>
              </span>
            </div>
          )}
        </label>
      </div>

      {departmentId && studentsQuery.data?.totalElements === 0 && (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No active students belong to this department.
        </p>
      )}
      {studentId && selectedStudent && coursesQuery.isLoading && (
        <p role="status" className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
          Loading student courses...
        </p>
      )}
      {studentId && coursesQuery.isError && (
        <p role="alert" className="rounded-xl border border-destructive/30 p-5 text-sm text-destructive">
          Could not load student courses: {coursesQuery.error instanceof Error
            ? coursesQuery.error.message
            : "Unknown error"}
        </p>
      )}
      {studentId && coursesQuery.data && (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">
              {[selectedStudent?.firstName, selectedStudent?.lastName].filter(Boolean).join(" ")}&apos;s courses
            </h3>
            <p className="text-sm text-muted-foreground">{coursesQuery.data.length} enrolled courses</p>
          </div>
          {coursesQuery.data.length ? (
            <CourseCards enrollments={coursesQuery.data} />
          ) : (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              This student has no enrolled courses.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
