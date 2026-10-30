import { projectTemplateApi } from "@/api/features/project-template.api";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePermissions } from "@/hooks/usePermissions";
import type { TemplateCandidate, TemplateCandidateFilter } from "@/types/features/template-candidate";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Check, ChevronDown, Eye, Info, LoaderCircle, Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

const emptyFilter: TemplateCandidateFilter = {
  q: "", technologies: [], level: "", category: "", roles: [], outcomes: [], page: 0, size: 12,
};

const splitValues = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
const briefText = (value: unknown) => typeof value === "string" ? value : "";
const briefRows = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((row): row is Record<string, unknown> =>
    typeof row === "object" && row !== null && !Array.isArray(row)) : [];
const levelLabel = (level: TemplateCandidate["level"]) => level ? ({
  BEGINNER: "Cơ bản", INTERMEDIATE: "Trung bình", ADVANCED: "Nâng cao",
})[level] : "Chưa phân loại";

function CandidateRow({ item, selected, onPreview, onSelect }: {
  item: TemplateCandidate;
  selected: boolean;
  onPreview: () => void;
  onSelect: () => void;
}) {
  return <Tooltip>
    <TooltipTrigger asChild>
      <div tabIndex={0} role="group" aria-label={`Đề bài ${item.name}`}
        className={`group flex flex-col gap-3 rounded-lg border px-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:gap-4 ${selected ? "border-primary bg-primary/5" : "hover:border-primary/40 hover:bg-muted/40"}`}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
            {selected ? <Check className="size-4" /> : <span className="text-sm font-semibold">{item.name.charAt(0).toUpperCase()}</span>}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium" title={item.name}>{item.name}</p>
            <p className="truncate text-xs text-muted-foreground">{item.category || "Chưa phân loại"} · {levelLabel(item.level)} · {item.version}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 pl-12 sm:justify-end sm:pl-0">
          <span className={`text-xs ${item.capacityMatch ? "text-muted-foreground" : "font-medium text-amber-700"}`}>
            {item.minMembers}–{item.maxMembers} người{!item.capacityMatch && " · Không phù hợp"}
          </span>
          <Button size="sm" variant="ghost" onClick={onPreview} aria-label={`Xem đầy đủ ${item.name}`}>
            <Eye className="size-4" /> <span className="hidden md:inline">Xem</span>
          </Button>
          <Button size="sm" variant={selected ? "secondary" : "outline"} onClick={onSelect}
            disabled={!item.capacityMatch} aria-label={`Chọn ${item.name}`}>
            {selected ? "Đã chọn" : "Chọn"}
          </Button>
        </div>
      </div>
    </TooltipTrigger>
    <TooltipContent side="right" sideOffset={10}
      className="w-80 max-w-[calc(100vw-3rem)] rounded-xl border border-border bg-popover p-4 text-left text-popover-foreground shadow-xl">
      <div className="space-y-3">
        <div><p className="font-semibold leading-snug">{item.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.code || "Đề bài dự án"} · {item.version}</p></div>
        <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">{item.description || "Chưa có mô tả ngắn."}</p>
        <div className="space-y-1.5 border-t pt-3 text-xs">
          <p><span className="text-muted-foreground">Công nghệ:</span> {item.technologies.join(", ") || "Chưa cập nhật"}</p>
          <p><span className="text-muted-foreground">Vai trò:</span> {item.targetRoles.join(", ") || "Chưa cập nhật"}</p>
          <p><span className="text-muted-foreground">Chuẩn đầu ra:</span> {item.learningOutcomes.join(", ") || "Chưa cập nhật"}</p>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Info className="size-3.5" /> Chọn “Xem” để đọc đề bài đầy đủ</p>
      </div>
    </TooltipContent>
  </Tooltip>;
}

interface Props {
  classId: number;
  sessionId: number;
  teamId: number;
  teamName: string;
  memberCount: number;
  active: boolean;
  selectedTemplateId: number | null;
  onBack: () => void;
  onSelect: (template: TemplateCandidate) => void;
}

