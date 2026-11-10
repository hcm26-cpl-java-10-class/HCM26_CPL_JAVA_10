import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

type Props = {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warning" | "danger";
};

const parseMetric = (value: string) => {
  const match = value.trim().match(/^(-?[\d,]+(?:\.\d+)?)(.*)$/);
  if (!match) return null;

  const rawNumber = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(rawNumber)) return null;

  const decimalPlaces = match[1].includes(".")
    ? match[1].split(".")[1].length
    : 0;

  return {
    target: rawNumber,
    suffix: match[2],
    decimalPlaces,
  };
};

const formatMetricNumber = (value: number, decimalPlaces: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });

/** Shared animated summary metric card used by every analytics tab. */
export function MetricCard({ label, value, hint, tone = "default" }: Props) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const metric = parseMetric(value);

  useEffect(() => {
    if (!metric) return;

    if (shouldReduceMotion) {
      setAnimatedValue(metric.target);
      return;
    }

    let frameId = 0;
    let startTime: number | null = null;
    setAnimatedValue(0);

    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / 850, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      setAnimatedValue(metric.target * easedProgress);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate);
      }
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [metric?.target, shouldReduceMotion, value]);

  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-500"
        : "";

  const displayValue = metric
    ? `${formatMetricNumber(animatedValue, metric.decimalPlaces)}${metric.suffix}`
    : value;

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rounded-xl border bg-card px-4 py-3 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{label}</span>
        {tone === "danger" ? <AlertTriangle className="size-4 text-destructive" /> : null}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>
        {displayValue}
      </div>
      {hint ? (
        <div className="mt-0.5 truncate text-xs text-muted-foreground" title={hint}>
          {hint}
        </div>
      ) : null}
    </motion.div>
  );
}
