import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { locationApi } from "@/api/features/rbac/location.api";
import type { LocationAiAnalysis, LocationAiStatus } from "@/types/features/rbac/location";

export function LocationAiInsights() {
  const [status, setStatus] = useState<LocationAiStatus | null>(null);
  const [analysis, setAnalysis] = useState<LocationAiAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    locationApi.getAiStatus().then(setStatus).catch(() => setStatus({ configured: false }));
  }, []);

  const analyze = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await locationApi.analyzeWithAi();
      setAnalysis(result);
      toast.success(result.configured
        ? "AI hierarchy analysis completed."
        : "Deterministic hierarchy analysis completed.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Unable to analyze the location hierarchy.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-violet-500/10 p-2 text-violet-500">
            <Sparkles className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">AI Location Insights</h3>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                status?.configured
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                  : "border-amber-500/20 bg-amber-500/10 text-amber-600"
              }`}>
                {status?.configured ? "AI ready" : "Gemini key not configured"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Read-only analysis for hierarchy risks, empty locations and unused branches.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={analyze}
          disabled={loading}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 text-xs font-medium text-violet-600 transition-colors hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {loading ? "Analyzing..." : "Analyze location structure"}
        </button>
      </div>

      {analysis && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-3 flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-xs">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>{analysis.summary}</span>
          </div>
          {analysis.findings.length ? (
            <div className="grid gap-2 lg:grid-cols-2">
              {analysis.findings.map((finding, index) => (
                <div key={`${finding.locationId ?? "system"}-${finding.title}-${index}`}
                  className="rounded-lg border border-border p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={`mt-0.5 size-3.5 shrink-0 ${
                      finding.severity === "HIGH" ? "text-destructive"
                        : finding.severity === "MEDIUM" ? "text-amber-500" : "text-primary"
                    }`} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold">{finding.title}</p>
                        {finding.locationCode && (
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {finding.locationCode}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{finding.description}</p>
                      <p className="mt-2 text-[11px]">
                        <span className="font-medium">Suggested action:</span>{" "}
                        {finding.suggestedAction}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
              No significant hierarchy issues found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
