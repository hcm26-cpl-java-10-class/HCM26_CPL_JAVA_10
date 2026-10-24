import { rubricApi } from "@/api";
import { SearchInput } from "@/components/datatable/toolbar/SearchInput";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import type { RubricListParams, RubricVersionStatus } from "@/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronLeft, ChevronRight, Eye, FileCheck2, LoaderCircle, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { RubricStatusBadge } from "../components/RubricStatusBadge";

const statuses: RubricVersionStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

export function RubricListPage() {
  const { hasPermission } = usePermissions();
  const [url, setUrl] = useSearchParams();
  const params = useMemo<RubricListParams>(() => ({
    page: Math.max(Number(url.get("page")) || 0, 0),
    size: [10, 20, 50].includes(Number(url.get("size"))) ? Number(url.get("size")) : 20,
    search: url.get("search") || undefined,
    status: statuses.includes(url.get("status") as RubricVersionStatus) ? url.get("status") as RubricVersionStatus : undefined,
  }), [url]);
  const [search, setSearch] = useState(params.search ?? "");
  const update = useCallback((patch: Partial<RubricListParams>) => {
    const next = { ...params, ...patch };
    const query = new URLSearchParams({ page: String(next.page), size: String(next.size) });
    if (next.search) query.set("search", next.search);
    if (next.status) query.set("status", next.status);
    setUrl(query);
  }, [params, setUrl]);

  useEffect(() => { setSearch(params.search ?? ""); }, [params.search]);
  useEffect(() => {
    const normalized = search.trim().replace(/\s+/g, " ").slice(0, 150) || undefined;
    if (normalized === params.search) return;
    const timer = window.setTimeout(() => update({ search: normalized, page: 0 }), 300);
    return () => window.clearTimeout(timer);
  }, [search, params.search, update]);

  const query = useQuery({ queryKey: ["rubrics", "list", params], queryFn: () => rubricApi.getList(params), placeholderData: keepPreviousData, staleTime: 30_000 });
  const data = query.data;

  return (
    <MainLayout pathName={{ rubrics: "Rubrics" }}>
      <div className="grid h-full grid-rows-[auto_1fr_auto] gap-4">
        <div className="grid gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h1 className="text-xl font-semibold">Rubrics</h1><p className="mt-1 text-sm text-muted-foreground">Create reusable, versioned evaluation criteria for milestones.</p></div>
            {hasPermission("RUBRIC_CREATE") ? <Button asChild><Link to="/rubrics/new"><Plus /> Create rubric</Link></Button> : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput search={search} onSearchChange={setSearch} />
            <Select value={params.status ?? "ALL"} onValueChange={(value) => update({ status: value === "ALL" ? undefined : value as RubricVersionStatus, page: 0 })}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">All statuses</SelectItem>{statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
            </Select>
            {(params.status || params.search) ? <Button variant="ghost" onClick={() => { setSearch(""); setUrl(new URLSearchParams({ page: "0", size: String(params.size) })); }}>Clear filters</Button> : null}
          </div>
        </div>

        <div className="min-h-0 overflow-auto rounded-md border bg-card">
          {query.isLoading ? <div className="grid gap-3 p-5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div> : null}
          {query.isError ? <Alert variant="destructive" className="m-5"><AlertCircle /><AlertTitle>Could not load rubrics</AlertTitle><AlertDescription><Button className="mt-3" variant="outline" onClick={() => void query.refetch()}>Try again</Button></AlertDescription></Alert> : null}
          {data && data.content.length === 0 ? <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center"><FileCheck2 className="size-12 text-muted-foreground" /><h2 className="mt-4 text-lg font-semibold">No rubrics found</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">{params.search || params.status ? "Change or clear the current filters." : "Create a draft rubric, add its criteria, then publish it for milestone use."}</p></div> : null}
          {data && data.content.length > 0 ? (
            <Table>
              <TableHeader><TableRow><TableHead>Rubric</TableHead><TableHead>Latest version</TableHead><TableHead>Criteria</TableHead><TableHead>Max score</TableHead><TableHead>Milestone usage</TableHead><TableHead>Updated</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>{data.content.map((rubric) => <TableRow key={rubric.id}>
                <TableCell><Link className="font-semibold hover:underline" to={`/rubrics/${rubric.id}`}>{rubric.name}</Link><p className="mt-1 max-w-lg truncate text-xs text-muted-foreground">{rubric.description || "No description"}</p></TableCell>
                <TableCell><div className="flex items-center gap-2"><span>v{rubric.latestVersionNumber}</span><RubricStatusBadge status={rubric.latestStatus} /></div><p className="mt-1 text-xs text-muted-foreground">{rubric.versionCount} version(s)</p></TableCell>
                <TableCell>{rubric.criteriaCount}</TableCell><TableCell>{rubric.totalMaxScore}</TableCell><TableCell>{rubric.milestoneUsageCount}</TableCell><TableCell>{new Date(rubric.updatedAt).toLocaleDateString("en-GB")}</TableCell>
                <TableCell className="text-right"><Button asChild size="sm" variant="outline"><Link to={`/rubrics/${rubric.id}`} aria-label={`View ${rubric.name}`}><Eye /> View</Link></Button></TableCell>
              </TableRow>)}</TableBody>
            </Table>
          ) : null}
        </div>

        {data && data.totalElements > 0 ? <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">{data.totalElements} rubric{data.totalElements === 1 ? "" : "s"}{query.isFetching ? <LoaderCircle className="ml-2 inline size-4 animate-spin" /> : null}</span>
          <div className="flex items-center gap-2"><Select value={String(data.size)} onValueChange={(value) => update({ size: Number(value), page: 0 })}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent>{[10, 20, 50].map((size) => <SelectItem key={size} value={String(size)}>{size} / page</SelectItem>)}</SelectContent></Select>
            <Button size="icon-sm" variant="outline" disabled={data.page === 0 || query.isFetching} onClick={() => update({ page: data.page - 1 })}><ChevronLeft /></Button><span>Page {data.page + 1} of {Math.max(data.totalPages, 1)}</span><Button size="icon-sm" variant="outline" disabled={data.page + 1 >= data.totalPages || query.isFetching} onClick={() => update({ page: data.page + 1 })}><ChevronRight /></Button></div>
        </div> : <div />}
      </div>
    </MainLayout>
  );
}
