import { Bot } from "lucide-react";

interface Props {
    percent?: number | null;
    signals?: string[] | null;
    className?: string;
}

/** Tag showing the estimated % of AI-written content: <30 green, 30-70 amber, >=70 red. */
export function AiPercentTag({ percent, signals, className = "" }: Props) {
    if (percent == null) return null;
    const tone =
        percent >= 70
            ? "border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
            : percent >= 30
              ? "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
              : "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    const label = percent >= 70 ? "Likely AI" : percent >= 30 ? "Possibly AI" : "Likely human";
    const title = `Estimated ${percent}% AI-written (${label}). Heuristic estimate, not proof.${
        signals?.length ? "\n- " + signals.join("\n- ") : ""
    }`;
    return (
        <span
            title={title}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums ${tone} ${className}`}
        >
            <Bot className="size-3" />
            {percent}% AI
        </span>
    );
}

/** Bullet list of the reasons behind the estimate. */
export function AiSignalsList({ signals }: { signals?: string[] | null }) {
    if (!signals?.length) return null;
    return (
        <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
            {signals.map((s) => (
                <li key={s}>{s}</li>
            ))}
        </ul>
    );
}
