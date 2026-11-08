import type { MilestoneLifecycleStatus } from "@/types";
import { cn } from "@/lib/utils";
import { Check, RotateCcw, X } from "lucide-react";

type StepState = "done" | "current" | "upcoming" | "warning" | "error";

const ORDER: MilestoneLifecycleStatus[] = ["PLANNED", "IN_PROGRESS", "SUBMITTED"];

function buildSteps(status: MilestoneLifecycleStatus): Array<{ label: string; state: StepState }> {
  const index = ORDER.indexOf(status);
  const reviewed = index === -1; // CHANGES_REQUESTED, ACCEPTED, REJECTED
  const steps: Array<{ label: string; state: StepState }> = [
    { label: "Planned", state: reviewed || index > 0 ? "done" : "current" },
    { label: "In progress", state: reviewed || index > 1 ? "done" : index === 1 ? "current" : "upcoming" },
    { label: "Submitted", state: reviewed ? "done" : index === 2 ? "current" : "upcoming" },
  ];
  const outcome: { label: string; state: StepState } =
    status === "ACCEPTED" ? { label: "Accepted", state: "done" }
      : status === "REJECTED" ? { label: "Rejected", state: "error" }
        : status === "CHANGES_REQUESTED" ? { label: "Changes requested", state: "warning" }
          : { label: "Accepted", state: "upcoming" };
  return [...steps, outcome];
}

const DOT: Record<StepState, string> = {
  done: "border-emerald-500 bg-emerald-500 text-white",
  current: "border-sky-500 bg-sky-50 text-sky-700 ring-4 ring-sky-100 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-950",
  upcoming: "border-border bg-background text-muted-foreground",
  warning: "border-amber-500 bg-amber-500 text-white ring-4 ring-amber-100 dark:ring-amber-950",
  error: "border-red-500 bg-red-500 text-white ring-4 ring-red-100 dark:ring-red-950",
};

const LABEL: Record<StepState, string> = {
  done: "text-foreground",
  current: "font-semibold text-sky-700 dark:text-sky-300",
  upcoming: "text-muted-foreground",
  warning: "font-semibold text-amber-700 dark:text-amber-300",
  error: "font-semibold text-red-700 dark:text-red-300",
};

/** Shows where the milestone is in its lifecycle: Planned → In progress → Submitted → outcome. */
export function MilestoneLifecycleStepper({ status }: { status: MilestoneLifecycleStatus }) {
  const steps = buildSteps(status);
  return (
    <ol className="flex w-full items-start" aria-label="Milestone lifecycle">
      {steps.map((step, index) => (
        <li key={step.label} className="relative flex flex-1 flex-col items-center text-center" aria-current={step.state === "current" || step.state === "warning" || step.state === "error" ? "step" : undefined}>
          {index > 0 ? (
            <span className={cn("absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2", step.state === "upcoming" ? "bg-border" : "bg-emerald-500")} aria-hidden />
          ) : null}
          <span className={cn("relative z-10 flex size-7 items-center justify-center rounded-full border-2 text-xs font-semibold", DOT[step.state])}>
            {step.state === "done" ? <Check className="size-3.5" /> : step.state === "warning" ? <RotateCcw className="size-3.5" /> : step.state === "error" ? <X className="size-3.5" /> : index + 1}
          </span>
          <span className={cn("mt-2 px-1 text-xs leading-tight", LABEL[step.state])}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
