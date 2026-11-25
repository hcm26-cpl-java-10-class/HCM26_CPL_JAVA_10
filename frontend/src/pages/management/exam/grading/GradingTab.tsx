import ResultStatisticsPage from "../ResultStatisticsPage";
import EssayAttemptListPage from "./EssayAttemptListPage";

/**
 * Grading tab (single view):
 *  1. Essay & coding submissions waiting for review.
 *  2. Attempt results: result publication, scores and score edits
 *     (previously Statistics > Attempts).
 */
export default function GradingTab() {
    return (
        <div className="space-y-10">
            <section className="space-y-3">
                <h2 className="text-lg font-semibold">Essay &amp; Coding Grading</h2>
                <EssayAttemptListPage />
            </section>

            <ResultStatisticsPage mode="attempts" />
        </div>
    );
}