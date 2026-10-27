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
    <div className="bg-[#141414] dark:bg-[#141414] rounded-xl border border-[#262626] dark:border-[#262626] p-5 sm:p-6 transition-all hover:border-[#383838] shadow-sm">
      {/* 1. Header: Provider & Category Badges */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="size-6 rounded bg-[#1e293b] border border-[#334155] flex items-center justify-center text-[10px] font-bold text-blue-400 select-none">
            {course.provider.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-xs font-medium text-neutral-400">
            {course.provider}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#1e3a8a]/30 text-[#60a5fa] border border-[#1e3a8a]/50">
            {course.skill}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md"
                aria-label="Course options"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-[#1a1a1a] border-[#2e2e2e] text-neutral-200">
              <DropdownMenuItem asChild className="cursor-pointer hover:bg-neutral-800 focus:bg-neutral-800">
                <Link to="/courses">View Syllabus</Link>
              </DropdownMenuItem>
              {isSaved && onRemoveBookmark && (
                <DropdownMenuItem
                  onClick={() => onRemoveBookmark(course.id)}
                  className="cursor-pointer text-red-400 hover:text-red-300 hover:bg-neutral-800 focus:bg-neutral-800"
                >
                  Remove Bookmark
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 2. Course Title */}
      <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug mb-2">
        {course.title}
      </h3>

      {/* 3. Progress / Meta Info Subline */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-neutral-400 mb-3.5">
        <span className="font-medium text-neutral-300">Course</span>
        <span>•</span>
        {isInProgress && (
          <>
            <span className="font-semibold text-blue-400">{course.progress}% complete</span>
            {course.estimatedCompletion && (
              <>
                <span>•</span>
                <span>Est. completion: {course.estimatedCompletion}</span>
              </>
            )}
            {course.lastAccessed && (
              <>
                <span>•</span>
                <span>Last accessed: {course.lastAccessed}</span>
              </>
            )}
          </>
        )}

        {isCompleted && (
          <>
            <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
              <CheckCircle2 className="size-3.5" />
              Completed {course.completedDate ? `on ${course.completedDate}` : ""}
            </span>
            {course.score && (
              <>
                <span>•</span>
                <span className="text-neutral-300 font-semibold">Grade: {course.score}%</span>
              </>
            )}
          </>
        )}

        {isSaved && (
          <span className="inline-flex items-center gap-1 text-neutral-300">
            <Bookmark className="size-3 text-blue-400" />
            Saved for later
          </span>
        )}
      </div>

      {/* 4. Progress Bar (For In-Progress Courses) */}
      {isInProgress && (
        <div className="w-full h-1.5 rounded-full bg-[#262626] overflow-hidden mb-5">
          <div
            className="h-full bg-[#2563eb] rounded-full transition-all duration-300"
            style={{ width: `${course.progress}%` }}
          />
        </div>
      )}

      {/* 5. Coursera-Style Inner Module / Next Item Card */}
      {isInProgress && course.nextItem && (
        <div className="bg-[#1a1a1a] border border-[#262626] rounded-lg p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-start gap-3 min-w-0">
            <div className="size-8 rounded-lg bg-[#222736] border border-[#2e374d] flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-200 truncate">
                {course.nextItem.title}
              </p>
              <p className="text-xs text-neutral-400 mt-0.5">
                {course.nextItem.duration}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <Button
              asChild
              size="sm"
              className="bg-[#2563eb] hover:bg-blue-600 text-white font-semibold text-xs px-4 h-9 shadow-sm cursor-pointer"
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
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#262626]">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 text-xs px-2.5 py-0.5"
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
                className="h-8 px-3 text-xs bg-transparent border-neutral-700 text-amber-300 hover:text-amber-200 hover:bg-neutral-800 cursor-pointer"
              >
                <Award className="size-3.5 mr-1.5 text-amber-400" />
                <span>View Certificate</span>
              </Button>
            )}

            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs bg-transparent border-neutral-700 text-neutral-200 hover:bg-neutral-800 hover:text-white cursor-pointer"
            >
              <Link to="/courses">Review Course</Link>
            </Button>
          </div>
        </div>
      )}

      {/* 7. Saved Course Actions */}
      {isSaved && (
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#262626]">
          <span className="text-xs text-neutral-400">Ready to start this curriculum?</span>
          <div className="flex items-center gap-2">
            {onRemoveBookmark && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRemoveBookmark(course.id)}
                className="h-8 px-2.5 text-xs text-neutral-400 hover:text-neutral-200"
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
