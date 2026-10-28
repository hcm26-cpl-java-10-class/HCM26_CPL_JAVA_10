import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DailyActivity } from "../learning.types";

interface LearningActivityCalendarProps {
  activityData: Record<string, DailyActivity>;
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export const LearningActivityCalendar: React.FC<LearningActivityCalendarProps> = ({
  activityData,
}) => {
  // Reference date: current date is October 2026 matching screenshots
  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 9, 27)); // month index 9 is October
  const [selectedDateStr, setSelectedDateStr] = useState<string>("2026-10-27");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString("en-US", { month: "long" });

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Compute days in current month
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  // Day of week for 1st day (0 = Sunday, 1 = Monday, ... 6 = Saturday)
  // We want Mo = 0, Tu = 1, ... Su = 6
  let startOffset = firstDayOfMonth.getDay() - 1;
  if (startOffset === -1) startOffset = 6;

  // Selected date info
  const selectedDayActivity = selectedDateStr ? activityData[selectedDateStr] : null;

  return (
    <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#262626] p-5 shadow-xs">
      {/* 1. Header with Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span>{monthName} {year}</span>
        </h4>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={prevMonth}
            className="size-7 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800 rounded-md cursor-pointer"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={nextMonth}
            className="size-7 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800 rounded-md cursor-pointer"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* 2. Weekday Header */}
      <div className="grid grid-cols-7 text-center text-xs text-gray-400 dark:text-neutral-400 font-medium mb-2">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="py-1">
            {wd}
          </div>
        ))}
      </div>

      {/* 3. Days Grid */}
      <div className="grid grid-cols-7 gap-y-1.5 text-center text-xs">
        {/* Empty cells before month starts */}
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="h-8" />
        ))}

        {/* Month days */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
          const isToday = dayNum === 27 && month === 9 && year === 2026;
          const isSelected = selectedDateStr === dateStr;
          const activity = activityData[dateStr];

          return (
            <div key={dateStr} className="flex flex-col items-center justify-center">
              <button
                type="button"
                onClick={() => setSelectedDateStr(dateStr)}
                className={`size-7 rounded-full flex items-center justify-center font-medium transition-all cursor-pointer relative ${
                  isSelected
                    ? "border-2 border-purple-600 dark:border-purple-500 text-purple-700 dark:text-white font-bold bg-purple-50/70 dark:bg-purple-950/20"
                    : isToday
                    ? "border border-gray-400 dark:border-neutral-500 text-gray-900 dark:text-white font-semibold"
                    : "text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                } ${activity ? "font-semibold" : ""}`}
              >
                {dayNum}
                {/* Activity badge or dot */}
                {activity && (
                  <span
                    className={`absolute -bottom-0.5 size-1 rounded-full ${
                      activity.allGoalsCompleted
                        ? "bg-purple-600 dark:bg-purple-400"
                        : "bg-blue-600 dark:bg-blue-400"
                    }`}
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* 4. Legend (matching Coursera layout) */}
      <div className="mt-4 pt-3.5 border-t border-gray-100 dark:border-[#262626] flex flex-wrap items-center justify-between text-[11px] text-gray-500 dark:text-neutral-400 gap-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-blue-600 dark:bg-blue-400 inline-block" />
          <span>1+ daily goals completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 bg-purple-600 dark:bg-purple-400 inline-block rounded" />
          <span>All daily goals completed</span>
        </div>
      </div>

      {/* 5. Selected Day Detail Footer */}
      <div className="mt-3.5 pt-2.5 border-t border-gray-100 dark:border-[#262626] text-xs">
        {selectedDayActivity ? (
          <div className="bg-gray-50 dark:bg-[#1c1c1c] rounded-lg p-2.5 border border-gray-200 dark:border-[#2e2e2e]">
            <p className="font-semibold text-gray-900 dark:text-neutral-200">
              {new Date(selectedDateStr).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </p>
            <div className="flex items-center gap-3 text-gray-600 dark:text-neutral-400 text-[11px] mt-1">
              <span>🎯 {selectedDayActivity.completedGoals} goals completed</span>
              <span>⏱️ {selectedDayActivity.minutesLearned} mins</span>
              <span>📚 {selectedDayActivity.itemsCount} items</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-gray-400 dark:text-neutral-500 text-[11px] px-1">
            <Info className="size-3.5 shrink-0 text-gray-400" />
            <span>Select a date to view learning activity breakdown.</span>
          </div>
        )}
      </div>
    </div>
  );
};
