import { Link } from "react-router-dom";
import type { ScheduleValidationResult } from "@/api/features/schedule-check.api";

export function ScheduleIssues({ result, focusRow }: {
    result: ScheduleValidationResult;
    focusRow?: (index: number) => void;
}) {
    if (result.valid) return <p role="status" className="rounded-lg border border-green-500 bg-green-50 p-4 text-green-900">No scheduling conflicts or validation issues were found.</p>;
    return <section aria-label="Validation results" aria-live="polite" className="space-y-3 rounded-lg border border-red-400 p-4">
        <h2 className="font-semibold text-red-700">{result.issues.length} scheduling {result.issues.length === 1 ? "issue requires" : "issues require"} attention</h2>
        <ul className="space-y-3">
            {result.issues.map((issue, i) => <li key={`${issue.candidateIndex}-${issue.code}-${i}`} className="rounded border p-3">
                <p><strong>{issue.candidateIndex >= 0 ? `Session ${issue.candidateIndex + 1}: ` : ""}</strong>{issue.message}</p>
                {issue.relatedTitle && <p className="text-sm text-muted-foreground">Related session: {issue.relatedTitle} · {issue.relatedStart?.replace("T", " ")} – {issue.relatedEnd?.replace("T", " ")} ({result.timezone})</p>}
                <div className="mt-2 flex flex-wrap gap-4 text-sm">
                    {issue.candidateIndex >= 0 && focusRow && <button type="button" className="text-blue-600 underline" onClick={() => focusRow(issue.candidateIndex)}>Edit session {issue.candidateIndex + 1}</button>}
                    {issue.relatedCandidateIndex !== null && focusRow && <button type="button" className="text-blue-600 underline" onClick={() => focusRow(issue.relatedCandidateIndex!)}>Go to session {issue.relatedCandidateIndex + 1}</button>}
                    {issue.relatedSessionId !== null && <Link className="text-blue-600 underline" to={`/sessions/${issue.relatedSessionId}/edit`}>View or edit session #{issue.relatedSessionId}</Link>}
                </div>
            </li>)}
        </ul>
    </section>;
}
