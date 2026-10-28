import React from "react";
import { Sparkles } from "lucide-react";
import type { SkillItem } from "../types";

interface SkillsCardProps {
  skills: SkillItem[];
}

export const SkillsCard: React.FC<SkillsCardProps> = ({ skills }) => {
  const getBadgeStyle = (color?: SkillItem["color"]) => {
    switch (color) {
      case "purple":
        return "bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/60 dark:text-purple-400 dark:border-purple-900/60";
      case "blue":
      case "green":
      case "orange":
      default:
        return "bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-900/60";
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
        {skills.length === 0 && <p className="text-sm text-muted-foreground">No skill records are available.</p>}
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
