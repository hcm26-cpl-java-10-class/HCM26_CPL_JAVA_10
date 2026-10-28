import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  GraduationCap,
  Play,
  CheckCircle2,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { enrollmentApi } from "@/api/features/demo/enrollment.api";
import {
  INITIAL_LEARNING_COURSES,
  mergeEnrollmentsWithCourses,
  calculateLearningSummary,
} from "../../learning/learning.data";

export const LearningOverviewCard: React.FC = () => {
  // Sync with actual enrollments
  const { data: backendEnrollments = [] } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: enrollmentApi.getMyCourses,
    retry: 1,
  });

  const summary = useMemo(() => {
    const all = mergeEnrollmentsWithCourses(INITIAL_LEARNING_COURSES, backendEnrollments);
    return calculateLearningSummary(all);
  }, [backendEnrollments]);

  return (
    <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#262626] shadow-xs p-6 transition-all hover:border-gray-300 dark:hover:border-[#383838]">
      {/* 1. Header with View My Learning link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-200 dark:border-[#262626] mb-5">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="size-4 text-blue-600 dark:text-blue-400" />
            <span>Learning Overview</span>
          </h3>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
            Snapshot of your current courses and achievements.
          </p>
        </div>

        <Link
          to="/my-learning"
          className="inline-flex items-center gap-1.5 text-xs text-[#2563eb] hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors self-start sm:self-auto group"
        >
          <span>View My Learning</span>
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* 2. Three Metric Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5">
        {/* Metric 1: In Progress */}
        <div className="bg-blue-50/50 dark:bg-[#1a1a1a] border border-blue-100 dark:border-[#262626] rounded-lg p-3.5 flex items-center gap-3">
          <div className="size-9 rounded-lg bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center text-blue-700 dark:text-blue-400 shrink-0">
            <Play className="size-4 fill-current" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{summary.inProgressCount}</p>
            <p className="text-[11px] text-gray-500 dark:text-neutral-400 font-medium">In Progress</p>
          </div>
        </div>

        {/* Metric 2: Completed */}
        <div className="bg-emerald-50/50 dark:bg-[#1a1a1a] border border-emerald-100 dark:border-[#262626] rounded-lg p-3.5 flex items-center gap-3">
          <div className="size-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="size-4" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{summary.completedCount}</p>
            <p className="text-[11px] text-gray-500 dark:text-neutral-400 font-medium">Completed</p>
          </div>
        </div>

        {/* Metric 3: Total Enrolled */}
        <div className="bg-purple-50/50 dark:bg-[#1a1a1a] border border-purple-100 dark:border-[#262626] rounded-lg p-3.5 flex items-center gap-3">
          <div className="size-9 rounded-lg bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-900/60 flex items-center justify-center text-purple-700 dark:text-purple-400 shrink-0">
            <BookOpen className="size-4" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{summary.totalEnrolled}</p>
            <p className="text-[11px] text-gray-500 dark:text-neutral-400 font-medium">Total Enrolled</p>
          </div>
        </div>
      </div>

      {/* 3. Overall Completion Progress Bar */}
      <div className="space-y-2 mb-5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 dark:text-neutral-400 font-medium">Curriculum Completion</span>
          <span className="text-gray-900 dark:text-white font-semibold">{summary.overallProgress}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-[#262626] overflow-hidden">
          <div
            className="h-full bg-[#2563eb] rounded-full transition-all duration-300"
            style={{ width: `${summary.overallProgress}%` }}
          />
        </div>
      </div>

      {/* 4. Action Bar */}
      <div className="pt-4 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-gray-500 dark:text-neutral-400">
          Pick up where you left off or review past course materials.
        </p>

        <Button
          asChild
          size="sm"
          className="bg-[#2563eb] hover:bg-blue-600 text-white text-xs font-medium h-8 px-4 cursor-pointer self-start sm:self-auto"
        >
          <Link to="/my-learning" className="inline-flex items-center gap-1.5">
            <span>Open My Learning</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
};
