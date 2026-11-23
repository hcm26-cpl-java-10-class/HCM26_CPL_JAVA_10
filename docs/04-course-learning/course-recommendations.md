# Course Recommendations

The student course catalog includes automatic recommendations, editable learning goals and topics, per-account dismissals, and an inline AI conversation. Admin Student View uses the authenticated admin's own account; there is no selected-student parameter or impersonation.

## Running

Use the existing backend and frontend setup. Automatic recommendations do not require an AI key. The AI conversation uses the existing `app.ai` configuration (`GEMINI_API_KEY`, `AI_MODEL`, `AI_ENDPOINT`). Credentials remain in backend configuration.

Development's existing `ddl-auto=update` creates three additive tables. For MySQL environments using `validate` or `none`, apply `backend/src/main/resources/db/manual/course-recommendations.sql` before startup. No existing course, assessment, grade, enrollment or upload schema is changed.

## Behavior and boundaries

- Eligibility reuses the existing catalog/enrollment definition: active, published courses. Existing enrollments, issued course certificates and this account's dismissals exclude a course.
- Ranking uses saved goals/topics, recent actual learning access, issued completion certificates, difficulty, ratings weighted by review counts, and aggregate enrollment popularity. Old enrollments without activity do not imply topic interest. Certificate issuance already enforces the project's completion and assessment rules; recommendations do not calculate new completion or assessment grades.
- Public course cards use the existing catalog mapping, detail routes and enrollment workflow. Enrollment invalidates recommendations, catalog, detail and enrollment queries.
- Candidate/statistic queries are batched. A diversity pass considers the best 200 scored candidates, retains up to 30, and shows six automatic cards. Ranking uses the card's existing primary category. Multiple categories on historical courses contribute topic interests. Large-catalog deployments can move scoring into paged database queries if needed.
- AI receives at most 30 eligible public candidate summaries, saved preferences and at most eight recent conversation messages. It receives no other student's learning records, exam answers, grades or private lesson content. Returned IDs must be integral, belong to the candidate set and are deduplicated; invalid output falls back. Eligibility is read again after the provider responds. Course card facts always come from the database.
- AI output is plain text. It cannot create courses, enroll the account or supply card links. AI guidance can still be imperfect; course details remain the source for prerequisites. Category/difficulty similarity does not establish prerequisites. Content duration is not guaranteed study time.
- Recommendations use one provider attempt, a five-second connection timeout, a 20-second read timeout and 2,048 output tokens. Existing AI callers retain their original timeout/retry/token policies.
- AI usage is bounded per backend process: one in-flight request per account, at least 15 seconds between calls, ten calls per hour/account, eight provider requests globally, and at most 10,000 tracked accounts. Restarting clears those counters. Multi-instance deployments should use a shared rate limiter.
- Requests limit current questions to 1,000 characters, history to eight turns of 2,000 characters, goals to 1,000 characters, interests to 20 topics of 80 characters, and saved dismissals to 2,000. The provider is never called automatically on opening the catalog or conversation.
- The simple provider-independent fallback supports easier/beginner, intermediate, advanced and shorter follow-ups in English and Vietnamese. Arbitrary goal/knowledge/length interpretation requires the configured AI; automatic suggestions remain available when AI is unavailable. Shorter fallback orders known content durations and excludes unknown durations.
- Preferences and dismissals are database-backed per authenticated account. Conversations use an account-scoped session-storage key and retain the last eight turns. Logout/account replacement removes saved recommendation conversations. Clear chat cancels/invalidates old responses and leaves preferences intact. Reset preferences removes goals, topics and dismissals while retaining conversation history.
- The conversation is inline so the existing general floating assistant remains available. Course Builder, AI Comparison and grading retain their original permissions and workflows.

## Reproduce verification

Backend, with Java 21:

```text
mvn "-Dtest=Recommendation*Test" test
mvn test
mvn -DskipTests package
```

Frontend, after installing the existing lockfile dependencies:

```text
npm ci --no-audit --no-fund
npm run build
node scripts/check-recommendation-session.ts
node scripts/check-recommendation-integration.mjs
node scripts/check-assessment-navigation.mjs
node scripts/check-learner-grades.mjs
```