export function TemplatePickerPanel({ classId, sessionId, teamId, teamName,
  memberCount, active, selectedTemplateId, onBack, onSelect }: Props) {
  const [keyword, setKeyword] = useState("");
  const [technology, setTechnology] = useState("");
  const [level, setLevel] = useState("");
  const [role, setRole] = useState("");
  const [outcome, setOutcome] = useState("");
  const [category, setCategory] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filter, setFilter] = useState<TemplateCandidateFilter>(emptyFilter);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const identity = usePermissions();

  const results = useQuery({
    queryKey: ["template-candidates", identity.user.email, identity.activeRole,
      classId, sessionId, teamId, filter],
    queryFn: ({ signal }) => projectTemplateApi.searchCandidates(classId, sessionId, teamId, filter, signal),
    enabled: active,
    retry: false,
  });
  const preview = useQuery({
    queryKey: ["template-candidate-preview", identity.user.email, identity.activeRole,
      classId, sessionId, teamId, previewId],
    queryFn: ({ signal }) => projectTemplateApi.previewCandidate(classId, sessionId, teamId, previewId!, signal),
    enabled: active && previewId !== null,
    retry: false,
  });

  const apply = () => {
    setFilter({ q: keyword.trim(), technologies: splitValues(technology), level,
      category: category.trim(), roles: splitValues(role), outcomes: splitValues(outcome), page: 0, size: 12 });
    setPreviewId(null);
    setFiltersOpen(false);
  };
  const clear = () => {
    setKeyword(""); setTechnology(""); setLevel(""); setRole(""); setOutcome(""); setCategory("");
    setFilter(emptyFilter); setPreviewId(null);
  };
  const errorStatus = axios.isAxiosError(results.error) ? results.error.response?.status : null;
  const items = results.data?.content ?? [];
  const activeFilterCount = [filter.technologies.length, filter.level, filter.roles.length,
    filter.outcomes.length, filter.category].filter(Boolean).length;

  return <div className={active ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
          <Button type="button" size="sm" variant="ghost" className="mb-1 w-fit px-0" onClick={onBack}>← Chi tiết nhóm</Button>
          <DialogTitle className="text-lg">Tìm đề bài cho {teamName}</DialogTitle>
          <DialogDescription>Nhóm có {memberCount} thành viên · Chọn đề bài phù hợp trong thư viện</DialogDescription>
        </DialogHeader>
        <form className="shrink-0 space-y-3 border-b bg-muted/20 px-5 py-4" onSubmit={(event) => { event.preventDefault(); apply(); }}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input aria-label="Từ khóa đề bài" placeholder="Tên hoặc mô tả đề bài" value={keyword}
              onChange={(event) => setKeyword(event.target.value)} className="bg-background" />
            <Button type="submit" className="shrink-0"><Search className="size-4" /> Tìm kiếm</Button>
          </div>
          <Button type="button" size="sm" variant="ghost" className="h-8 gap-2 px-1 text-muted-foreground"
            aria-expanded={filtersOpen} onClick={() => setFiltersOpen((current) => !current)}>
            <SlidersHorizontal className="size-3.5" /> Bộ lọc nâng cao
            {activeFilterCount > 0 && <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary">{activeFilterCount}</span>}
            <ChevronDown className={`size-3.5 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
          </Button>
          {filtersOpen && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Input aria-label="Công nghệ" placeholder="Công nghệ: React, Java" value={technology}
              onChange={(event) => setTechnology(event.target.value)} className="bg-background" />
            <select aria-label="Độ khó" className="h-9 rounded-md border bg-background px-3 text-sm" value={level}
              onChange={(event) => setLevel(event.target.value)}>
              <option value="">Mọi độ khó</option><option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Medium</option><option value="ADVANCED">Advanced</option>
            </select>
            <Input aria-label="Vai trò" placeholder="Vai trò: FULLSTACK" value={role}
              onChange={(event) => setRole(event.target.value)} className="bg-background" />
            <Input aria-label="Chuẩn đầu ra" placeholder="Chuẩn đầu ra" value={outcome}
              onChange={(event) => setOutcome(event.target.value)} className="bg-background" />
            <Input aria-label="Phân loại" placeholder="Phân loại" value={category}
              onChange={(event) => setCategory(event.target.value)} className="bg-background" />
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={apply}>Áp dụng</Button>
              <Button type="button" variant="ghost" onClick={clear}>Xóa bộ lọc</Button>
            </div>
          </div>}
        </form>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {previewId !== null ? <div className="space-y-3">
          <Button size="sm" variant="ghost" onClick={() => setPreviewId(null)}>← Kết quả tìm kiếm</Button>
          {preview.isLoading && <p role="status">Đang tải preview...</p>}
          {preview.isError && <div role="alert">Không tải được đề bài. <Button size="sm" onClick={() => void preview.refetch()}>Thử lại</Button></div>}
          {preview.data && <>
            <h3 className="text-lg font-semibold">{preview.data.template.name} · {preview.data.template.version}</h3>
            <p className="whitespace-pre-wrap text-sm">{briefText(preview.data.brief.description)
              || briefText(preview.data.brief.context) || preview.data.template.description}</p>
            <div className="text-sm">Công nghệ: {preview.data.template.technologies.join(", ") || "Chưa phân loại"}</div>
            <div className="text-sm">Vai trò: {preview.data.template.targetRoles.join(", ") || "Chưa phân loại"}</div>
            <div className="text-sm">Chuẩn đầu ra: {preview.data.template.learningOutcomes.join(", ") || "Chưa phân loại"}</div>
            <div className="text-sm">Quy mô: {preview.data.template.minMembers}–{preview.data.template.maxMembers} thành viên</div>
            {briefRows(preview.data.brief.milestones).length > 0 && <section className="space-y-2">
              <h4 className="font-medium">Các mốc dự án</h4>
              {briefRows(preview.data.brief.milestones).map((milestone, index) =>
                <div key={index} className="rounded-md border p-2 text-sm">
                  <p className="font-medium">{index + 1}. {briefText(milestone.title) || briefText(milestone.name)}</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{briefText(milestone.description)}</p>
                  {milestone.dueAfter != null && <p className="text-xs">Thời điểm: {String(milestone.dueAfter)} {briefText(milestone.dueUnit)}</p>}
                </div>)}
            </section>}
            <Button disabled={!preview.data.template.capacityMatch} onClick={() => onSelect(preview.data.template)}>Chọn đề bài này</Button>
          </>}
        </div> : <div className="space-y-3">
          {results.isLoading && <p role="status"><LoaderCircle className="mr-2 inline size-4 animate-spin" />Đang tìm đề bài...</p>}
          {results.isError && <div role="alert">{errorStatus === 403 ? "Bạn không có quyền xem thư viện đề bài của nhóm này." : "Không tải được danh sách đề bài."} <Button size="sm" onClick={() => void results.refetch()}>Thử lại</Button></div>}
          {results.isSuccess && <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm" aria-live="polite">
              <p className="font-medium">{results.data.totalElements} đề bài phù hợp</p>
              <p className="text-xs text-muted-foreground">Rê chuột để xem nhanh · Bấm Xem để đọc đầy đủ</p>
            </div>
            {items.length === 0 && <div className="rounded-lg border p-6 text-center">
              <p>Không tìm thấy đề bài mẫu phù hợp</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Danh sách chỉ gồm đề bài ACTIVE thuộc Tenant/Cohort của nhóm và có phiên bản đã công bố.
              </p>
              <Button variant="outline" className="mt-2" onClick={clear}>Xóa bộ lọc</Button>
            </div>}
            <div className="space-y-2">
              {items.map((item) => <CandidateRow key={item.templateId} item={item}
                selected={selectedTemplateId === item.templateId}
                onPreview={() => setPreviewId(item.templateId)}
                onSelect={() => onSelect(item)} />)}
            </div>
            {results.data.totalPages > 1 && <div className="flex items-center justify-between">
              <Button size="sm" variant="outline" disabled={filter.page === 0}
                onClick={() => setFilter((current) => ({ ...current, page: current.page - 1 }))}>Trước</Button>
              <span>Trang {filter.page + 1}/{results.data.totalPages}</span>
              <Button size="sm" variant="outline" disabled={filter.page + 1 >= results.data.totalPages}
                onClick={() => setFilter((current) => ({ ...current, page: current.page + 1 }))}>Sau</Button>
            </div>}
          </>}
        </div>}
        </div>
  </div>;
}
