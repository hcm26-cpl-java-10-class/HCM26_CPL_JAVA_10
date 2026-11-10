import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, CheckCircle2, ChevronDown, Clock, ClipboardList, Flag, Layers, ListChecks, LoaderCircle, Lock, Users,
} from "lucide-react";
import { projectAssignmentApi } from "@/api/features/project-assignment.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  AssignmentBrief, AssignmentBriefMilestone, AssignmentBriefNode, AssignmentBriefRubric, AssignmentTemplate,
} from "@/types/features/project-assignment";
import { LevelPill } from "./CatalogBits";
import { levelStyle, moduleAccent, ratingStyles, statStyles } from "./catalog-styles";
import { assignmentFailure, formatPublishedAt, isVersionChanged, milestoneDue } from "./master-catalog.utils";

type BriefTab = "overview" | "milestones" | "rubrics";

/** A milestone located in the master/module tree; `key` is stable within one brief. */
interface MilestoneEntry { key: string; node: AssignmentBriefNode; index: number; milestone: AssignmentBriefMilestone }

function flatten(node: AssignmentBriefNode): AssignmentBriefNode[] {
  return [node, ...node.modules.flatMap(flatten)];
}

function entriesOf(nodes: AssignmentBriefNode[]): MilestoneEntry[] {
  return nodes.flatMap(node => node.milestones.map((milestone, index) => ({
    key: `${node.templateId}:${index}`, node, index, milestone,
  })));
}

function score(value: number | null | undefined) {
  if (value == null) return null;
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function MasterBriefDialog({ classId, sessionId, template, selectedId, onClose, onSelect, onVersionChanged }: {
  classId: number;
  sessionId: number;
  /** The popup is open while a template is given. */
  template: AssignmentTemplate | null;
  selectedId: number | null;
  onClose: () => void;
  /** Omitted when the selection can no longer change (e.g. after the project step). */
  onSelect?: (template: AssignmentTemplate) => void;
  onVersionChanged: () => void;
}) {
  const { user, activeRole } = usePermissions();
  const brief = useQuery({
    queryKey: ["master-assignment-brief", classId, sessionId, user.email, activeRole, template?.id, template?.versionId],
    queryFn: ({ signal }) => projectAssignmentApi.brief(classId, sessionId, template!, signal),
    enabled: template !== null,
    retry: false,
    // A published version never changes; a newer version gets another versionId and therefore another key.
    staleTime: Infinity,
  });
  const data = brief.data;
  const selected = template !== null && template.id === selectedId;
  const level = data?.master.level ?? (template && "level" in template ? template.level as string | null : null);
  const published = formatPublishedAt(data?.publishedAt);

  return <Dialog open={template !== null} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="flex max-h-[min(92vh,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
      <header className={"border-b bg-gradient-to-b to-transparent px-5 pt-5 pb-4 sm:px-6 " + levelStyle(level).tint}>
        <div className="flex flex-wrap items-center gap-1.5 pr-8 text-xs text-muted-foreground">
          {template?.code && <span className="font-mono font-medium">{template.code}</span>}
          {template && <Badge variant="outline" className="bg-background/70 font-normal">{template.version}</Badge>}
          <LevelPill level={level} />
          {data?.category && <span className="rounded-full border bg-background/70 px-2 py-0.5">{data.category}</span>}
          {published && <span>· Công bố {published}</span>}
        </div>
        <DialogTitle className="mt-2 text-xl leading-snug font-semibold">{data?.master.name ?? template?.name}</DialogTitle>
        <DialogDescription className={data?.master.technologyStack ? "mt-1" : "sr-only"}>
          {data?.master.technologyStack ?? "Thông tin đề bài Master"}
        </DialogDescription>
        {data && <HeaderStats brief={data} />}
      </header>

      {brief.isPending ? <div role="status" aria-label="Đang tải đề bài" className="grid gap-3 p-6">
        <Skeleton className="h-9 w-72" /><Skeleton className="h-24" /><Skeleton className="h-40" />
      </div> : brief.isError ? <div className="p-6">
        <div role="alert" className="grid gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {isVersionChanged(brief.error) ? <>
            <p>Đề bài vừa có phiên bản mới. Tải lại thư viện để xem phiên bản đang công bố.</p>
            <Button className="w-fit" variant="outline" size="sm" onClick={onVersionChanged}>Tải lại thư viện</Button>
          </> : <>
            <p>{assignmentFailure(brief.error, "Không tải được đề bài.")}</p>
            <Button className="w-fit" variant="outline" size="sm" onClick={() => void brief.refetch()}>Thử lại</Button>
          </>}
        </div>
      </div> : data && <BriefBody key={data.versionId} brief={data} />}

      <footer className="flex flex-col-reverse gap-2 border-t bg-muted/30 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden="true" /> Nội dung theo phiên bản {template?.version}, cố định khi gán cho Team.
        </p>
        <div className="flex gap-2 sm:justify-end">
          <Button variant="outline" onClick={onClose}>Đóng</Button>
          {onSelect && template && (selected
            ? <Button disabled className="bg-emerald-600 text-white disabled:opacity-100 dark:bg-emerald-500">
              <CheckCircle2 className="size-4" /> Đang chọn đề này</Button>
            : <Button disabled={!data} onClick={() => onSelect(template)}>
              {brief.isFetching && <LoaderCircle className="size-4 animate-spin" />} Chọn đề bài này <ArrowRight className="size-4" />
            </Button>)}
        </div>
      </footer>
    </DialogContent>
  </Dialog>;
}

