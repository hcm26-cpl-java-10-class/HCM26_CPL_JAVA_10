import type { RubricRatingLevel } from "@/types";
import { criterionKey, type RubricCriterionView } from "../rubric-view.types";
import { ChevronDown } from "lucide-react";
import { criterionColor } from "../rubric-colors";

const RATING_STYLES: Record<RubricRatingLevel, string> = {
  EXCELLENT: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40",
  GOOD: "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40",
  FAIR: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
  NOT_MET: "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40",
};

const RATING_TEXT: Record<RubricRatingLevel, string> = {
  EXCELLENT: "text-emerald-800 dark:text-emerald-300",
  GOOD: "text-sky-800 dark:text-sky-300",
  FAIR: "text-amber-800 dark:text-amber-300",
  NOT_MET: "text-rose-800 dark:text-rose-300",
};

const formatLevel = (level: string) =>
  level.replaceAll("_", " ").toLowerCase().replace(/^\w/, (char) => char.toUpperCase());

const formatPoints = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, ""));

export function RubricCriterionCard({ criterion, index, open, onToggle }: {
  criterion: RubricCriterionView;
  index: number;
  open: boolean;
  onToggle: () => void;
}) {
  const ratings = [...(criterion.ratings ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);
  const contentId = `criterion-${criterionKey(criterion).replace(/[^\w-]/g, "_")}-ratings`;

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full min-w-0 items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <span className={`${criterionColor(index)} mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white`}>
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold [overflow-wrap:anywhere]">{criterion.name}</h3>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground [overflow-wrap:anywhere]">{criterion.code}</span>
          </div>
          {criterion.description ? (
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground [overflow-wrap:anywhere]">{criterion.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right text-sm">
            <div className="font-semibold">{criterion.maxScore} pts</div>
            <div className="text-xs text-muted-foreground">{criterion.weight}% weight</div>
          </div>
          <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open ? (
        <div id={contentId} className="border-t bg-muted/20 px-4 py-3">
          {ratings.length ? (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {ratings.map((rating) => (
                <div key={rating.id || rating.level} className={`min-w-0 rounded-lg border p-2.5 ${RATING_STYLES[rating.level]}`}>
                  <div className={`flex items-baseline justify-between gap-2 ${RATING_TEXT[rating.level]}`}>
                    <span className="text-sm font-semibold">{formatLevel(rating.level)}</span>
                    <span className="text-xs font-medium">{rating.percentage}%</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {formatPoints((Number(criterion.maxScore) * Number(rating.percentage)) / 100)} / {criterion.maxScore} pts
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
                    {rating.description || <span className="text-muted-foreground">No guidance provided.</span>}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No rating levels defined for this criterion.</p>
          )}
        </div>
      ) : null}
    </article>
  );
}
