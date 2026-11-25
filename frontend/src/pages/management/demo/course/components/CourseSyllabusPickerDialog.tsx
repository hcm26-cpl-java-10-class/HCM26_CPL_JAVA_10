import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, CheckCircle2, Loader2, Search } from "lucide-react";

import { syllabusApi, type SyllabusSummary } from "@/api/features/demo/syllabus.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

type PickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const isReady = (syllabus: SyllabusSummary) =>
  syllabus.status === "PUBLISHED" && syllabus.isActive === true;

/**
 * Entry point from Courses. No Course is created here; we only choose an
 * eligible Syllabus, then reuse the existing two-column Course draft screen.
 */
export function CourseSyllabusPickerDialog({ open, onOpenChange }: PickerProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [selected, setSelected] = useState<SyllabusSummary | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), 350);

  const syllabusesQuery = useQuery({
    queryKey: ["course-create-syllabus-picker", debouncedSearch],
    queryFn: () => syllabusApi.list(debouncedSearch),
    enabled: open,
    staleTime: 30_000,
    retry: false,
  });

  const matching = useMemo(() => {
    const list = syllabusesQuery.data ?? [];
    const term = debouncedSearch.toLocaleLowerCase();
    // Client-side check is helpful when older backends return an unfiltered list.
    return list.filter((item) =>
      !term || `${item.code} ${item.name}`.toLocaleLowerCase().includes(term)
    ).sort((a, b) => {
      if (isReady(a) !== isReady(b)) return isReady(a) ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [syllabusesQuery.data, debouncedSearch]);

  const eligibleCount = matching.filter(isReady).length;
  const visible = showUnavailable ? matching : matching.filter(isReady);
  const currentlySelected = selected && visible.some((item) => item.id === selected.id)
    ? selected
    : null;

  function resetAndClose(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setSearch("");
      setShowUnavailable(false);
      setSelected(null);
    }
  }

  function continueToCourse() {
    if (!currentlySelected || !isReady(currentlySelected)) return;
    resetAndClose(false);
    navigate(`/syllabuses/${currentlySelected.id}/create-course`);
  }

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="w-[min(96vw,720px)] max-w-none gap-0 overflow-hidden p-0 sm:max-w-[720px]">
        <DialogHeader className="border-b px-5 pb-4 pt-5 pr-12">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="size-5" /> Select a Syllabus
          </DialogTitle>
          <DialogDescription>
            Search by syllabus name or code. Choose a published, active Syllabus to prepare a Course Draft.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-5 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search Syllabuses by name or code"
              placeholder="Search by code or syllabus name..."
              className="pl-9"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setSelected(null); }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {syllabusesQuery.isPending ? "Searching Syllabuses..." :
                `${eligibleCount} published & active Syllabus${eligibleCount === 1 ? "" : "es"} available`}
            </span>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={showUnavailable}
                onChange={(event) => { setShowUnavailable(event.target.checked); setSelected(null); }}
                className="size-4 accent-primary"
              />
              Show drafts / inactive
            </label>
          </div>

          <ScrollArea className="h-[min(44vh,340px)] rounded-lg border">
            <div className="space-y-2 p-2" role="listbox" aria-label="Available Syllabuses">
              {syllabusesQuery.isPending && (
                <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading Syllabuses...
                </div>
              )}
              {syllabusesQuery.isError && (
                <div className="space-y-3 py-10 text-center text-sm">
                  <p>Could not load Syllabuses. Check your Backend connection or access rights.</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => void syllabusesQuery.refetch()}>
                    Retry
                  </Button>
                </div>
              )}
              {syllabusesQuery.isSuccess && visible.length === 0 && (
                <div className="space-y-1 py-12 text-center text-sm">
                  <p className="font-medium">No matching Syllabuses available</p>
                  <p className="text-muted-foreground">
                    {matching.length > 0
                      ? "Matching Syllabuses are not yet published and active. Enable 'Show drafts / inactive' to review them."
                      : "Try another code or name, or publish and activate a Syllabus first."}
                  </p>
                </div>
              )}
              {syllabusesQuery.isSuccess && visible.map((item) => {
                const ready = isReady(item);
                const chosen = currentlySelected?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={chosen}
                    disabled={!ready}
                    onClick={() => setSelected(item)}
                    className={`flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${
                      chosen ? "border-primary bg-primary/5 ring-1 ring-primary" :
                      ready ? "hover:border-primary/50 hover:bg-accent/40" : "cursor-not-allowed opacity-60"
                    }`}
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{item.name}</span>
                        <Badge variant="outline">{item.code}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant={ready ? "secondary" : "outline"}>
                          {item.status === "PUBLISHED" ? "Published" : "Draft"}
                        </Badge>
                        {!item.isActive && <Badge variant="outline">Inactive</Badge>}
                        <span>{item.sectionCount} section{item.sectionCount === 1 ? "" : "s"}</span>
                        <span>Completion {item.completionPercent}%</span>
                      </div>
                    </div>
                    <span className="shrink-0 pt-1" aria-hidden="true">
                      {chosen ? <CheckCircle2 className="size-5 text-primary" /> :
                        ready ? <span className="block size-5 rounded-full border-2 border-muted-foreground/50" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          <p className="min-h-5 text-xs text-muted-foreground" aria-live="polite">
            {currentlySelected ? `Selected: ${currentlySelected.code} — ${currentlySelected.name}` :
              "Choose one Syllabus to continue. You can select Full or Focused Course on the next screen."}
          </p>
        </div>

        <DialogFooter className="mx-0 mb-0 rounded-b-xl">
          <Button type="button" variant="outline" onClick={() => resetAndClose(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!currentlySelected} onClick={continueToCourse}>
            Continue to Course Draft <ArrowRight className="ml-2 size-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
