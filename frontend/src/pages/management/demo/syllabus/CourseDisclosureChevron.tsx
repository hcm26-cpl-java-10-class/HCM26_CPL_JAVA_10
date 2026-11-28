import { ChevronDown } from "lucide-react";

/** One disclosure indicator for the Course-from-Syllabus workspace.
 * Native <details> uses its own open state; Radix/manual panels pass open.
 * Hide the browser's native summary marker when using this component.
 */
export default function CourseDisclosureChevron({
  open = false, native = false, className = "",
}: { open?: boolean; native?: boolean; className?: string }) {
  return <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-muted-foreground transition-transform duration-150 ${native ? "-rotate-90 group-open:rotate-0" : open ? "" : "-rotate-90"} ${className}`} />;
}