function HeaderStats({ brief }: { brief: AssignmentBrief }) {
  const master = brief.master;
  const nodes = flatten(master);
  const stats = [
    { key: "modules", icon: Layers, label: "Module", value: nodes.length > 1 ? String(nodes.length - 1) : "—" },
    { key: "milestones", icon: Flag, label: "Milestone", value: String(entriesOf(nodes).length) },
    { key: "members", icon: Users, label: "Sĩ số Team", value: `${master.minMembers}–${master.maxMembers}` },
    { key: "duration", icon: Clock, label: "Thời lượng", value: master.estimatedDurationWeeks ? `${master.estimatedDurationWeeks} tuần` : "—" },
  ] as const;
  return <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
    {stats.map(({ key, icon: Icon, label, value }) => <div key={key} className="flex items-center gap-2.5 rounded-lg border bg-background/80 p-2.5">
      <span className={"grid size-8 shrink-0 place-items-center rounded-md " + statStyles[key].chip}><Icon className="size-4" aria-hidden="true" /></span>
      <div className="min-w-0"><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="truncate text-sm font-semibold">{value}</dd></div>
    </div>)}
  </dl>;
}

function BriefBody({ brief }: { brief: AssignmentBrief }) {
  const nodes = flatten(brief.master);
  const entries = entriesOf(nodes);
  const rubricEntries = entries.filter(entry => entry.milestone.rubric !== null);
  const [tab, setTab] = useState<BriefTab>("overview");
  const [rubricKey, setRubricKey] = useState<string | null>(null);
  const activeRubric = rubricEntries.find(entry => entry.key === rubricKey) ?? rubricEntries[0];

  function openRubric(key: string) {
    setRubricKey(key);
    setTab("rubrics");
  }

  return <Tabs value={tab} onValueChange={value => setTab(value as BriefTab)} className="min-h-0 flex-1 gap-0">
    <div className="border-b px-5 sm:px-6">
      <TabsList variant="line" className="h-11 w-full justify-start gap-4 overflow-x-auto">
        <TabsTrigger value="overview" className="flex-none px-0.5">Tổng quan</TabsTrigger>
        <TabsTrigger value="milestones" className="flex-none px-0.5">Milestone <Count value={entries.length} /></TabsTrigger>
        <TabsTrigger value="rubrics" className="flex-none px-0.5">Rubric <Count value={rubricEntries.length} /></TabsTrigger>
      </TabsList>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
      <TabsContent value="overview"><Overview brief={brief} nodes={nodes} /></TabsContent>
      <TabsContent value="milestones"><Milestones nodes={nodes} master={brief.master} onOpenRubric={openRubric} /></TabsContent>
      <TabsContent value="rubrics">
        {activeRubric ? <Rubrics entries={rubricEntries} active={activeRubric} master={brief.master} onChange={setRubricKey} />
          : <Empty icon={<ClipboardList className="size-6" />}>Các milestone của đề bài chưa gắn rubric chấm điểm.</Empty>}
      </TabsContent>
    </div>
  </Tabs>;
}

