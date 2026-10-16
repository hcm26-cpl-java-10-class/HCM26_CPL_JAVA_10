import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CatalogCourse } from "@/types";
import { CheckCircle2, Clock, GraduationCap, PlayCircle, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { LEVEL_BADGE_CLASS, LEVEL_LABEL, formatTotalDuration } from "../utils/course.utils.ts";

interface CourseCardProps {
  course: CatalogCourse;
  /** id enrollment của user cho khóa này (nếu đã ghi danh) — dùng cho nút Continue learning. */
  enrollmentId?: number;
  canEnroll: boolean;
  isEnrolling: boolean;
  onEnroll: (courseId: number) => void;
}

export function CourseCard({ course, enrollmentId, canEnroll, isEnrolling, onEnroll }: CourseCardProps) {
  const detailPath = `/courses/${course.id}`;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-lg">
      <Link to={detailPath} className="block" aria-label={`View ${course.name}`}>
        <div className="relative h-44 overflow-hidden bg-gradient-to-br from-blue-100 via-indigo-100 to-violet-100">
          {course.thumbnailUrl ? (
            <img
              src={course.thumbnailUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <GraduationCap className="size-14 text-blue-900/25" />
            </div>
          )}
          <Badge className="absolute left-3 top-3 bg-white/95 text-slate-800 hover:bg-white">
            {course.categoryName || "Course"}
          </Badge>
          {course.enrolled && (
            <Badge className="absolute right-3 top-3 bg-emerald-600 text-white hover:bg-emerald-600">
              <CheckCircle2 className="size-3" /> Enrolled
            </Badge>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <Link to={detailPath} className="hover:underline">
            <h3 className="line-clamp-2 min-h-12 text-lg font-semibold leading-6">
              {course.name || "Untitled course"}
            </h3>
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">{course.instructor || "Course instructor"}</p>
        </div>

        <p className="line-clamp-3 min-h-[3.75rem] text-sm leading-5 text-muted-foreground">
          {course.description || "Start learning with this instructor-led course."}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {course.level && (
            <Badge variant="secondary" className={LEVEL_BADGE_CLASS[course.level]}>
              {LEVEL_LABEL[course.level]}
            </Badge>
          )}
          <span className="inline-flex items-center gap-1">
            <BookOpen className="size-3.5" /> {course.lessonCount} lessons
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" /> {formatTotalDuration(course.totalDuration)}
          </span>
        </div>

        <div className="mt-auto flex gap-2 pt-2">
          {course.enrolled && enrollmentId !== undefined ? (
            <Button asChild className="flex-1">
              <Link to={`/enrollments/${enrollmentId}/learn`}>
                <PlayCircle className="size-4" /> Continue learning
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="outline" className="flex-1">
                <Link to={detailPath}>View details</Link>
              </Button>
              {!course.enrolled && canEnroll && (
                <Button className="flex-1" disabled={isEnrolling} onClick={() => onEnroll(course.id)}>
                  {isEnrolling ? "Enrolling..." : "Enroll"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export function CourseCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-hidden>
      <div className="h-44 animate-pulse bg-muted" />
      <div className="space-y-3 p-5">
        <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-14 animate-pulse rounded bg-muted" />
        <div className="h-9 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
