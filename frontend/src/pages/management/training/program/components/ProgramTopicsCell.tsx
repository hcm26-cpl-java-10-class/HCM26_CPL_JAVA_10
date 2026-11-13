import { useState, useRef, useMemo } from "react";
import type { ProgramSubjectItem } from "@/types/features/content";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Clock, Search, Layers, ChevronRight } from "lucide-react";

interface ProgramTopicsCellProps {
  subjects?: ProgramSubjectItem[];
  programCode?: string;
  programName?: string;
  onViewDetail?: () => void;
}

export function ProgramTopicsCell({
  subjects = [],
  programCode,
  programName,
  onViewDetail,
}: ProgramTopicsCellProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sortedSubjects = useMemo(() => {
    return [...subjects].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  }, [subjects]);

  const totalDuration = useMemo(() => {
    return sortedSubjects.reduce((sum, s) => sum + (s.durationHours || 0), 0);
  }, [sortedSubjects]);

  const filteredSubjects = useMemo(() => {
    if (!searchTerm.trim()) return sortedSubjects;
    const q = searchTerm.toLowerCase();
    return sortedSubjects.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        (s.name && s.name.toLowerCase().includes(q))
    );
  }, [sortedSubjects, searchTerm]);

  // Hover handlers for smooth preview on hover
  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setOpen(true);
  };

  const handleMouseLeave = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 200);
  };

  if (!sortedSubjects || sortedSubjects.length === 0) {
    return <span className="text-gray-400 text-xs italic">No topics</span>;
  }

  // Display max 2 badges in the compact cell view
  const visibleSubjects = sortedSubjects.slice(0, 2);
  const remainingCount = sortedSubjects.length - visibleSubjects.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        className="inline-flex items-center gap-1.5 flex-nowrap"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Visible Badges with individual tooltips */}
        {visibleSubjects.map((s) => (
          <Tooltip key={s.subjectId || s.id || s.code}>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 cursor-default transition-colors max-w-[110px] truncate shadow-2xs">
                {s.code}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs max-w-xs space-y-0.5">
              <p className="font-semibold text-slate-100">{s.code}</p>
              <p className="text-slate-300 text-[11px]">{s.name}</p>
              {s.durationHours ? (
                <p className="text-purple-300 text-[10px]">
                  Duration: {s.durationHours} hours
                </p>
              ) : null}
            </TooltipContent>
          </Tooltip>
        ))}

        {/* Counter Badge if > 2 topics */}
        {remainingCount > 0 && (
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:hover:bg-purple-900/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition-all cursor-pointer shadow-2xs hover:shadow-xs group"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((prev) => !prev);
              }}
            >
              <Layers className="size-3 text-purple-500 group-hover:scale-110 transition-transform" />
              <span>+{remainingCount}</span>
            </button>
          </PopoverTrigger>
        )}

        {/* If subjects <= 2, provide an icon trigger to also inspect full details */}
        {remainingCount === 0 && (
          <PopoverTrigger asChild>
            <button
              type="button"
              className="p-1 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50 transition-colors"
              title="View topic details"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((prev) => !prev);
              }}
            >
              <Layers className="size-3.5" />
            </button>
          </PopoverTrigger>
        )}
      </div>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[360px] p-0 shadow-xl border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-gray-900 z-50 animate-in fade-in-0 zoom-in-95"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 dark:from-purple-950/40 dark:via-indigo-950/30 dark:to-blue-950/20 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
                <BookOpen className="size-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                  Course Topics
                </h4>
                {programCode && (
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono truncate max-w-[180px]">
                    {programCode} {programName ? `• ${programName}` : ""}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge
                variant="secondary"
                className="bg-white/90 dark:bg-gray-800 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 text-[11px] font-semibold px-2 py-0.5"
              >
                {sortedSubjects.length} topics
              </Badge>
            </div>
          </div>
        </div>

        {/* Search bar when list has more than 4 items */}
        {sortedSubjects.length > 4 && (
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/60">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search topics by code or name..."
                className="h-7 text-xs pl-8 pr-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              />
            </div>
          </div>
        )}

        {/* Topics List */}
        <ScrollArea className="max-h-[260px] overflow-y-auto">
          {filteredSubjects.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400">
              No matching topics found
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredSubjects.map((s, idx) => (
                <div
                  key={s.subjectId || s.id || s.code}
                  className="px-3.5 py-2.5 flex items-start justify-between gap-3 hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="size-5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] flex items-center justify-center font-medium shrink-0 mt-0.5 border border-gray-200/60 dark:border-gray-700">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          {s.code}
                        </span>
                        {s.version && (
                          <span className="text-[10px] text-gray-400 font-mono">
                            v{s.version}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-1 leading-snug">
                        {s.name || "—"}
                      </p>
                    </div>
                  </div>

                  {s.durationHours !== undefined && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 font-medium shrink-0 mt-0.5 bg-gray-50 dark:bg-gray-800/80 px-2 py-0.5 rounded-full border border-gray-200/60 dark:border-gray-700">
                      <Clock className="size-3 text-gray-400" />
                      {s.durationHours}h
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-900/90 px-4 py-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1 text-[11px]">
            <Clock className="size-3 text-gray-400" />
            <span>Total: <b>{totalDuration}</b> hours</span>
          </div>
          {onViewDetail && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onViewDetail();
              }}
              className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 font-medium text-[11px] inline-flex items-center gap-1 hover:underline cursor-pointer"
            >
              View details <ChevronRight className="size-3" />
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
