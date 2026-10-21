import React from "react";
import { Sparkles } from "lucide-react";
import type { SkillItem } from "../types";

interface SkillsCardProps {
  skills: SkillItem[];
}

export const SkillsCard: React.FC<SkillsCardProps> = ({ skills }) => {
  const getBadgeStyle = (color: SkillItem["color"]) => {
    switch (color) {
      case "blue":
        return "bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-900/60";
      case "green":
        return "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/60";
      case "orange":
        return "bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-900/60";
      case "purple":
        return "bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/60 dark:text-purple-400 dark:border-purple-900/60";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200/80 dark:bg-muted dark:text-gray-300 dark:border-border";
    }
  };

  return (
    <div className="bg-white dark:bg-card rounded-xl border border-gray-100 dark:border-border shadow-xs p-6 transition-all">
      <div className="flex items-center gap-2 pb-4 border-b border-gray-100 dark:border-border mb-4">
        <Sparkles className="size-4 text-blue-600 dark:text-blue-400" />
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
          Skills
        </h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {skills.map((skill, index) => (
          <span
            key={index}
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border shadow-2xs transition-colors ${getBadgeStyle(
              skill.color
            )}`}
          >
            {skill.name}
          </span>
        ))}
      </div>
    </div>
  );
};
