import type { ReactNode } from "react";

type Props = {
  label: string;
  value: ReactNode;
  selected: boolean;
  onClick: () => void;
  hint: string;
};

/** Course-style summary card that also works as a keyboard-accessible filter. */
export function SyllabusStatFilterCard({ label, value, selected, onClick, hint }: Props) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={hint}
      title={hint}
      onClick={onClick}
      className={`w-full rounded-md border bg-card p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${selected ? "border-primary/60 bg-primary/5" : ""}`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </button>
  );
}
