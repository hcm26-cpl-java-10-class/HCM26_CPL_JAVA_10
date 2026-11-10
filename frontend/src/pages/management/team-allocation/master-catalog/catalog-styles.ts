import type { AssignmentRubricLevel, AssignmentTemplateLevel } from "@/types/features/project-assignment";

/**
 * Colour vocabulary of the master catalogue. The theme stays neutral; colour only carries meaning and uses soft tints
 * (50 background / 200 border / 700 text, with dark variants), never saturated fills except the selected state.
 * Tailwind needs literal class names, so every variant is spelled out here.
 */
interface LevelStyle { pill: string; dot: string; strip: string; edge: string; tint: string }

const neutralLevel: LevelStyle = {
  pill: "border-border bg-muted text-muted-foreground",
  dot: "bg-muted-foreground/50",
  strip: "bg-border",
  edge: "border-l-border",
  tint: "from-muted/60",
};

const levels: Record<AssignmentTemplateLevel, LevelStyle> = {
  BEGINNER: {
    pill: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
    strip: "bg-emerald-500/80",
    edge: "border-l-emerald-500/80",
    tint: "from-emerald-50 dark:from-emerald-950/30",
  },
  INTERMEDIATE: {
    pill: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
    dot: "bg-sky-500",
    strip: "bg-sky-500/80",
    edge: "border-l-sky-500/80",
    tint: "from-sky-50 dark:from-sky-950/30",
  },
  ADVANCED: {
    pill: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
    dot: "bg-violet-500",
    strip: "bg-violet-500/80",
    edge: "border-l-violet-500/80",
    tint: "from-violet-50 dark:from-violet-950/30",
  },
};

export function levelStyle(level: string | null | undefined): LevelStyle {
  return levels[level as AssignmentTemplateLevel] ?? neutralLevel;
}

/** Icon colours of the four template facts; the text next to them stays muted. */
export const statStyles = {
  modules: { icon: "text-indigo-500", chip: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300" },
  milestones: { icon: "text-sky-500", chip: "bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300" },
  members: { icon: "text-teal-500", chip: "bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-300" },
  duration: { icon: "text-amber-500", chip: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300" },
} as const;

export const selectedCard = "border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20 dark:border-blue-400 dark:bg-blue-950/20";
export const assignedPill = "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
export const filterChip = "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300";
export const moduleAccent = "border-l-indigo-400 dark:border-l-indigo-500";

export const ratingStyles: Record<AssignmentRubricLevel, { label: string; tile: string; dot: string }> = {
  EXCELLENT: { label: "Xuất sắc", dot: "bg-emerald-500",
    tile: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30" },
  GOOD: { label: "Tốt", dot: "bg-sky-500",
    tile: "border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/30" },
  FAIR: { label: "Đạt", dot: "bg-amber-500",
    tile: "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30" },
  NOT_MET: { label: "Chưa đạt", dot: "bg-rose-500",
    tile: "border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30" },
};
