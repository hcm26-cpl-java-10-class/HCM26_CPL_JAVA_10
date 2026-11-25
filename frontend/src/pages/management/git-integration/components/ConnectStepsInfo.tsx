import { LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { title: "Install the app", body: "Pick your GitHub account or organization." },
  { title: "Choose repositories", body: "Grant all repositories or only selected ones." },
  { title: "Authorize & return", body: "We verify the installation belongs to you, then save it for your organization." },
];

/** Explains the GitHub round trip up front, so leaving the app does not feel abrupt. */
export function ConnectStepsInfo({ className }: { className?: string }) {
  return <section aria-label="How connecting works"
    className={cn("rounded-xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/40", className)}>
    <p className="text-xs font-semibold text-blue-800 dark:text-blue-200">What happens when you connect</p>
    <p className="mt-1 text-[11px] leading-4 text-blue-800/80 dark:text-blue-200/80">
      Install the app once per GitHub account or organization. Projects choose repositories from these connections later.
    </p>
    <ol className="mt-3 grid gap-3 sm:grid-cols-3">
      {STEPS.map((step, index) => <li key={step.title} className="flex gap-2.5">
        <span aria-hidden="true"
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900 dark:text-blue-100 dark:ring-blue-800">
          {index + 1}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">{step.title}</p>
          <p className="text-[11px] leading-4 text-muted-foreground">{step.body}</p>
        </div>
      </li>)}
    </ol>
    <p className="mt-3 flex items-center gap-1.5 text-[11px] text-blue-800/80 dark:text-blue-200/80">
      <LockKeyhole className="size-3.5" aria-hidden="true" />
      No GitHub password or personal access token is ever requested. You can revoke access anytime on GitHub.
    </p>
  </section>;
}
