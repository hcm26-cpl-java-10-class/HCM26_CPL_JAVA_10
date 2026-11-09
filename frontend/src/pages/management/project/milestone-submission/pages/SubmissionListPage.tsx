import { milestoneSubmissionApi } from "@/api";
import ActionButton from "@/components/datatable/common/ActionButton";
import { useProTable } from "@/components/datatable/hook/useProTable";
import { ProTable } from "@/components/datatable/ProTable";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import type { Pagination, SubmissionListItem, SubmissionPage, SubmissionStatus, MilestoneExecutionStatus } from "@/types";
import { Eye, Inbox } from "lucide-react";
import { useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { SubmissionCard } from "../components/SubmissionCard";
import { submissionListSchema } from "../submission-list.schema";

interface Filters { status?: SubmissionStatus; executionStatus?: MilestoneExecutionStatus; mandatory?: boolean; late?: boolean }

export function SubmissionListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get("projectId") ?? undefined;
  const bucketValue = searchParams.get("bucket")?.toUpperCase();
  const bucket = bucketValue === "REVIEWED" || bucketValue === "ALL" ? bucketValue : "PENDING";
  const api = useMemo(() => ({
    getPage: (pagination: Pagination, search?: string, filters?: Filters) => milestoneSubmissionApi.getPage({
      projectId, page: pagination.page ?? 0, size: pagination.size ?? 20,
      sort: Array.isArray(pagination.sort) ? pagination.sort[0] : pagination.sort,
      search: search?.trim().slice(0, 120) || undefined,
      status: filters?.status, executionStatus: filters?.executionStatus,
      mandatory: filters?.mandatory, late: filters?.late,
      bucket,
    }),
  }), [bucket, projectId]);
  const table = useProTable(api, submissionListSchema, {
    queryKeyParts: [projectId, bucket], searchDebounceMs: 300, retry: false, staleTime: 15_000,
    permissionOverrides: { canRead: true, canCreate: false, canUpdate: false, canDelete: false, canImport: false, canExport: false },
  });
  const response = table.pageData as SubmissionPage | undefined;
  const open = (row: SubmissionListItem) => navigate(`/milestone-submissions/${row.id}/review`, { state: { returnTo: `${location.pathname}${location.search}` } });
  const selectBucket = (value: "PENDING" | "REVIEWED" | "ALL") => setSearchParams((current) => {
    const next = new URLSearchParams(current);
    next.set("bucket", value);
    return next;
  });
  const bucketActions = <div className="flex rounded-lg border p-1">{(["PENDING", "REVIEWED", "ALL"] as const).map((value) => <Button key={value} size="sm" variant={bucket === value ? "default" : "ghost"} onClick={() => selectBucket(value)}>{value === "PENDING" ? "Pending review" : value === "REVIEWED" ? "Reviewed" : "All submissions"}</Button>)}</div>;
  return (
    <MainLayout pathName={{ "milestone-submissions": "Milestone reviews" }}>
      <ProTable<SubmissionListItem>
        table={table}
        headerActions={bucketActions}
        responsiveCards
        selectable={false}
        hideCreate
        renderCard={(props) => <SubmissionCard {...props} />}
        onView={open}
        renderRowActions={(row) => <ActionButton tooltip={row.status === "SUBMITTED" ? "Start review" : "View review"} title={row.status === "SUBMITTED" ? "Start review" : undefined} onClick={() => open(row)} icon={<Eye size={14} />} />}
        renderEmpty={<div className="grid place-items-center gap-3 p-12 text-center"><Inbox className="size-10 text-muted-foreground" /><div><p className="font-semibold">No milestone submissions found</p><p className="text-sm text-muted-foreground">Try clearing the current search or filters.</p></div></div>}
        showPagination={Boolean(response?.totalElements)}
      />
    </MainLayout>
  );
}
