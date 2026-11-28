import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { History } from "lucide-react";
import { auditLogApi } from "@/api";
import type { RootState } from "@/store/store";
import { isAuditAdmin } from "@/components/audit/auditAccess";
import { resolveAuditEntityType } from "@/components/audit/auditEntityRoutes";
import { AuditHistoryExplorer } from "@/components/audit/AuditHistoryExplorer";

/**
 * One "History" button in the shared page header (MainLayout), so every admin page has the same
 * entry to the audit history of its own feature, whatever the page looks like.
 */
export function PageHistoryButton() {
  const roles = useSelector((state: RootState) => state.auth.roles);
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const admin = isAuditAdmin(roles);

  const { data } = useQuery({
    queryKey: ["audit-log-filter-options"],
    queryFn: auditLogApi.getFilterOptions,
    enabled: admin,
    staleTime: 5 * 60_000,
  });

  if (!admin || pathname.startsWith("/admin/audit-log")) return null;

  const entityType = resolveAuditEntityType(pathname, data?.entityTypes ?? []);

  if (!entityType) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Audit history of ${entityType}`}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground/80 shadow-sm transition hover:bg-muted"
      >
        <History className="h-4 w-4" />
        <span className="hidden sm:inline">History</span>
      </button>

      {open && (
        <AuditHistoryExplorer
          initialScope={{ entityType, entityId: null }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
