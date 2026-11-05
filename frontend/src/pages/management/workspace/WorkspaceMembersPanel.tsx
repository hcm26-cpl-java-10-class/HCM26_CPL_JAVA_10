import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ArrowUpRight, ChevronLeft, ChevronRight, Copy, Eye, Loader2, MoreVertical, Search, SlidersHorizontal, Star, Users, X } from "lucide-react";
import { toast } from "sonner";
import { workspaceApi } from "@/api/features/workspace.api";
import { usePermissions } from "@/hooks/usePermissions";
import type { WorkspaceMember } from "@/types/features/workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getWorkspaceError } from "./workspace.shared";
import { WorkspaceSectionState } from "./WorkspaceSectionState";

type MemberRole = WorkspaceMember["roles"][number];
type RoleFilter = "all" | "unassigned" | MemberRole;
type MemberSort = "allocation" | "name-asc" | "name-desc" | "code";

const PAGE_SIZE = 10;
const ROLES: Record<MemberRole, { label: string; description: string; badge: string; avatar: string }> = {
  PM: { label: "PM (Leader)", description: "Project Manager · Trưởng nhóm dự án", badge: "rounded-full border-slate-900 bg-slate-900 text-white dark:border-slate-600", avatar: "bg-indigo-600" },
  BA: { label: "BA", description: "Business Analyst · Phân tích nghiệp vụ", badge: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-400", avatar: "bg-sky-500" },
  QA: { label: "QA", description: "Quality Assurance · Đảm bảo chất lượng", badge: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400", avatar: "bg-amber-500" },
  DEV: { label: "DEV", description: "Developer · Phát triển sản phẩm", badge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400", avatar: "bg-emerald-600" },
};
const SORT_OPTIONS: { value: MemberSort; label: string }[] = [
  { value: "allocation", label: "Thứ tự phân bổ" },
  { value: "name-asc", label: "Tên: A → Z" },
  { value: "name-desc", label: "Tên: Z → A" },
  { value: "code", label: "Mã thành viên" },
];

function searchable(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").replace(/\s+/g, " ").toLocaleLowerCase("vi");
}

function MemberAvatar({ member, large = false }: { member: WorkspaceMember; large?: boolean }) {
  const words = member.display_name.trim().split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? [words[0], words[words.length - 1]] : words).map(word => Array.from(word)[0]).join("").toUpperCase();
  const role = (Object.keys(ROLES) as MemberRole[]).find(item => member.roles.includes(item));
  return <span aria-hidden="true" className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-background", large ? "size-12 text-sm" : "size-9 text-xs", role ? ROLES[role].avatar : "bg-slate-500")}>{initials || <Users className="size-4" />}</span>;
}

function MemberRoles({ roles }: { roles: WorkspaceMember["roles"] }) {
  return <div className="flex min-w-0 flex-wrap gap-1.5">{roles.length ? roles.map(role => <Badge key={role} variant="outline" title={ROLES[role]?.description} className={cn("max-w-full gap-1 whitespace-normal rounded-md px-2 py-1 text-left text-[11px] font-medium", ROLES[role]?.badge)}>
    {role === "PM" && <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" />}<span className="min-w-0 break-words">{ROLES[role]?.label ?? role}</span>
  </Badge>) : <Badge variant="outline" className="max-w-full whitespace-normal text-[11px] font-normal text-muted-foreground">Chưa phân vai trò</Badge>}</div>;
}

export function WorkspaceMembersPanel({ workspaceId, teamId, classId, allocationSessionId, canViewMembers, onAccessChanged }: {
  workspaceId: number;
  teamId: number;
  classId: number;
  allocationSessionId: number;
  canViewMembers: boolean;
  onAccessChanged?: () => void;
}) {
  const { user, activeRole, hasPermission } = usePermissions();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sort, setSort] = useState<MemberSort>("allocation");
  const [page, setPage] = useState(1);
  const [selectedMember, setSelectedMember] = useState<WorkspaceMember | null>(null);
  const query = useQuery<WorkspaceMember[]>({
    queryKey: ["workspace-members", workspaceId, user.email, activeRole],
    queryFn: ({ signal }) => workspaceApi.getMembers(workspaceId, signal),
    enabled: canViewMembers,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  const denied = isAxiosError(query.error) && query.error.response?.status === 403;
  useEffect(() => { if (denied) onAccessChanged?.(); }, [denied, onAccessChanged]);

  const members = useMemo(() => query.data ?? [], [query.data]);
  const filteredMembers = useMemo(() => {
    const term = searchable(search.trim());
    const result = members.filter(member => (!term || searchable(`${member.display_name} ${member.user_code ?? ""}`).includes(term))
      && (roleFilter === "all" || (roleFilter === "unassigned" ? member.roles.length === 0 : member.roles.includes(roleFilter))));
    if (sort !== "allocation") result.sort((left, right) => {
      if (sort === "code") return (left.user_code ?? "").localeCompare(right.user_code ?? "", "vi", { numeric: true });
      return left.display_name.localeCompare(right.display_name, "vi", { sensitivity: "base" }) * (sort === "name-desc" ? -1 : 1);
    });
    return result;
  }, [members, search, roleFilter, sort]);
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visibleMembers = filteredMembers.slice(start, start + PAGE_SIZE);
  const firstPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => firstPage + index);
  const activeFilters = Number(!!search.trim()) + Number(roleFilter !== "all") + Number(sort !== "allocation");
  const loading = query.isFetching || query.isLoading;
  const canOpenAllocation = hasPermission("PEO_TEAM_ALLOCATE") || hasPermission("PRJ_WORKSPACE_MANAGE");
  const allocationUrl = `/team-allocation/classes/${classId}?sessionId=${allocationSessionId}&teamId=${teamId}`;
  const detail = selectedMember && !loading && !query.isError && members.includes(selectedMember) ? selectedMember : null;
  function resetFilters() { setSearch(""); setRoleFilter("all"); setSort("allocation"); setPage(1); }

  if (denied) return <WorkspaceSectionState denied retry={() => onAccessChanged?.()} />;
  if (!canViewMembers) return <Card><CardHeader><CardTitle>Members</CardTitle></CardHeader><CardContent>You do not have permission to view member details.</CardContent></Card>;

  return <>
    <Card aria-label="Danh sách thành viên" className="min-w-0 gap-0 overflow-hidden border-slate-200/80 py-0 shadow-sm dark:border-border">
      <CardHeader className="grid-rows-1 gap-0 border-b px-4 py-5 [.border-b]:pb-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5"><CardTitle className="text-base font-bold leading-6 sm:text-lg">Danh sách thành viên</CardTitle>{!loading && !query.isError && <Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 px-2.5 text-xs font-medium text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400">{members.length} thành viên</Badge>}</div>
            <CardDescription className="text-xs leading-5">Thành viên và vai trò được đồng bộ từ phân bổ dự án (Project Team Allocation).</CardDescription>
          </div>
          {canOpenAllocation && <Button asChild variant="outline" size="sm" className="text-xs"><Link to={allocationUrl}>Mở phân bổ nhóm<ArrowUpRight className="size-3.5" /></Link></Button>}
        </div>
      </CardHeader>
      {loading ? <div role="status" className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Đang tải thành viên…</div>
        : query.isError ? <div role="alert" className="space-y-3 p-5"><p className="text-sm">{getWorkspaceError(query.error)}</p><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Thử lại</Button></div>
        : <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50/70 px-4 py-3.5 dark:bg-muted/20 sm:px-6">
            <div className="relative min-w-0 flex-1 basis-64 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Tìm thành viên theo tên hoặc mã" placeholder="Tìm theo tên hoặc mã thành viên…" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} className="h-9 rounded-lg bg-background pl-9 pr-9 text-sm" />
              {search && <Button type="button" variant="ghost" size="icon-xs" aria-label="Xóa tìm kiếm" className="absolute right-1.5 top-1/2 -translate-y-1/2" onClick={() => { setSearch(""); setPage(1); }}><X className="size-3.5" /></Button>}
            </div>
            <div className="flex min-w-0 flex-1 basis-64 items-center justify-end gap-2 sm:flex-none sm:basis-auto">
              <Select value={roleFilter} onValueChange={value => { setRoleFilter(value as RoleFilter); setPage(1); }}>
                <SelectTrigger aria-label="Lọc theo vai trò dự án" className="h-9 min-w-0 flex-1 rounded-lg bg-background text-xs sm:w-48 sm:flex-none"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Tất cả vai trò</SelectItem>{(Object.keys(ROLES) as MemberRole[]).map(role => <SelectItem key={role} value={role}>{ROLES[role].label}</SelectItem>)}<SelectItem value="unassigned">Chưa phân vai trò</SelectItem></SelectContent>
              </Select>
              <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" size="sm" aria-label="Bộ lọc và sắp xếp thành viên" className={cn("h-9 rounded-lg text-xs", activeFilters > 0 && "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400")}><SlidersHorizontal className="size-3.5" />Bộ lọc{activeFilters > 0 && <span className="flex size-4 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">{activeFilters}</span>}</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56"><DropdownMenuLabel className="text-xs">Sắp xếp danh sách</DropdownMenuLabel><DropdownMenuRadioGroup value={sort} onValueChange={value => { setSort(value as MemberSort); setPage(1); }}>{SORT_OPTIONS.map(option => <DropdownMenuRadioItem key={option.value} value={option.value} className="text-xs">{option.label}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup><DropdownMenuSeparator /><DropdownMenuItem disabled={!activeFilters} onSelect={resetFilters} className="text-xs"><X className="size-3.5" />Xóa bộ lọc</DropdownMenuItem></DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {visibleMembers.length ? <Table aria-label="Bảng thành viên workspace" className="table-fixed">
            <TableHeader className="bg-slate-50/50 dark:bg-muted/10"><TableRow className="hover:bg-transparent">
              <TableHead scope="col" className="hidden w-[22%] px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground md:table-cell sm:px-6">Mã thành viên</TableHead>
              <TableHead scope="col" className="w-[48%] px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-6 md:w-[38%]">Thành viên</TableHead>
              <TableHead scope="col" className="w-[28%] whitespace-normal px-2 py-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-6">Vai trò dự án</TableHead>
              <TableHead scope="col" className="w-16 px-2 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:w-24 sm:px-6"><span className="hidden sm:inline">Thao tác</span><span className="sr-only sm:hidden">Thao tác</span></TableHead>
            </TableRow></TableHeader>
            <TableBody>{visibleMembers.map((member, index) => <TableRow key={member.user_code ?? `${member.display_name}-${start + index}`} className="hover:bg-slate-50/70 dark:hover:bg-muted/20">
              <TableCell className="hidden whitespace-normal px-4 py-3.5 md:table-cell sm:px-6"><span className="inline-block max-w-full break-words rounded-md border border-slate-200/70 bg-slate-100/80 px-2 py-1 font-mono text-[11px] dark:border-border dark:bg-muted/50">{member.user_code || "Chưa có mã"}</span></TableCell>
              <TableCell className="whitespace-normal px-4 py-3.5 sm:px-6"><div className="flex min-w-0 items-center gap-2.5"><MemberAvatar member={member} /><div className="min-w-0"><p className="break-words text-xs font-semibold leading-5">{member.display_name}</p><p className="mt-0.5 break-words font-mono text-[10px] leading-4 text-muted-foreground md:hidden">{member.user_code || "Chưa có mã"}</p></div></div></TableCell>
              <TableCell className="whitespace-normal px-2 py-3.5 sm:px-6"><MemberRoles roles={member.roles} /></TableCell>
              <TableCell className="px-1 py-3.5 sm:px-4"><div className="flex items-center justify-end">
                <Button type="button" variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400" aria-label={`Xem thông tin ${member.display_name}`} title="Xem thông tin" onClick={() => setSelectedMember(member)}><Eye className="size-4" /></Button>
                <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon-xs" className="text-muted-foreground" aria-label={`Thao tác với ${member.display_name}`}><MoreVertical className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="max-w-[calc(100vw-2rem)]">
                  <DropdownMenuItem onSelect={() => setSelectedMember(member)} className="text-xs"><Eye className="size-3.5" />Xem chi tiết</DropdownMenuItem>
                  {member.user_code && <DropdownMenuItem className="text-xs" onSelect={async () => { try { await navigator.clipboard.writeText(member.user_code!); toast.success("Đã sao chép mã thành viên."); } catch { toast.error("Không thể sao chép. Hãy chọn mã thành viên để sao chép thủ công."); } }}><Copy className="size-3.5" />Sao chép mã thành viên</DropdownMenuItem>}
                  {canOpenAllocation && <><DropdownMenuSeparator /><DropdownMenuItem asChild className="text-xs"><Link to={allocationUrl}><ArrowUpRight className="size-3.5" />Mở phân bổ nhóm</Link></DropdownMenuItem></>}
                </DropdownMenuContent></DropdownMenu>
              </div></TableCell>
            </TableRow>)}</TableBody>
          </Table> : <div className="flex flex-col items-center gap-2 px-4 py-9 text-center"><span className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">{members.length ? <Search className="size-5" /> : <Users className="size-5" />}</span><p className="text-sm font-medium">{members.length ? "Không tìm thấy thành viên phù hợp" : "Chưa có thành viên trong nhóm"}</p><p className="max-w-sm text-xs leading-5 text-muted-foreground">{members.length ? "Thử tìm theo tên, mã thành viên hoặc chọn vai trò khác." : "Thành viên được phân công cho nhóm sẽ xuất hiện tại đây."}</p>{activeFilters > 0 && <Button type="button" variant="outline" size="sm" className="mt-1 text-xs" onClick={resetFilters}>Xóa bộ lọc</Button>}</div>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3.5 sm:px-6">
            <p role="status" className="text-xs leading-5 text-muted-foreground">Hiển thị <strong className="font-medium text-foreground">{filteredMembers.length ? start + 1 : 0} – {Math.min(start + PAGE_SIZE, filteredMembers.length)}</strong> trên tổng số <strong className="font-medium text-foreground">{filteredMembers.length}</strong> thành viên{activeFilters > 0 && <span> (từ {members.length} thành viên)</span>}</p>
            <nav aria-label="Phân trang thành viên" className="flex items-center gap-1.5"><Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" aria-label="Trang trước" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="size-3.5" /><span className="hidden sm:inline">Trước</span></Button>{pages.map(value => <Button type="button" key={value} variant="outline" size="icon-xs" aria-label={`Trang ${value}`} aria-current={currentPage === value ? "page" : undefined} onClick={() => setPage(value)} className={cn("size-7 text-xs", currentPage === value && "border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:text-white dark:border-blue-500")}>{value}</Button>)}<Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" aria-label="Trang sau" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}><span className="hidden sm:inline">Sau</span><ChevronRight className="size-3.5" /></Button></nav>
          </div>
        </>}
    </Card>
    <Dialog open={!!detail} onOpenChange={open => { if (!open) setSelectedMember(null); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Chi tiết thành viên</DialogTitle><DialogDescription>Thông tin và vai trò trong nhóm dự án.</DialogDescription></DialogHeader>
        {detail && <div className="space-y-4">
          <div className="flex min-w-0 items-center gap-3 rounded-xl border bg-muted/20 p-3"><MemberAvatar member={detail} large /><div className="min-w-0"><p className="break-words text-sm font-semibold">{detail.display_name}</p><p className="mt-1 break-words font-mono text-xs text-muted-foreground">{detail.user_code || "Chưa có mã thành viên"}</p></div></div>
          <section className="space-y-3" aria-label="Vai trò thành viên"><h3 className="text-xs font-medium">Vai trò dự án</h3><MemberRoles roles={detail.roles} />{detail.roles.length > 0 && <ul className="space-y-1.5 text-xs leading-5 text-muted-foreground">{detail.roles.map(role => <li key={role}>{ROLES[role]?.description ?? role}</li>)}</ul>}</section>
          <p className="rounded-lg bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">Phân công thành viên và vai trò được quản lý tại mục Phân bổ nhóm.</p>
        </div>}
        <DialogFooter>{canOpenAllocation && <Button type="button" asChild variant="outline" size="sm"><Link to={allocationUrl}>Mở phân bổ nhóm<ArrowUpRight className="size-3.5" /></Link></Button>}<Button type="button" size="sm" className="border border-transparent bg-black text-white hover:bg-black/85 dark:border-slate-600" onClick={() => setSelectedMember(null)}>Đóng</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
