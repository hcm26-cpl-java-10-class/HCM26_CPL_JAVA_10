import { memo } from "react";
import { BarChart3, BookOpen, GraduationCap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CourseReportItem } from "@/types";

type Props = {
  courses: CourseReportItem[];
  selectedCourseId: number | null;
  onSelect: (courseId: number) => void;
};

/**
 * Lưới card chọn khóa học cho trang Course Analytics.
 *
 * <p>Nguyên tắc:
 * <ul>
 *   <li>4 card bằng nhau: cùng kích thước ảnh, chiều cao và cách trình bày.</li>
 *   <li>Không ưu tiên khóa học nào (không Popular/Featured).</li>
 *   <li>Thông tin đồng nhất: tên, danh mục, số học viên, số bài học.</li>
 *   <li>Nhấn vào card HOẶC nút "Analyze course" đều mở phân tích khóa học đó.</li>
 *   <li>Tự co giãn: rộng 4 cột, vừa 2 cột, mobile 1 cột.</li>
 * </ul>
 */
function AnalyticsCourseGridImpl({
  courses,
  selectedCourseId,
  onSelect,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {courses.map((course) => (
        <AnalyticsCourseCard
          key={course.courseId}
          course={course}
          selected={selectedCourseId === course.courseId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export const AnalyticsCourseGrid = memo(AnalyticsCourseGridImpl);

function AnalyticsCourseCard({
  course,
  selected,
  onSelect,
}: {
  course: CourseReportItem;
  selected: boolean;
  onSelect: (courseId: number) => void;
}) {
  const category = course.categories?.[0] ?? "Course";
  const learners = course.studentCount ?? 0;
  const lessons = course.lessonCount ?? 0;

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Analyze course ${course.courseName}`}
      onClick={() => onSelect(course.courseId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(course.courseId);
        }
      }}
      className={`group flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        selected ? "border-primary ring-2 ring-primary/30" : ""
      }`}
    >
      {/* Ảnh bìa — cùng chiều cao ở mọi card */}
      <div className="relative h-36 shrink-0 overflow-hidden bg-gradient-to-br from-blue-100 via-indigo-100 to-violet-100">
        {course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <GraduationCap className="size-12 text-blue-900/25" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-slate-800 shadow-sm">
          {category}
        </span>
      </div>

      {/* Nội dung — chiều cao đồng nhất giữa các card */}
      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
        <h3 className="line-clamp-2 min-h-12 text-base font-semibold leading-6">
          {course.courseName}
        </h3>
        <p className="truncate text-xs text-muted-foreground">
          {course.instructor || "Course instructor"}
        </p>

        <dl className="mt-1 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="size-3.5 shrink-0" />
            <dd className="truncate">{learners} learners</dd>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <BookOpen className="size-3.5 shrink-0" />
            <dd className="truncate">{lessons} lessons</dd>
          </div>
        </dl>

        <div className="mt-auto pt-2">
          <Button
            type="button"
            variant={selected ? "default" : "outline"}
            className="w-full"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(course.courseId);
            }}
          >
            <BarChart3 className="size-4" />
            Analyze course
          </Button>

          {/* Dòng gợi ý chỉ hiện khi rê chuột — hiệu ứng nhẹ */}
          <p className="mt-1.5 flex items-center justify-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            View course analytics
            <span aria-hidden="true">→</span>
          </p>
        </div>
      </div>
    </article>
  );
}
