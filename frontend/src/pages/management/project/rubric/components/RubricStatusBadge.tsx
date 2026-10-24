import { Badge } from "@/components/ui/badge";
import type { RubricVersionStatus } from "@/types";

export function RubricStatusBadge({ status }: { status: RubricVersionStatus }) {
  const variant = status === "PUBLISHED" ? "default" : status === "ARCHIVED" ? "outline" : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}
