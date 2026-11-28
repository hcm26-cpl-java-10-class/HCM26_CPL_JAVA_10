import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MOCK_CLASS_CONTEXT, getActiveProjectTemplates } from "@/mocks/project-templates.mock";
import type { ProjectTemplate } from "@/types";
import { CheckCircle2, RotateCcw, Search, SearchX, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ProjectTemplateCard } from "./ProjectTemplateCard";
import {
  DURATION_OPTIONS,
  LEVEL_OPTIONS,
  type DurationFilter,
  type LevelFilter,
  matchesDuration,
} from "./explore.constants";
import { setSelectedProjectId, useSelectedProjectId } from "./selection.store";

/**
 * US-09 - Browse Active Project Templates for Class.
 * <p>
 * Route: `/student/projects/explore` (Project Management tab).
 * The catalogue is mock data because the Project Template module has no
 * backend endpoint yet; the filtering (keyword / domain / level / duration)
 * and the ACTIVE-only rule mirror the future API behaviour.
 * <p>
 * Opening a brief navigates to the dedicated detail page
 * `/student/projects/detail/:projectId` (no modal).
 */
export default function ExploreProjectsPage() {
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("ALL");
  const [level, setLevel] = useState<LevelFilter>("ALL");
  const [duration, setDuration] = useState<DurationFilter>("ALL");
  const selectedId = useSelectedProjectId();

  /** ACTIVE templates only - DRAFT/ARCHIVED rows never reach the UI. */
  const templates = useMemo(() => getActiveProjectTemplates(), []);

  const domainOptions = useMemo(
    () => [...new Set(templates.map((template) => template.domain))].sort(),
    [templates],
  );

  const filteredTemplates = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return templates.filter((template) => {
      if (domain !== "ALL" && template.domain !== domain) return false;
      if (level !== "ALL" && template.level !== level) return false;
      if (!matchesDuration(template.durationWeeks, duration)) return false;
      if (!keyword) return true;

      const haystack = [
        template.name,
        template.code,
        template.description,
        template.domain,
        ...template.technologies,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [templates, search, domain, level, duration]);

  const selectedTemplate =
    templates.find((template) => template.projectId === selectedId) ?? null;

  const hasActiveFilters =
    search.trim().length > 0 ||
    domain !== "ALL" ||
    level !== "ALL" ||
    duration !== "ALL";

  const clearFilters = () => {
    setSearch("");
    setDomain("ALL");
    setLevel("ALL");
    setDuration("ALL");
  };

  const handleSelect = (template: ProjectTemplate) => {
    const nextIsNew = selectedId !== template.projectId;
    setSelectedProjectId(template.projectId);

    if (nextIsNew) {
      toast.success(`"${template.name}" selected for your team.`);
    }
  };

  return (
    <MainLayout pathName={{ projects: "Project Management", explore: "Explore Projects" }}>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[28px] font-bold tracking-tight text-slate-900 dark:text-foreground">
              Choose your Mock Project
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-muted-foreground">
              Compare real-world briefs for{" "}
              <span className="font-medium text-slate-700 dark:text-foreground">
                {MOCK_CLASS_CONTEXT.className} · {MOCK_CLASS_CONTEXT.programName}
              </span>{" "}
              before your team confirms one project.
            </p>
          </div>

          <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 dark:border-border dark:bg-card dark:text-foreground">
            {selectedTemplate ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="max-w-[240px] truncate">
                  Selected: {selectedTemplate.name}
                </span>
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                No project selected
              </>
            )}
          </span>
        </div>

        <section
          aria-label="Catalogue filters"
          className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-search" className="text-xs font-medium text-slate-500 dark:text-muted-foreground">
              Search
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="project-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, code or skill…"
                autoComplete="off"
                className="h-9 rounded-lg border-slate-200 bg-white pl-9 text-sm shadow-xs dark:border-border dark:text-foreground dark:placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-domain" className="text-xs font-medium text-slate-500 dark:text-muted-foreground">
              Domain
            </Label>
            <Select value={domain} onValueChange={setDomain}>
              <SelectTrigger
                id="project-domain"
                className="h-9 w-full rounded-lg border-slate-200 bg-white text-sm text-slate-700 shadow-xs dark:border-border dark:text-foreground dark:hover:bg-input/50"
              >
                <SelectValue placeholder="All domains" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All domains</SelectItem>
                {domainOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-level" className="text-xs font-medium text-slate-500 dark:text-muted-foreground">
              Difficulty
            </Label>
            <Select
              value={level}
              onValueChange={(value) => setLevel(value as LevelFilter)}
            >
              <SelectTrigger
                id="project-level"
                className="h-9 w-full rounded-lg border-slate-200 bg-white text-sm text-slate-700 shadow-xs dark:border-border dark:text-foreground dark:hover:bg-input/50"
              >
                <SelectValue placeholder="All levels" />
              </SelectTrigger>
              <SelectContent>
                {LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-duration" className="text-xs font-medium text-slate-500 dark:text-muted-foreground">
              Duration
            </Label>
            <Select
              value={duration}
              onValueChange={(value) => setDuration(value as DurationFilter)}
            >
              <SelectTrigger
                id="project-duration"
                className="h-9 w-full rounded-lg border-slate-200 bg-white text-sm text-slate-700 shadow-xs dark:border-border dark:text-foreground dark:hover:bg-input/50"
              >
                <SelectValue placeholder="All durations" />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            Only ACTIVE templates in your class scope are listed
          </span>
          <span>
            {filteredTemplates.length} of {templates.length} brief
            {templates.length === 1 ? "" : "s"} match your filters
          </span>
        </div>

        {filteredTemplates.length > 0 ? (
          <section
            aria-label="Project template catalogue"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            {filteredTemplates.map((template) => (
              <ProjectTemplateCard
                key={template.projectId}
                template={template}
                isSelected={selectedId === template.projectId}
                onSelect={handleSelect}
              />
            ))}
          </section>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-16 text-center dark:border-border dark:bg-card/50">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm dark:bg-muted dark:text-muted-foreground">
              <SearchX className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-foreground">
                No project briefs match your filters
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-muted-foreground">
                Try another keyword, domain, difficulty or duration.
              </p>
            </div>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-border dark:bg-muted dark:text-foreground dark:hover:bg-muted/70"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Clear filters
              </Button>
            )}
          </div>
        )}

        <p className="text-[11px] text-slate-400 dark:text-muted-foreground">
          Mock catalogue for US-09 · Templates are filtered by the class data
          scope (tenant / program) before they reach this page.
        </p>
      </div>
    </MainLayout>
  );
}
