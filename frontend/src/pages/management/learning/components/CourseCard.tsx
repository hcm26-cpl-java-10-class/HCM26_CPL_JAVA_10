import React from "react";
import { Link } from "react-router-dom";
import {
  Play,
  Award,
  MoreVertical,
  CheckCircle2,
  Bookmark,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LearningCourse } from "../learning.types";

interface CourseCardProps {
  course: LearningCourse;
  onViewCertificate?: (course: LearningCourse) => void;
  onRemoveBookmark?: (courseId: string) => void;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  onViewCertificate,
  onRemoveBookmark,
}) => {
  const isCompleted = course.status === "completed";
  const isSaved = course.status === "saved";
  const isInProgress = course.status === "in_progress";

  return (
    <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#262626] p-5 sm:p-6 transition-all hover:border-gray-300 dark:hover:border-[#383838] shadow-xs">
      {/* 1. Header: Provider & Category Badges */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="size-6 rounded bg-blue-50 dark:bg-[#1e293b] border border-blue-200 dark:border-[#334155] flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-400 select-none">
            {course.provider.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-xs font-medium text-gray-500 dark:text-neutral-400">
            {course.provider}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-[#1e3a8a]/30 dark:text-[#60a5fa] dark:border-[#1e3a8a]/50">
            {course.skill}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800 rounded-md"
                aria-label="Course options"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-white border-gray-200 text-gray-700 dark:bg-[#1a1a1a] dark:border-[#2e2e2e] dark:text-neutral-200 shadow-md">
              <DropdownMenuItem asChild className="cursor-pointer hover:bg-gray-50 focus:bg-gray-50 dark:hover:bg-neutral-800 dark:focus:bg-neutral-800">
                <Link to="/courses">View Syllabus</Link>
              </DropdownMenuItem>
              {isSaved && onRemoveBookmark && (
                <DropdownMenuItem
                  onClick={() => onRemoveBookmark(course.id)}
                  className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-neutral-800 focus:bg-red-50 dark:focus:bg-neutral-800"
                >
                  Remove Bookmark
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 2. Course Title */}
      <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight leading-snug mb-2">
        {course.title}
      </h3>

      {/* 3. Progress / Meta Info Subline */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-gray-500 dark:text-neutral-400 mb-3.5">
        <span className="font-medium text-gray-700 dark:text-neutral-300">Course</span>
        <span className="text-gray-300 dark:text-neutral-600">•</span>
        {isInProgress && (
          <>
            <span className="font-semibold text-blue-600 dark:text-blue-400">{course.progress}% complete</span>
            {course.estimatedCompletion && (
              <>
                <span className="text-gray-300 dark:text-neutral-600">•</span>
                <span>Est. completion: {course.estimatedCompletion}</span>
              </>
            )}
            {course.lastAccessed && (
              <>
                <span className="text-gray-300 dark:text-neutral-600">•</span>
                <span>Last accessed: {course.lastAccessed}</span>
              </>
            )}
          </>
        )}

        {isCompleted && (
          <>
            <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" />
              Completed {course.completedDate ? `on ${course.completedDate}` : ""}
            </span>
            {course.score && (
              <>
                <span className="text-gray-300 dark:text-neutral-600">•</span>
                <span className="text-gray-700 dark:text-neutral-300 font-semibold">Grade: {course.score}%</span>
              </>
            )}
          </>
        )}

        {isSaved && (
          <span className="inline-flex items-center gap-1 text-gray-700 dark:text-neutral-300">
            <Bookmark className="size-3 text-blue-600 dark:text-blue-400" />
            Saved for later
          </span>
        )}
      </div>

      {/* 4. Progress Bar (For In-Progress Courses) */}
      {isInProgress && (
        <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-[#262626] overflow-hidden mb-5">
          <div
            className="h-full bg-[#2563eb] rounded-full transition-all duration-300"
            style={{ width: `${course.progress}%` }}
          />
        </div>
      )}

      {/* 5. Coursera-Style Inner Module / Next Item Card */}
      {isInProgress && course.nextItem && (
        <div className="bg-[#F9FAFB] dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#262626] rounded-lg p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-start gap-3 min-w-0">
            <div className="size-8 rounded-lg bg-blue-50 dark:bg-[#222736] border border-blue-100 dark:border-[#2e374d] flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-neutral-200 truncate">
                {course.nextItem.title}
              </p>
              <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                {course.nextItem.duration}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <Button
              asChild
              size="sm"
              className="bg-[#2563eb] hover:bg-blue-600 text-white font-semibold text-xs px-4 h-9 shadow-xs cursor-pointer"
            >
              <Link to="/courses" className="inline-flex items-center gap-1.5">
                <Play className="size-3 fill-current" />
                <span>Continue Learning</span>
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* 6. Completed Course Actions */}
      {isCompleted && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-[#262626]">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/60 text-xs px-2.5 py-0.5 font-medium"
            >
              <span className="size-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block" />
              100% Completed
            </Badge>
          </div>

          <div className="flex items-center gap-2.5">
            {course.certificate && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onViewCertificate?.(course)}
                className="h-8 px-3 text-xs bg-amber-50/60 dark:bg-transparent border-amber-300 dark:border-neutral-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100/60 dark:hover:bg-neutral-800 cursor-pointer font-medium"
              >
                <Award className="size-3.5 mr-1.5 text-amber-600 dark:text-amber-400" />
                <span>View Certificate</span>
              </Button>
            )}

            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs bg-white dark:bg-transparent border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-white cursor-pointer font-medium"
            >
              <Link to="/courses">Review Course</Link>
            </Button>
          </div>
        </div>
      )}

      {/* 7. Saved Course Actions */}
      {isSaved && (
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-[#262626]">
          <span className="text-xs text-gray-500 dark:text-neutral-400">Ready to start this curriculum?</span>
          <div className="flex items-center gap-2">
            {onRemoveBookmark && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRemoveBookmark(course.id)}
                className="h-8 px-2.5 text-xs text-gray-500 hover:text-gray-800 dark:text-neutral-400 dark:hover:text-neutral-200"
              >
                Remove
              </Button>
            )}
            <Button
              asChild
              size="sm"
              className="h-8 px-3 text-xs bg-[#2563eb] hover:bg-blue-600 text-white font-medium"
            >
              <Link to="/courses">Enroll Now</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
