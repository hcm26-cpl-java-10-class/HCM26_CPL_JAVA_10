import React from "react";
import type { LearningStatsSummary } from "../learning.types";

interface LearningStatisticsCardProps {
  stats: LearningStatsSummary;
}

export const LearningStatisticsCard: React.FC<LearningStatisticsCardProps> = ({ stats }) => {
  return (
    <div className="bg-[#141414] dark:bg-[#141414] rounded-xl border border-[#262626] dark:border-[#262626] p-5 shadow-sm">
      <h4 className="text-sm font-bold text-white mb-4">
        Last 4 weeks
      </h4>

      <div className="grid grid-cols-3 gap-2 text-left">
        {/* Metric 1 */}
        <div className="flex flex-col">
          <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {stats.dailyGoalsCompleted}
          </span>
          <span className="text-[11px] text-neutral-400 leading-tight mt-1">
            Daily goals completed
          </span>
        </div>

        {/* Metric 2 */}
        <div className="flex flex-col">
          <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {stats.itemsCompleted}
          </span>
          <span className="text-[11px] text-neutral-400 leading-tight mt-1">
            Items completed
          </span>
        </div>

        {/* Metric 3 */}
        <div className="flex flex-col">
          <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {stats.minutesLearned}
          </span>
          <span className="text-[11px] text-neutral-400 leading-tight mt-1">
            Minutes learned
          </span>
        </div>
      </div>
    </div>
  );
};
