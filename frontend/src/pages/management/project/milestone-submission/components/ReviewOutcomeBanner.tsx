import { ArrowRight, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resultPath, useReviewOutcome } from "../review-outcome";
import { decisionStyles, formatScore } from "./review-decision";

/** Confirms the review that was just saved on the page the reviewer returned to. */
export function ReviewOutcomeBanner({ className }: { className?: string }) {
  const outcome = useReviewOutcome();
  const location = useLocation();
  const navigate = useNavigate();
  if (!outcome) return null;
  const style = decisionStyles[outcome.decision];
  const Icon = style.icon;
  const here = `${location.pathname}${location.search}`;
  const dismiss = () => navigate(here, { replace: true, state: null });
  const score = outcome.finalScore != null
    ? `${formatScore(outcome.finalScore)}${outcome.totalMaxScore != null ? `/${formatScore(outcome.totalMaxScore)}` : ""} pts`
    : null;

  return (
    <div role="status" className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2.5 text-sm", style.banner, className)}>
      <Icon className={cn("size-5 shrink-0", style.icon_color)} aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">{style.done}</span>
        <span className="text-foreground/80"> · Version {outcome.versionNumber}{score ? ` · ${score}` : ""}</span>
        <span className="block truncate text-xs text-muted-foreground">{outcome.milestoneTitle} · {outcome.teamName}</span>
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="bg-background/70"
        onClick={() => navigate(resultPath(outcome.reviewSubmissionId), { state: { returnTo: here } })}
      >
        View result <ArrowRight className="size-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" onClick={dismiss} aria-label="Dismiss" title="Dismiss">
        <X className="size-4" />
      </Button>
    </div>
  );
}
