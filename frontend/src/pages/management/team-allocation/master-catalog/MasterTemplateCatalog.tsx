import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, LayoutGrid, LibraryBig, List, LoaderCircle, Search, SearchX, SlidersHorizontal, X,
} from "lucide-react";
import { projectAssignmentApi } from "@/api/features/project-assignment.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import type { AssignmentTemplateSummary } from "@/types/features/project-assignment";
import { MasterTemplateCard } from "./MasterTemplateCard";
import { MasterTemplateRow } from "./MasterTemplateRow";
import { filterChip, levelStyle } from "./catalog-styles";
import {
  assignmentFailure, CATALOG_PAGE_SIZE, catalogLevelOptions, catalogSortOptions, catalogUrlKeys, levelLabel, readCatalogFilter,
} from "./master-catalog.utils";

const selectClass = "h-9 w-full rounded-md border bg-background px-3 text-sm shadow-xs";
const VIEW_STORAGE_KEY = "fams.master-catalog.view";
type UrlKey = (typeof catalogUrlKeys)[number];
type CatalogView = "list" | "grid";

function storedView(): CatalogView {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

export function MasterTemplateCatalog({ classId, sessionId, teamId, selectedId, onSelect, onPreview, onCancel }: {
  classId: number;
  sessionId: number;
  /** Team-scoped assignment: the "fits team size" filter checks this team only. */
  teamId: number | null;
  selectedId: number | null;
  onSelect: (template: AssignmentTemplateSummary) => void;
  onPreview: (template: AssignmentTemplateSummary) => void;
  /** Shown while changing an existing selection, to keep it. */
  onCancel?: () => void;
}) {
  const { user, activeRole } = usePermissions();
  const [params, setParams] = useSearchParams();
  const filter = readCatalogFilter(params);
  const [searchInput, setSearchInput] = useState(filter.search);
  const [view, setView] = useState<CatalogView>(storedView);
  const debounce = useRef<number | undefined>(undefined);

  useEffect(() => {
    const timer = debounce;
    return () => window.clearTimeout(timer.current);
  }, []);

  const catalog = useQuery({
    queryKey: ["master-assignment-templates", classId, sessionId, user.email, activeRole,
      filter.search, filter.category, filter.level, filter.fit, filter.sort, filter.page, teamId],
    queryFn: ({ signal }) => projectAssignmentApi.templates(classId, sessionId,
      { ...filter, size: CATALOG_PAGE_SIZE, teamId }, signal),
    placeholderData: keepPreviousData,
    retry: false,
  });

  function update(patch: Partial<Record<UrlKey, string | null>>) {
    setParams(current => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      if (!("page" in patch)) next.delete("page");
      return next;
    }, { replace: true });
  }

  function changeView(next: CatalogView) {
    setView(next);
    try { window.localStorage.setItem(VIEW_STORAGE_KEY, next); } catch { /* the choice just is not remembered */ }
  }

  function changeSearch(value: string) {
    setSearchInput(value);
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => update({ q: value.trim() || null }), 300);
  }

  function clearSearch() {
    window.clearTimeout(debounce.current);
    setSearchInput("");
    update({ q: null });
  }

  function clearFilters() {
    window.clearTimeout(debounce.current);
    setSearchInput("");
    update(Object.fromEntries(catalogUrlKeys.map(key => [key, null])));
  }

  const data = catalog.data;
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const fitLabel = teamId == null ? "Vừa sĩ số Team" : "Vừa sĩ số Team này";
  const activeChips: Array<{ key: Exclude<UrlKey, "sort" | "page">; label: string }> = [];
  if (filter.search) activeChips.push({ key: "q", label: `“${filter.search}”` });
  if (filter.category) activeChips.push({ key: "category", label: filter.category });
  if (filter.level) activeChips.push({ key: "level", label: levelLabel(filter.level) ?? filter.level });
  if (filter.fit) activeChips.push({ key: "fit", label: fitLabel });
  const panelFilterCount = [filter.category, filter.level, filter.fit].filter(Boolean).length;

  function clearChip(key: (typeof activeChips)[number]["key"]) {
    if (key === "q") clearSearch();
    else update({ [key]: null });
  }

  return <Card className="gap-4">
    <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
          <LibraryBig className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-1">
          <CardTitle>Thư viện đề bài Master</CardTitle>
          <CardDescription>Các đề bài đã công bố. Bấm vào một đề để xem trước khi chọn.</CardDescription>
        </div>
      </div>
      {onCancel && <Button variant="ghost" size="sm" onClick={onCancel}><X className="size-4" /> Giữ đề đã chọn</Button>}
    </CardHeader>
    <CardContent className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <form role="search" className="relative min-w-56 flex-1" onSubmit={event => {
          event.preventDefault();
          window.clearTimeout(debounce.current);
          update({ q: searchInput.trim() || null });
        }}>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Tìm đề bài Master" className="pr-9 pl-9" placeholder="Tìm theo mã, tên hoặc công nghệ"
            value={searchInput} maxLength={100} onChange={event => changeSearch(event.target.value)} />
          {searchInput && <button type="button" aria-label="Xóa từ khóa" onClick={clearSearch}
            className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-3.5" /></button>}
        </form>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className={panelFilterCount ? "border-blue-300 dark:border-blue-800" : ""}>
              <SlidersHorizontal className="size-4" /> Bộ lọc
              {panelFilterCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-blue-600 text-[11px] font-semibold text-white dark:bg-blue-500">
                {panelFilterCount}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="grid w-80 gap-4">
            <div role="group" aria-label="Lọc theo độ khó" className="grid gap-2">
              <span className="text-xs font-medium text-muted-foreground">Độ khó</span>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" aria-pressed={!filter.level} onClick={() => update({ level: null })}
                  className={"rounded-full border px-3 py-1 text-xs font-medium transition-colors "
                    + (!filter.level ? "border-foreground/20 bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground")}>
                  Tất cả
                </button>
                {catalogLevelOptions.map(option => {
                  const active = filter.level === option.value;
                  const style = levelStyle(option.value);
                  return <button key={option.value} type="button" aria-pressed={active}
                    onClick={() => update({ level: active ? null : option.value })}
                    className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors "
                      + (active ? style.pill + " ring-1 ring-current/20" : "bg-background text-muted-foreground hover:text-foreground")}>
                    <span aria-hidden="true" className={"size-1.5 rounded-full " + style.dot} />{option.label}
                  </button>;
                })}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="catalog-category" className="text-xs text-muted-foreground">Danh mục</Label>
              <select id="catalog-category" className={selectClass} value={filter.category}
                onChange={event => update({ category: event.target.value || null })}>
                <option value="">Tất cả danh mục</option>
                {filter.category && !data?.categories.includes(filter.category) &&
                  <option value={filter.category}>{filter.category}</option>}
                {data?.categories.map(category => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
            <label className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">{fitLabel}</span>
                <span className="text-xs text-muted-foreground">{teamId == null
                  ? "Chỉ hiện đề có sĩ số phù hợp với ít nhất một Team trong phiên."
                  : "Chỉ hiện đề có sĩ số phù hợp với Team đang gán."}</span>
              </span>
              <Switch checked={filter.fit} onCheckedChange={checked => update({ fit: checked ? "1" : null })}
                className="mt-0.5 data-[state=checked]:bg-emerald-500" />
            </label>
            {panelFilterCount > 0 && <Button type="button" variant="ghost" size="sm" className="justify-self-start"
              onClick={() => update({ category: null, level: null, fit: null })}>Bỏ các bộ lọc</Button>}
          </PopoverContent>
        </Popover>
        <select aria-label="Sắp xếp" className={selectClass + " w-auto"} value={filter.sort}
          onChange={event => update({ sort: event.target.value === "NAME" ? null : event.target.value })}>
          {catalogSortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      {activeChips.length > 0 && <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">Đang lọc:</span>
        {activeChips.map(chip => <span key={chip.key} className={"inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 font-medium " + filterChip}>
          {chip.label}
          <button type="button" aria-label={`Bỏ lọc ${chip.label}`} onClick={() => clearChip(chip.key)}
            className="grid size-4 place-items-center rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50"><X className="size-3" /></button>
        </span>)}
        <Button type="button" variant="link" size="sm" className="h-auto px-1 text-xs" onClick={clearFilters}>Xóa tất cả</Button>
      </div>}

      {catalog.isPending ? <div role="status" aria-label="Đang tải thư viện" className="grid divide-y overflow-hidden rounded-xl border">
        {Array.from({ length: 5 }, (_, index) => <div key={index} className="flex items-center gap-4 px-3 py-3">
          <div className="grid flex-1 gap-1.5"><Skeleton className="h-3 w-40" /><Skeleton className="h-4 w-3/4" /></div>
          <Skeleton className="h-4 w-32 max-sm:hidden" /><Skeleton className="h-8 w-28" />
        </div>)}
      </div> : catalog.isError ? <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        {assignmentFailure(catalog.error, "Không tải được thư viện đề bài.")}
        <Button variant="outline" size="sm" onClick={() => void catalog.refetch()}>Thử lại</Button>
      </div> : <>
        <div className="flex items-center justify-between gap-2">
          <p aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
            <span><span className="font-semibold text-foreground">{data!.total}</span> đề bài{activeChips.length ? " phù hợp" : ""}</span>
            {catalog.isFetching && <LoaderCircle aria-label="Đang cập nhật" className="size-3.5 animate-spin" />}
          </p>
          <div role="group" aria-label="Kiểu hiển thị" className="inline-flex rounded-md border p-0.5">
            {([["list", List, "Danh sách"], ["grid", LayoutGrid, "Thẻ"]] as const).map(([value, Icon, label]) =>
              <button key={value} type="button" aria-pressed={view === value} title={label} aria-label={`Hiển thị dạng ${label.toLowerCase()}`}
                onClick={() => changeView(value)}
                className={"grid size-7 place-items-center rounded-sm transition-colors "
                  + (view === value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}>
                <Icon className="size-4" />
              </button>)}
          </div>
        </div>
        {data!.items.length === 0 ? <div className="grid justify-items-center gap-3 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          <span className="grid size-12 place-items-center rounded-full bg-muted"><SearchX className="size-6" aria-hidden="true" /></span>
          {data!.total > 0 ? <>
            <p>Trang này không còn đề bài.</p>
            <Button variant="outline" size="sm" onClick={() => update({ page: null })}>Về trang đầu</Button>
          </> : activeChips.length ? <>
            <div><p className="font-medium text-foreground">Không tìm thấy đề bài phù hợp</p><p>Thử bỏ bớt bộ lọc hoặc đổi từ khóa.</p></div>
            <Button variant="outline" size="sm" onClick={clearFilters}>Xóa bộ lọc</Button>
          </> : <p>Chưa có đề bài Master nào được công bố trong thư viện.</p>}
        </div> : view === "list"
          ? <ul className={"divide-y overflow-hidden rounded-xl border transition-opacity " + (catalog.isPlaceholderData ? "opacity-60" : "")}>
            {data!.items.map(template => <li key={template.id} className="min-w-0">
              <MasterTemplateRow template={template} selected={template.id === selectedId} keyword={filter.search}
                onPreview={() => onPreview(template)} onSelect={() => onSelect(template)} />
            </li>)}
          </ul>
          : <ul className={"grid gap-3 transition-opacity sm:grid-cols-2 " + (catalog.isPlaceholderData ? "opacity-60" : "")}>
            {data!.items.map(template => <li key={template.id} className="min-w-0">
              <MasterTemplateCard template={template} selected={template.id === selectedId} keyword={filter.search}
                onPreview={() => onPreview(template)} onSelect={() => onSelect(template)} />
            </li>)}
          </ul>}
        {pageCount > 1 && <nav aria-label="Phân trang thư viện" className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" disabled={filter.page === 0}
            onClick={() => update({ page: filter.page <= 1 ? null : String(filter.page) })}>
            <ChevronLeft className="size-4" /> Trước
          </Button>
          <span className="text-sm text-muted-foreground">Trang <span className="font-medium text-foreground">{filter.page + 1}</span>/{pageCount}</span>
          <Button variant="outline" size="sm" disabled={filter.page + 1 >= pageCount}
            onClick={() => update({ page: String(filter.page + 2) })}>
            Sau <ChevronRight className="size-4" />
          </Button>
        </nav>}
      </>}
    </CardContent>
  </Card>;
}
