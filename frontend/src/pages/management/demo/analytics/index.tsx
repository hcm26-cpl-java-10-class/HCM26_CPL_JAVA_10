import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { BarChart3, ArrowLeft, GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnalyticsCourseGrid } from "@/pages/management/demo/analytics/components/AnalyticsCourseGrid";
import { AnalyticsHeader } from "@/pages/management/demo/analytics/components/AnalyticsHeader";
import { CourseAnalyticsTabs } from "@/pages/management/demo/analytics/components/CourseAnalyticsTabs";
import { CourseComparisonPanel } from "@/pages/management/demo/analytics/components/comparison/CourseComparisonPanel";
import { ExportExcelButton } from "@/pages/management/demo/analytics/components/ExportExcelButton";
import { courseAnalyticsApi } from "@/api/features/demo/course-analytics.api";
import { courseReportApi } from "@/api/features/demo/course-report.api";

export default function CourseAnalyticsPage() {
  const [courseId, setCourseId] = useState<number | null>(null);
  const [courseSelectionKey, setCourseSelectionKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  const handleCourseSelect = (id: number) => {
    setCourseId(id);
    // Chọn lại cùng một khóa học cũng phải phát lại animation.
    setCourseSelectionKey((current) => current + 1);
  };

  const { data: courses = [], isLoading: isLoadingCourses } = useQuery({
    queryKey: ["course-report"],
    queryFn: courseReportApi.getCourseEnrollmentReport,
  });
  const selectableCourses = useMemo(
    () => courses.filter((row) => row.courseId != null),
    [courses],
  );

  // Đã chọn khóa học -> đang xem phân tích: ẩn thanh tìm kiếm và lưới card.
  const isAnalysing = courseId != null;

  // Lọc theo tên khóa học hoặc tên giảng viên.
  const filteredCourses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return selectableCourses;
    return selectableCourses.filter((course) => {
      const name = course.courseName?.toLowerCase() ?? "";
      const instructor = course.instructor?.toLowerCase() ?? "";
      const categories = (course.categories ?? []).join(" ").toLowerCase();
      return (
        name.includes(term) ||
        instructor.includes(term) ||
        categories.includes(term)
      );
    });
  }, [selectableCourses, searchTerm]);

  // Thống kê tổng quan cho header.
  const totalLearners = useMemo(
    () =>
      selectableCourses.reduce(
        (sum, course) => sum + (course.studentCount ?? 0),
        0,
      ),
    [selectableCourses],
  );
  const avgCompletion = useMemo(() => {
    const withRate = selectableCourses.filter(
      (course) => typeof course.completionRate === "number",
    );
    if (!withRate.length) return 0;
    const sum = withRate.reduce(
      (acc, course) => acc + (course.completionRate ?? 0),
      0,
    );
    return sum / withRate.length;
  }, [selectableCourses]);

  return (
    <MainLayout pathName={{ analytics: "Analytics", courses: "Course Analytics" }}>
      <div className="space-y-4">
        <AnalyticsHeader
          eyebrow="Analytics Center"
          title="Course Analytics"
          subtitle="Select a course to explore its learning performance."
          stats={[
            { label: "Available courses", value: String(selectableCourses.length) },
            { label: "Total learners", value: totalLearners.toLocaleString("en-US") },
            { label: "Avg. completion", value: `${avgCompletion.toFixed(0)}%` },
          ]}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          filterChips={["All Courses"]}
          activeFilter="All Courses"
          trailingLabel={`${filteredCourses.length} courses available`}
          showToolbar={!isAnalysing}
          actions={
            courseId ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={() => setCourseId(null)}
                >
                  <ArrowLeft />
                  Change course
                </Button>
                <ExportExcelButton
                  label="Export All (Excel)"
                  successMessage="Exported all analytics into a multi-sheet Excel file."
                  size="default"
                  onExport={() => courseAnalyticsApi.exportAll(courseId)}
                />
              </>
            ) : null
          }
        />

        {/* Chọn khóa học bằng lưới card — không ưu tiên khóa học nào. */}
        {!isAnalysing ? (
          <section aria-label="Select a course to analyse">
            {isLoadingCourses ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="overflow-hidden rounded-2xl border bg-card shadow-sm"
                    aria-hidden
                  >
                    <div className="h-36 animate-pulse bg-muted" />
                    <div className="space-y-2 px-4 py-3">
                      <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                      <div className="h-9 w-full animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredCourses.length ? (
              <AnalyticsCourseGrid
                courses={filteredCourses}
                selectedCourseId={courseId}
                onSelect={handleCourseSelect}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card py-16 text-center">
                <BarChart3 className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {searchTerm.trim()
                    ? `No course matches "${searchTerm.trim()}".`
                    : "No courses available to analyse."}
                </p>
              </div>
            )}
          </section>
        ) : null}

        {/* Trang chính: so sánh giữa các khóa học qua từng module của Course Analytics. */}
        {!isAnalysing ? (
          <section aria-label="Course comparison" className="space-y-3">
            <div className="flex items-center gap-2">
              <GitCompareArrows className="size-5 text-primary" />
              <h2 className="text-lg font-semibold">Compare courses</h2>
              <span className="text-sm text-muted-foreground">
                Side-by-side comparison and evaluation across every analytics module
              </span>
            </div>
            <CourseComparisonPanel />
          </section>
        ) : (
          <CourseAnalyticsTabs
            key={`${courseId}-${courseSelectionKey}`}
            courseId={courseId}
          />
        )}
      </div>
    </MainLayout>
  );
}