The session check uses Node 24's TypeScript stripping. The integration check uses existing esbuild/React dependencies to render providers/components on the server and exercise the actual enrollment hook with a simulated HTTP adapter. It does not open or control a browser. The backend provider tests use a local HTTP server and test-only credentials, including a real read-timeout test. They make no live Gemini calls.

## Manual testing

1. New student: open Courses in Student View. Expect varied introductory suggestions from active published courses, or an honest empty-catalog message. Existing catalog search, filters and pagination should still work.
2. Learning history: access lessons in an enrolled course and revisit Courses. Its category should influence suggestions more than old inactive enrollments. Enrolled/completed courses should not appear. Completion still follows the normal assessment/certificate workflow.
3. Admin Student View: switch an admin to Student View and open Courses. Preferences and history belong to that admin, with introductory fallback when the admin has no learning history. Switching back retains admin management features.
4. Conversation: select English or Vietnamese and ask about goals, existing knowledge, difficulty and content length. Follow with “something easier”, “shorter courses”, “why this course?”, or Vietnamese equivalents. Suggested cards should link to actual catalog courses.
5. AI unavailable: remove/disable the backend AI configuration in a testing environment and restart. Automatic suggestions still load; submitting a question explains AI unavailability and returns catalog suggestions. Restore configuration afterward. Simulated quota, invalid IDs, malformed responses and timeout are covered by automated tests.
6. Preferences/dismissals: save goals and comma-separated interests; reload and verify they persist. Dismiss a card; it should remain excluded after reload. Clear chat while a request is pending; no old response should reappear and preferences should remain. Reset preferences/dismissals; saved preferences should clear and dismissed eligible courses may return. Conversation history should remain. Log out and use another account to confirm isolation.
7. Detail/enrollment: open View detail, check existing assessments/grades where permitted, return and enroll through a recommendation. Expect the existing workflow and refreshed suggestions without the enrolled course. Continue learning and certificates should remain unchanged.
8. Empty/error states: dismiss all remaining eligible courses to see the no-more-courses state, reset, and retry after a temporary API connection failure. On a narrow viewport, tab through controls and verify readable labels, focus, and wrapping.

No interactive browser testing or real-provider end-to-end testing was performed, as this task prohibits computer/browser control. Historical baseline results from the supplied ZIP: 970 tests, 944 passing, 14 failures and 12 errors in unrelated analytics, exam statistics and project/workspace tests. These are historical results, not a current-dev full-suite guarantee.

## Catalog search adjustment (2026-11-15)

Recommendation cards, including AI-selected cards, now follow the catalog search keyword. Matching is case-insensitive against name, description or instructor, consistent with catalog search. Unrelated recommendations disappear; when none match, a search-specific message appears. Clearing search restores the recommendations without changing preferences, dismissals or conversation.

## Saved-preferences filtering correction (2026-11-15)

Saved goals and topic interests now filter recommendation candidates before ranking. Matching uses meaningful goal words or saved topic phrases in public course names, primary categories or descriptions. Matching ignores capitalization and checks word boundaries, so Java does not match JavaScript by substring. Any saved goal/topic match qualifies; unrelated courses cannot return through ratings, popularity, learning history or diversity. The AI candidate set uses the same filter. When no eligible course matches preferences, the UI and conversation explain this instead of returning unrelated fallback cards. Resetting preferences restores the normal discovery recommendations. The catalog keyword-search adjustment is preserved.

Verification for this correction: 57 focused backend tests passed (including 43 recommendation tests), backend packaging passed, frontend production build passed, and frontend integration/session checks passed. Full-suite results in the original verification section are historical; the full suite was not rerun for this correction. No browser control was used.

## Git integration verification (2026-11-15)

Verified against dev `892629bbb58e8e575d17c2a555009f18cf589052`: 149 focused backend tests passed, including 43 recommendation tests; frontend production build and recommendation integration/session checks passed. Backend packaging passed with tests run separately. The full backend suite was not rerun on this dev revision. No interactive browser or live Gemini-provider check was performed. No dependencies, databases, uploads or unrelated source features are changed by the recommendation patch.
