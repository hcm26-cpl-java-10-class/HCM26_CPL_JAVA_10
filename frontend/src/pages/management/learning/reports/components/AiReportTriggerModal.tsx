import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reportApi } from "../../components/reports/report-api";
import type { Language, Section } from "../../components/reports/report-api";

interface AiReportTriggerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTitle: string;
  from: string;
  to: string;
  sections: Section[];
}

export function AiReportTriggerModal({
  open,
  onOpenChange,
  defaultTitle,
  from,
  to,
  sections,
}: AiReportTriggerModalProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [language, setLanguage] = useState<Language>("EN");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState<number | null>(null);

  const options = useQuery({
    queryKey: ["learning-report-options"],
    queryFn: ({ signal }) => reportApi.options(signal),
    enabled: open,
  });

  async function handleGenerate() {
    setBusy(true);
    setError("");
    setCreatedId(null);
    try {
      const allowed = options.data?.sections ?? sections;
      const selected = sections.filter((s) => allowed.includes(s));
      const detail = await reportApi.create({
        requestKey: crypto.randomUUID(),
        title: title.trim() || defaultTitle,
        type: "CUSTOM",
        from,
        to,
        language,
        mode: options.data?.aiAvailable ? "AI_ENHANCED" : "STANDARD",
        sections: selected.length > 0 ? selected : ["OVERVIEW"],
      });
      setCreatedId(detail.report.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate AI Personal Learning Report</DialogTitle>
          <DialogDescription>
            Generates a saved report for {from} to {to}. AI recommendations are clearly separated from backend-calculated metrics.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-sm font-medium">Report Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="EN">English</option>
              <option value="VI">Tiếng Việt</option>
            </select>
          </div>
          {options.data && !options.data.aiAvailable && (
            <p className="rounded-md border bg-muted/50 p-2.5 text-xs text-muted-foreground">
              AI provider is currently unavailable. A standard statistical report will be generated instead.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {createdId && (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Report #{createdId} generated!{" "}
              <Link to="/my-learning?tab=reports" className="underline font-medium">
                View in My Learning → Reports
              </Link>
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleGenerate} disabled={busy}>
            {busy ? "Generating..." : "Generate Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
