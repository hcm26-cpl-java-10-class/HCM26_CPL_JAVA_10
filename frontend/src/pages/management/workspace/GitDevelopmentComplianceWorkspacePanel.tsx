import { useGitActivityParam } from "./git-activity-url-context";
import { useDeferredValue } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Search, ShieldAlert } from "lucide-react";
import { workspaceGitApi, type GitCommitValidationStatus, type GitDevelopmentRuleType } from "@/api/features/workspace-git.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import { WorkspaceEmptyState } from "./workspace.shared";

const RULE_ALL = "all";
const STATUS_ALL = "all";

const statusPresentation: Record<GitCommitValidationStatus, { label: string; className: string }> = {
  PASSED: { label: "Passed", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  FAILED: { label: "Failed", className: "border-rose-200 bg-rose-50 text-rose-800" },
  MISSING: { label: "Missing Task ID", className: "border-amber-200 bg-amber-50 text-amber-800" },
  INVALID: { label: "Invalid Task ID", className: "border-orange-200 bg-orange-50 text-orange-800" },
  OUTSIDE_PROJECT: { label: "Outside Project", className: "border-purple-200 bg-purple-50 text-purple-800" },
  NOT_EVALUATED: { label: "Not evaluated", className: "border-slate-200 bg-slate-50 text-slate-600" },
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function messageOf(error: unknown) {
  const response = (error as { response?: { data?: { message?: string } } })?.response;
  return response?.data?.message ?? (error instanceof Error ? error.message : "Could not load compliance results.");
}

export function GitDevelopmentComplianceWorkspacePanel({ workspaceId }: { workspaceId: number }) {
  const { user, activeRole } = usePermissions();
  const [search, setSearch] = useGitActivityParam<string>("gitComplianceSearch", "");
  const deferredSearch = useDeferredValue(search.trim());
  const [developerId, setDeveloperId] = useGitActivityParam<number | undefined>("gitComplianceDeveloperId", undefined, "number");
  const [ruleType, setRuleType] = useGitActivityParam<GitDevelopmentRuleType | undefined>("gitComplianceRuleType", undefined);
  const [status, setStatus] = useGitActivityParam<GitCommitValidationStatus | undefined>("gitComplianceStatus", undefined);
  const [from, setFrom] = useGitActivityParam<string>("gitComplianceFrom", "");
  const [to, setTo] = useGitActivityParam<string>("gitComplianceTo", "");
  const [failedOnly, setFailedOnly] = useGitActivityParam<boolean>("gitComplianceFailedOnly", false);
  const [page, setPage] = useGitActivityParam<number>("gitCompliancePage", 0);
  const rules = useQuery({
    queryKey: ["git-activity", "rules", workspaceId, user.email, activeRole],
    queryFn: ({ signal }) => workspaceGitApi.developmentRules(workspaceId, signal),
    retry: false,
  });
  const filters = useQuery({
    queryKey: ["git-activity", "filters", workspaceId, user.email, activeRole],
    queryFn: ({ signal }) => workspaceGitApi.activityFilters(workspaceId, undefined, signal),
    retry: false,
  });
  const query = useQuery({
    queryKey: ["git-activity", "compliance", workspaceId, user.email, activeRole, deferredSearch,
      developerId, ruleType, status, from, to, failedOnly, page],
    queryFn: ({ signal }) => workspaceGitApi.complianceReport(workspaceId, {
      search: deferredSearch || undefined, developerId, ruleType, status,
      from: from || undefined, to: to || undefined, failedOnly, page, size: 20,
    }, signal),
    enabled: rules.data?.some(rule => rule.enabled) === true,
    retry: false,
  });
  if (rules.isPending) return <Card className="border-amber-200"><CardContent className="space-y-3 p-5"><Skeleton className="h-6 w-48" /><Skeleton className="h-24 w-full" /></CardContent></Card>;
  if (rules.isError) return <Card className="border-rose-200"><CardContent className="p-5 text-sm text-rose-800">{messageOf(rules.error)}</CardContent></Card>;
  if (!rules.data?.some(rule => rule.enabled)) return null;

  const report = query.data;
  const conventional = report?.byRule.CONVENTIONAL_COMMIT;
  const taskId = report?.byRule.TASK_ID;
  const rows = report?.results.content ?? [];

  return <Card className="overflow-hidden border-amber-200/80 shadow-sm">
    <CardHeader className="border-b bg-gradient-to-r from-amber-50 via-white to-rose-50/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1"><CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="size-4 text-amber-700" />Development Compliance</CardTitle>
          <CardDescription>Latest saved validation for each visible commit and rule. Unchecked rules are excluded from the totals.</CardDescription></div>
        <Badge variant="outline" className="border-amber-200 bg-white text-amber-800">{report?.evaluatedCommits ?? 0} evaluated commits</Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-5 pt-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <RuleSummary title="Conventional Commit" active={rules.data.some(rule => rule.type === "CONVENTIONAL_COMMIT" && rule.enabled)}
          evaluated={conventional?.evaluated ?? 0} passed={conventional?.passed ?? 0} violations={(conventional?.failed ?? 0)} accent="sky" />
        <RuleSummary title="Task ID Validation" active={rules.data.some(rule => rule.type === "TASK_ID" && rule.enabled)}
          evaluated={taskId?.evaluated ?? 0} passed={taskId?.passed ?? 0}
          violations={(taskId?.missing ?? 0) + (taskId?.invalid ?? 0) + (taskId?.outsideProject ?? 0)} accent="emerald" />
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-slate-50/70 p-3">
        <div className="relative min-w-56 flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input aria-label="Search compliance commits" value={search} placeholder="Search commit, message or developer"
            onChange={event => { setSearch(event.target.value); setPage(0); }} className="bg-white pl-9" /></div>
        <Select value={developerId?.toString() ?? "all"} onValueChange={value => { setDeveloperId(value === "all" ? undefined : Number(value)); setPage(0); }}>
          <SelectTrigger aria-label="Filter compliance by developer" className="w-48 bg-white"><SelectValue placeholder="All developers" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All developers</SelectItem>{(filters.data?.developers ?? []).map(person =>
            <SelectItem key={person.id} value={String(person.id)}>{person.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={ruleType ?? RULE_ALL} onValueChange={value => { setRuleType(value === RULE_ALL ? undefined : value as GitDevelopmentRuleType); setPage(0); }}>
          <SelectTrigger aria-label="Filter compliance by rule" className="w-52 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={RULE_ALL}>All rules</SelectItem><SelectItem value="CONVENTIONAL_COMMIT">Conventional Commit</SelectItem><SelectItem value="TASK_ID">Task ID</SelectItem></SelectContent>
        </Select>
        <Select value={status ?? STATUS_ALL} onValueChange={value => { setStatus(value === STATUS_ALL ? undefined : value as GitCommitValidationStatus); setPage(0); }}>
          <SelectTrigger aria-label="Filter compliance by status" className="w-48 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={STATUS_ALL}>All results</SelectItem>{Object.entries(statusPresentation).map(([key, option]) =>
            <SelectItem key={key} value={key}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
        <Input aria-label="Compliance from date" type="date" value={from} onChange={event => { setFrom(event.target.value); setPage(0); }} className="w-40 bg-white" />
        <Input aria-label="Compliance to date" type="date" value={to} onChange={event => { setTo(event.target.value); setPage(0); }} className="w-40 bg-white" />
        <Button type="button" variant={failedOnly ? "default" : "outline"} className={failedOnly ? "bg-rose-700 hover:bg-rose-800" : "bg-white"}
          aria-pressed={failedOnly} onClick={() => { setFailedOnly(value => !value); setPage(0); }}>
          <ShieldAlert className="mr-2 size-4" />{failedOnly ? "Showing violations" : `Rule violations (${report?.violationCount ?? 0})`}
        </Button>
      </div>
      {query.isPending ? <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-40 w-full" /></div>
        : query.isError ? <WorkspaceEmptyState icon={AlertTriangle} title="Could not load compliance results"
          description={messageOf(query.error)} action={<Button variant="outline" onClick={() => void query.refetch()}>Retry</Button>} />
        : rows.length === 0 ? <WorkspaceEmptyState icon={ClipboardCheck} title="No validation results yet"
          description="This empty state means no commits have been evaluated. It does not count unreviewed commits as passed." compact />
        : <div className="overflow-x-auto rounded-lg border"><Table>
          <TableHeader className="bg-slate-50"><TableRow><TableHead>Commit</TableHead><TableHead>Developer</TableHead><TableHead>Rule</TableHead><TableHead>Result</TableHead><TableHead>Reason</TableHead><TableHead>Evaluated</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((row, index) => <TableRow key={`${row.commitId}-${row.ruleType}-${index}`}>
            <TableCell className="max-w-[24rem]"><p className="truncate font-medium">{row.message.split("\n")[0] || "(no message)"}</p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">{row.sha.slice(0, 10)}</p></TableCell>
            <TableCell>{row.developerName}</TableCell>
            <TableCell><Badge variant="outline" className={row.ruleType === "CONVENTIONAL_COMMIT" ? "border-sky-200 bg-sky-50 text-sky-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}>
              {row.ruleType === "CONVENTIONAL_COMMIT" ? "Commit format" : "Task ID"} · v{row.ruleVersion}</Badge></TableCell>
            <TableCell><Badge variant="outline" className={statusPresentation[row.status].className}>{statusPresentation[row.status].label}</Badge></TableCell>
            <TableCell className="min-w-56"><span>{row.reason}</span>{row.details && <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{row.details}</p>}</TableCell>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(row.evaluatedAt)}</TableCell>
          </TableRow>)}</TableBody>
        </Table></div>}
      {query.data && query.data.results.totalPages > 1 && <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Page {page + 1} of {query.data.results.totalPages}</span>
        <div className="flex gap-2"><Button size="sm" variant="outline" disabled={page === 0 || query.isFetching} onClick={() => setPage(value => Math.max(0, value - 1))}>Previous</Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= query.data.results.totalPages || query.isFetching} onClick={() => setPage(value => value + 1)}>Next</Button></div>
      </div>}
    </CardContent>
  </Card>;
}

function RuleSummary({ title, active, evaluated, passed, violations, accent }: {
  title: string; active: boolean; evaluated: number; passed: number; violations: number; accent: "sky" | "emerald";
}) {
  const palette = accent === "sky" ? "border-sky-200 bg-sky-50/60 text-sky-800" : "border-emerald-200 bg-emerald-50/60 text-emerald-800";
  return <div className={`rounded-xl border p-4 ${palette}`}>
    <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{title}</h3>
      <Badge variant="outline" className="border-current/20 bg-white/70">{active ? "Enabled" : "Disabled"}</Badge></div>
    <div className="mt-4 grid grid-cols-3 gap-2 text-center"><SummaryMetric label="Evaluated" value={evaluated} />
      <SummaryMetric label="Passed" value={passed} />
      <SummaryMetric label="Violations" value={violations} warning={violations > 0} /></div>
  </div>;
}

function SummaryMetric({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return <div className="rounded-lg border border-white/90 bg-white/75 px-2 py-2"><p className={`text-lg font-bold ${warning ? "text-rose-700" : "text-slate-900"}`}>{value}</p><p className="text-[11px] text-muted-foreground">{label}</p>
    {label === "Passed" && value > 0 && <CheckCircle2 className="mx-auto mt-1 size-3.5 text-emerald-600" />}
  </div>;
}
