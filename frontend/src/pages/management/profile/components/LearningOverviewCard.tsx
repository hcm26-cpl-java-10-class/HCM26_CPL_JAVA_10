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
    <div className="bg-[#141414] dark:bg-[#141414] rounded-xl border border-[#262626] dark:border-[#262626] shadow-xs p-6 transition-all hover:border-[#383838]">
      {/* 1. Header with View My Learning link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#262626] mb-5">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <GraduationCap className="size-4 text-blue-400" />
            <span>Learning Overview</span>
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Snapshot of your current courses and achievements.
          </p>
        </div>

        <Link
          to="/my-learning"
          className="inline-flex items-center gap-1.5 text-xs text-[#3b82f6] hover:text-blue-400 font-medium transition-colors self-start sm:self-auto group"
        >
          <span>View My Learning</span>
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* 2. Three Metric Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5">
        {/* Metric 1: In Progress */}
        <div className="bg-[#1a1a1a] border border-[#262626] rounded-lg p-3.5 flex items-center gap-3">
          <div className="size-9 rounded-lg bg-blue-950/60 border border-blue-900/60 flex items-center justify-center text-blue-400 shrink-0">
            <Play className="size-4 fill-current" />
          </div>
          <div>
            <p className="text-xl font-bold text-white">{summary.inProgressCount}</p>
            <p className="text-[11px] text-neutral-400 font-medium">In Progress</p>
          </div>
        </div>

        {/* Metric 2: Completed */}
        <div className="bg-[#1a1a1a] border border-[#262626] rounded-lg p-3.5 flex items-center gap-3">
          <div className="size-9 rounded-lg bg-emerald-950/60 border border-emerald-900/60 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="size-4" />
          </div>
          <div>
            <p className="text-xl font-bold text-white">{summary.completedCount}</p>
            <p className="text-[11px] text-neutral-400 font-medium">Completed</p>
          </div>
        </div>

        {/* Metric 3: Total Enrolled */}
        <div className="bg-[#1a1a1a] border border-[#262626] rounded-lg p-3.5 flex items-center gap-3">
          <div className="size-9 rounded-lg bg-purple-950/60 border border-purple-900/60 flex items-center justify-center text-purple-400 shrink-0">
            <BookOpen className="size-4" />
          </div>
          <div>
            <p className="text-xl font-bold text-white">{summary.totalEnrolled}</p>
            <p className="text-[11px] text-neutral-400 font-medium">Total Enrolled</p>
          </div>
        </div>
      </div>

      {/* 3. Overall Completion Progress Bar */}
      <div className="space-y-2 mb-5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-400 font-medium">Curriculum Completion</span>
          <span className="text-white font-semibold">{summary.overallProgress}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-[#262626] overflow-hidden">
          <div
            className="h-full bg-[#2563eb] rounded-full transition-all duration-300"
            style={{ width: `${summary.overallProgress}%` }}
          />
        </div>
      </div>

      {/* 4. Action Bar */}
      <div className="pt-4 border-t border-[#262626] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-neutral-400">
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
