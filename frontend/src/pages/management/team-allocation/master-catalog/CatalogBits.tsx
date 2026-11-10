import { levelStyle } from "./catalog-styles";
import { levelLabel } from "./master-catalog.utils";

export function LevelPill({ level, className = "" }: { level: string | null | undefined; className?: string }) {
  const label = levelLabel(level);
  if (!label) return null;
  const style = levelStyle(level);
  return <span className={"inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium " + style.pill + " " + className}>
    <span aria-hidden="true" className={"size-1.5 rounded-full " + style.dot} />{label}
  </span>;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Marks the parts of `text` that match the catalogue search keyword. */
export function HighlightText({ text, keyword }: { text: string; keyword: string }) {
  const needle = keyword.trim();
  if (!needle) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(needle)})`, "ig"));
  return <>{parts.map((part, index) => index % 2 === 1
    ? <mark key={index} className="rounded-sm bg-yellow-100 px-0.5 text-inherit dark:bg-yellow-500/25">{part}</mark>
    : part)}</>;
}
