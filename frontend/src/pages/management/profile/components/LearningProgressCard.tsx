import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Play, Award, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InProgressCourse {
  id: string;
  title: string;
  skill: string;
  lastAccessed: string;
  progress: number;
}

interface CompletedCourse {
  id: string;
  title: string;
  skill: string;
  completedDate: string;
  score: number;
}

// Legacy component stays reusable, but receives actual records from its caller.
export const LearningProgressCard: React.FC<{
  inProgressCourses?: InProgressCourse[];
  completedCourses?: CompletedCourse[];
}> = ({ inProgressCourses: IN_PROGRESS_COURSES = [], completedCourses: COMPLETED_COURSES = [] }) => {
  const [activeTab, setActiveTab] = useState<"in_progress" | "completed">("in_progress");

  return (
    <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#262626] shadow-xs p-6 transition-all">
      {/* 1. Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-200 dark:border-[#262626] mb-5">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            Learning Progress
          </h3>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
            Quick summary of your current and completed courses.
          </p>
        </div>

        <Link
          to="/courses"
          className="inline-flex items-center gap-1.5 text-xs text-[#3b82f6] hover:text-blue-400 font-medium transition-colors self-start sm:self-auto"
        >
          <span>View All Courses</span>
          <ExternalLink className="size-3" />
        </Link>
      </div>

      {/* 2. Interactive Sub-tabs (Filter Pills) */}
      <div className="flex items-center gap-2 mb-4 p-1 bg-gray-50 dark:bg-[#1a1a1a] rounded-lg w-fit border border-[#262626]">
        <button
          type="button"
          onClick={() => setActiveTab("in_progress")}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "in_progress"
              ? "bg-[#2563eb] text-gray-900 dark:text-white shadow-xs"
              : "text-gray-500 dark:text-neutral-400 hover:text-neutral-200"
          }`}
        >
          In Progress ({IN_PROGRESS_COURSES.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("completed")}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "completed"
              ? "bg-[#2563eb] text-gray-900 dark:text-white shadow-xs"
              : "text-gray-500 dark:text-neutral-400 hover:text-neutral-200"
          }`}
        >
          Completed ({COMPLETED_COURSES.length})
        </button>
      </div>

      {/* 3. Course List */}
      <div className="space-y-3">
        {activeTab === "in_progress" ? (
          IN_PROGRESS_COURSES.map((course) => (
            <div
              key={course.id}
              className="bg-[#1c1c1c] border border-[#262626] rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-[#383838]"
            >
              {/* Left: Course Title, Skill badge, last accessed */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-full">
                    {course.title}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#1e3a8a]/30 text-[#60a5fa] border border-[#1e3a8a]/50">
                    {course.skill}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-neutral-400">
                  Last accessed: {course.lastAccessed}
                </p>
              </div>

              {/* Middle/Right: Progress bar with % */}
              <div className="w-full md:w-56 shrink-0 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-neutral-400">Progress</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{course.progress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#262626] overflow-hidden">
                  <div
                    className="h-full bg-[#2563eb] rounded-full transition-all duration-300"
                    style={{ width: `${course.progress}%` }}
                  />
                </div>
              </div>

              {/* Far Right Action */}
              <div className="shrink-0 flex items-center md:self-center">
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs bg-transparent border-neutral-700 text-neutral-200 hover:bg-neutral-800 hover:text-gray-900 dark:text-white cursor-pointer"
                >
                  <Link to={`/courses`} className="inline-flex items-center gap-1.5">
                    <Play className="size-3 fill-current" />
                    <span>Continue</span>
                  </Link>
                </Button>
              </div>
            </div>
          ))
        ) : (
          COMPLETED_COURSES.map((course) => (
            <div
              key={course.id}
              className="bg-[#1c1c1c] border border-[#262626] rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-[#383838]"
            >
              {/* Left: Course Title, Skill badge, completion date */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-full">
                    {course.title}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#1e3a8a]/30 text-[#60a5fa] border border-[#1e3a8a]/50">
                    {course.skill}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-neutral-400">
                  {course.completedDate}
                </p>
              </div>

              {/* Middle/Right: Final Score & Completed badge */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-semibold text-neutral-300">
                  Score: {course.score}/100
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                  <span className="size-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block" />
                  Completed
                </span>
              </div>

              {/* Far Right Action */}
              <div className="shrink-0 flex items-center md:self-center">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs bg-transparent border-neutral-700 text-neutral-200 hover:bg-neutral-800 hover:text-gray-900 dark:text-white cursor-pointer"
                  onClick={() => alert(`Certificate for "${course.title}"`)}
                >
                  <Award className="size-3.5 mr-1.5 text-amber-400" />
                  <span>Certificate</span>
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