function Count({ value }: { value: number }) {
  return <span className="ml-1 rounded-full bg-muted px-1.5 py-px text-[11px] font-medium text-muted-foreground tabular-nums">{value}</span>;
}

function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return <div className="mb-2.5 flex items-center justify-between gap-2">
    <h3 className="text-sm font-semibold">{children}</h3>{aside}
  </div>;
}

function Empty({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <div className="grid justify-items-center gap-3 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
    <span className="grid size-12 place-items-center rounded-full bg-muted">{icon}</span>{children}
  </div>;
}

function nodeLabel(node: AssignmentBriefNode, master: AssignmentBriefNode) {
  return node === master ? "Cấp Master" : `Module · ${node.name}`;
}

/* ---------- Overview ---------- */

function Overview({ brief, nodes }: { brief: AssignmentBrief; nodes: AssignmentBriefNode[] }) {
  const master = brief.master;
  const backlog = nodes.filter(node => node.backlogItems.length > 0);
  const backlogCount = backlog.reduce((sum, node) => sum + node.backlogItems.length, 0);
  return <div className="grid gap-6">
    <section>
      <SectionTitle>Mô tả đề bài</SectionTitle>
      {master.description
        ? <p className="max-w-prose whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">{master.description}</p>
        : <p className="text-sm text-muted-foreground">Đề bài chưa có mô tả.</p>}
    </section>
    {(master.rolePolicy.quotas.length > 0 || master.rolePolicy.allowMultiRole) && <section>
      <SectionTitle>Định suất vai trò</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {master.rolePolicy.quotas.map(quota => <span key={quota.role} className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm">
          <span className="font-semibold">{quota.role}</span>
          <span className="text-muted-foreground tabular-nums">{quota.min === quota.max ? quota.min : `${quota.min}–${quota.max}`} người</span>
        </span>)}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{master.rolePolicy.allowMultiRole
        ? "Một thành viên có thể đảm nhận nhiều vai trò." : "Mỗi thành viên đảm nhận đúng một vai trò."}</p>
    </section>}
    <section>
      <SectionTitle aside={<span className="text-xs text-muted-foreground">{master.modules.length > 0
        ? `${master.modules.length} module trực tiếp` : "Một Team nhận toàn bộ"}</span>}>Cấu trúc đề bài</SectionTitle>
      {master.modules.length === 0
        ? <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">Đề bài không chia module. Một Team thực hiện toàn bộ milestone.</p>
        : <div className="grid gap-2 sm:grid-cols-2">{master.modules.map(module => <ModuleCard key={module.templateId} module={module} />)}</div>}
    </section>
    {backlogCount > 0 && <details className="group rounded-xl border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold">
        <span className="flex items-center gap-2"><ListChecks className="size-4 text-muted-foreground" /> Backlog gợi ý <Count value={backlogCount} /></span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-4 border-t px-4 py-3">
        {backlog.map(node => <div key={node.templateId} className="grid gap-2">
          {backlog.length > 1 && <p className="text-xs font-medium text-muted-foreground">{nodeLabel(node, master)}</p>}
          <ul className="grid gap-1.5">
            {node.backlogItems.map((item, index) => <li key={index} className="flex items-start justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2 text-sm">
              <div className="min-w-0"><p className="break-words font-medium">{item.title}</p>
                {item.description && <p className="break-words text-xs text-muted-foreground">{item.description}</p>}</div>
              {item.suggestedRole && <Badge variant="outline" className="shrink-0">{item.suggestedRole}</Badge>}
            </li>)}
          </ul>
        </div>)}
      </div>
    </details>}
  </div>;
}

function ModuleCard({ module }: { module: AssignmentBriefNode }) {
  return <article className={"grid content-start gap-1.5 rounded-lg border border-l-4 bg-card p-3 " + moduleAccent}>
    <div className="flex flex-wrap items-center gap-2">
      <h4 className="break-words font-semibold">{module.name}</h4>
      {module.code && <span className="font-mono text-xs text-muted-foreground">{module.code}</span>}
    </div>
    {module.description && <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">{module.description}</p>}
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1"><Users className={"size-3.5 " + statStyles.members.icon} />{module.minMembers}–{module.maxMembers} người</span>
      <span className="inline-flex items-center gap-1"><Flag className={"size-3.5 " + statStyles.milestones.icon} />{module.milestones.length} milestone</span>
      {module.modules.length > 0 && <span className="inline-flex items-center gap-1"><Layers className={"size-3.5 " + statStyles.modules.icon} />{module.modules.length} module con</span>}
    </p>
  </article>;
}

/* ---------- Milestones ---------- */

function Milestones({ nodes, master, onOpenRubric }: {
  nodes: AssignmentBriefNode[]; master: AssignmentBriefNode; onOpenRubric: (key: string) => void;
}) {
  const groups = nodes.filter(node => node.milestones.length > 0);
  if (groups.length === 0) return <Empty icon={<Flag className="size-6" />}>Đề bài chưa có milestone.</Empty>;
  return <div className="grid gap-6">
    {groups.map(node => <section key={node.templateId}>
      {groups.length > 1 && <SectionTitle>{nodeLabel(node, master)}</SectionTitle>}
      <ol className="relative grid gap-3 before:absolute before:top-3 before:bottom-3 before:left-[0.9rem] before:w-px before:bg-border">
        {node.milestones.map((milestone, index) => <MilestoneItem key={index} index={index} milestone={milestone}
          onOpenRubric={milestone.rubric ? () => onOpenRubric(`${node.templateId}:${index}`) : undefined} />)}
      </ol>
    </section>)}
  </div>;
}

function MilestoneItem({ index, milestone, onOpenRubric }: {
  index: number; milestone: AssignmentBriefMilestone; onOpenRubric?: () => void;
}) {
  const due = milestoneDue(milestone);
  const rubric = milestone.rubric;
  return <li className="relative grid grid-cols-[1.8rem_minmax(0,1fr)] gap-3">
    <span className="z-10 grid size-7 place-items-center rounded-full border-2 border-background bg-sky-100 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-900">
      {index + 1}</span>
    <div className="grid gap-2 rounded-xl border bg-card p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="break-words font-semibold">{milestone.title}</h4>
        <span className={"rounded-full px-2 py-0.5 text-[11px] font-medium " + (milestone.mandatory
          ? "bg-foreground/90 text-background" : "border text-muted-foreground")}>{milestone.mandatory ? "Bắt buộc" : "Tùy chọn"}</span>
      </div>
      {(due || milestone.weight != null) && <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {due && <span className="inline-flex items-center gap-1.5"><Clock className={"size-3.5 " + statStyles.duration.icon} />{due}</span>}
        {milestone.weight != null && <span className="inline-flex items-center gap-2">
          Trọng số <span className="font-medium text-foreground tabular-nums">{score(milestone.weight)}%</span>
          <span aria-hidden="true" className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-sky-500" style={{ width: `${Math.min(100, Math.max(0, milestone.weight))}%` }} />
          </span>
        </span>}
      </div>}
      {milestone.description && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{milestone.description}</p>}
      {milestone.checklist.length > 0 && <ul className="grid gap-1 text-sm">
        {milestone.checklist.map((item, itemIndex) => <li key={itemIndex} className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
          <span className="break-words">{item.content}{item.mandatory && <span className="text-destructive" title="Bắt buộc"> *</span>}</span>
        </li>)}
      </ul>}
      {rubric && onOpenRubric && <button type="button" onClick={onOpenRubric}
        className="group/rubric flex w-full items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2 text-left text-xs transition-colors hover:border-blue-300 hover:bg-blue-50/60 dark:hover:border-blue-800 dark:hover:bg-blue-950/30">
        <span className="flex min-w-0 items-center gap-2">
          <ClipboardList className="size-4 shrink-0 text-blue-600 dark:text-blue-300" aria-hidden="true" />
          <span className="truncate"><span className="font-medium">Rubric:</span> {rubricTitle(rubric)}
            <span className="text-muted-foreground"> · {rubric.criteria.length} tiêu chí{rubric.totalMaxScore != null && ` · ${score(rubric.totalMaxScore)} điểm`}</span></span>
        </span>
        <span className="flex shrink-0 items-center gap-1 font-medium text-blue-700 dark:text-blue-300">Xem <ArrowRight className="size-3.5 transition-transform group-hover/rubric:translate-x-0.5" /></span>
      </button>}
    </div>
  </li>;
}

function rubricTitle(rubric: AssignmentBriefRubric) {
  return rubric.name ?? "Tiêu chí chấm điểm";
}

/* ---------- Rubrics ---------- */

function Rubrics({ entries, active, master, onChange }: {
  entries: MilestoneEntry[]; active: MilestoneEntry; master: AssignmentBriefNode; onChange: (key: string) => void;
}) {
  const rubric = active.milestone.rubric!;
  return <div className="grid gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">
    <nav aria-label="Milestone có rubric" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0">
      {entries.map(entry => {
        const current = entry.key === active.key;
        return <button key={entry.key} type="button" aria-current={current ? "true" : undefined} onClick={() => onChange(entry.key)}
          className={"grid min-w-44 gap-0.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors md:min-w-0 "
            + (current ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40" : "hover:bg-muted/50")}>
          <span className="text-[11px] text-muted-foreground">{entry.node === master ? `Milestone ${entry.index + 1}` : entry.node.name}</span>
          <span className={"truncate font-medium " + (current ? "text-blue-800 dark:text-blue-200" : "")}>{entry.milestone.title}</span>
        </button>;
      })}
    </nav>
    <section aria-label={`Rubric của ${active.milestone.title}`} className="grid min-w-0 content-start gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-muted/30 p-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">{nodeLabel(active.node, master)} · {active.milestone.title}</p>
          <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold">
            {rubricTitle(rubric)}{rubric.version && <Badge variant="outline" className="font-normal">{rubric.version}</Badge>}
          </h3>
          {rubric.description && <p className="text-sm text-muted-foreground">{rubric.description}</p>}
          {rubric.legacy && <p className="text-xs text-muted-foreground">Tiêu chí được nhập trực tiếp trong đề bài (chưa dùng thư viện rubric).</p>}
        </div>
        <div className="grid shrink-0 justify-items-end gap-0.5 rounded-lg bg-background px-3 py-2 text-right shadow-xs">
          <span className="text-[11px] text-muted-foreground">Tổng điểm</span>
          <span className="text-lg font-semibold tabular-nums">{score(rubric.totalMaxScore) ?? "—"}</span>
        </div>
      </div>
      <ol className="grid gap-3">
        {rubric.criteria.map((criterion, index) => <li key={criterion.code ?? index} className="grid gap-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {criterion.code && <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">{criterion.code}</span>}
              <h4 className="break-words font-semibold">{criterion.name}</h4>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {criterion.weight != null && <span>Trọng số <span className="font-semibold text-foreground tabular-nums">{score(criterion.weight)}%</span></span>}
              {criterion.maxScore != null && <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700 tabular-nums dark:bg-blue-950/40 dark:text-blue-300">
                {score(criterion.maxScore)} điểm</span>}
            </div>
          </div>
          {criterion.weight != null && <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-blue-500/80" style={{ width: `${Math.min(100, Math.max(0, criterion.weight))}%` }} />
          </span>}
          {criterion.description && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{criterion.description}</p>}
          {criterion.ratings.length > 0 && <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {criterion.ratings.map(rating => {
              const style = ratingStyles[rating.level] ?? ratingStyles.FAIR;
              return <li key={rating.level} className={"grid content-start gap-1 rounded-lg border p-2.5 " + style.tile}>
                <span className="flex items-center justify-between gap-2 text-xs font-semibold">
                  <span className="flex items-center gap-1.5"><span aria-hidden="true" className={"size-2 rounded-full " + style.dot} />{style.label}</span>
                  <span className="font-medium text-muted-foreground tabular-nums">{score(rating.percentage)}%</span>
                </span>
                <span className="break-words text-xs text-foreground/80">{rating.description}</span>
              </li>;
            })}
          </ul>}
        </li>)}
      </ol>
    </section>
  </div>;
}
