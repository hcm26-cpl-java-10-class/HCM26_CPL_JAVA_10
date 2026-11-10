import { AlertTriangle } from "lucide-react";

type Props = {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warning" | "danger";
};

/** Thẻ số liệu tổng quan dùng chung cho các tab analytics. */
export function MetricCard({ label, value, hint, tone = "default" }: Props) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-500"
        : "";

  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{label}</span>
        {tone === "danger" ? <AlertTriangle className="size-4 text-destructive" /> : null}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</div>
      {hint ? (
        <div className="mt-0.5 truncate text-xs text-muted-foreground" title={hint}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}
