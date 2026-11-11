import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";

interface PassBadgeProps {
  passed: boolean;
  /** Shown as a tooltip when known. */
  passScore?: number | null;
  className?: string;
}

/** "Passed" / "Not passed" badge for an exam attempt, based on the pass score frozen at the start. */
export function PassBadge({ passed, passScore, className = "" }: PassBadgeProps) {
  const title = passScore != null ? `Pass score: ${passScore}` : undefined;
  return passed ? (
    <Badge title={title} className={`gap-1 bg-emerald-600 text-white hover:bg-emerald-600 ${className}`}>
      <CheckCircle2 className="size-3" />
      Passed
    </Badge>
  ) : (
    <Badge title={title} variant="destructive" className={`gap-1 ${className}`}>
      <XCircle className="size-3" />
      Not passed
    </Badge>
  );
}
