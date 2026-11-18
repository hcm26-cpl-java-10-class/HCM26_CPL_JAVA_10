# Assessment outcome indicators and course AI chat — November 17, 2026

Source: Downloads/HCM26_CPL_JAVA_10-dev.zip (SHA256 90da124adb9c945565e3c58d3962dc439dbe1a41f175540c7d8ba8572b556eb3). The source ZIP remains unchanged.

## Assessment outcomes

The enrollment progress response now includes a read-only map of assessment outcomes for that enrollment's authenticated owner. Published, fully graded results use the existing normalized best-attempt selection and the attempt's existing pass threshold. Passed assessments show a green check; failed assessments show a red circled exclamation mark. The indicators appear on assessment lessons, linked assessment rows, section assessments and final exams, and on the selected lesson's assessment controls.

Unpublished or pending grades do not reveal pass/fail. They retain a neutral pending indicator. Assessments without a configured pass requirement show a neutral Completed state rather than inventing a pass policy. A lower-scoring retry does not erase a prior best passing result, matching the existing best-attempt policy. Standard lesson completion icons remain unchanged.

The completion flag is no longer used as evidence of passing an assessment. Existing progress totals, scoring, gradebook snapshots, attempt limits, access checks, overall course completion and certificate policies are unchanged. Submission invalidates cached lesson progress so the course refreshes on return. This same flow serves actual student accounts and Admin Student View without substituting authenticated identities.

## Course AI chat

- A dedicated conversation area, clearer assistant/user bubbles, and a composer separated from the scrolling history.
- Auto-sizing input, character count, Enter to send and Shift+Enter for a newline; IME composition is respected.
- Editable starter and follow-up prompts instead of submitting a suggestion without review.
- Follow the latest messages while already at the bottom; offer Latest message when the learner has scrolled up.
- Stop cancels the current client request, restores its draft without overwriting newer typing, and ignores late responses.
- Retry restores the original question/history rather than duplicating failed questions. Changing language, preferences or refreshing also invalidates an outstanding response.
- Course names are retained in bounded, account-scoped conversation context for follow-ups but no longer appended as a duplicate course list in each visible assistant reply.
- Existing preference filtering, six-card pagination, course cards/enrollment, safe text rendering, language support and the general floating assistant remain in use.

## Actual verification

- 27 focused frontend checks passed, including published/failed/pending indicators, section/final placement, legacy completion not implying pass, retry without duplicate history, Stop and late responses, starter drafts, keyboard input, history context and prior pagination/preferences behavior.
- 120 selected backend checks passed, including the new outcome states, frozen pass thresholds, unpublished-result privacy, best retakes, pending grading, enrollment/progress, assessments, result access, recommendations and certificates.
- Backend Maven package: PASS on Java 21. A WebSocket dependency already declared by this newer ZIP was downloaded because it was missing from the local cache; the dependency declarations were not modified.
- Frontend TypeScript/Vite production build: PASS. Existing third-party annotation and large-bundle warnings remain.
- Backend tests used mocks and isolated in-memory H2. No interactive browser/desktop control or live external AI-provider testing was performed. The complete unrelated frontend suite was not rerun; the counts above describe this task's checks.

## Manual checks

1. Test both an actual student and Admin Student View. Submit a passing assessment and publish its fully graded result; return to the course and verify the green check on its lesson and linked assessment. Repeat for a failing assessment and verify a red !, including when the legacy lesson completion flag is true.
2. Check section and final exams, a failed retake after a prior pass, pending essay/coding grading, hidden/unpublished results, no attempts, and assessments without pass requirements. Pending/unpublished data must never show a pass/fail result.
3. Check normal lesson completion, existing course progress, overall grades and certificates follow the same rules as before.
4. Open the AI guide in English and Vietnamese. Use starters, multiple follow-ups, Shift+Enter, and the character limit. Confirm clear messages and no appended duplicate course lists.
5. During a slow response, type a newer draft and press Stop. It should retain that draft and ignore the late reply. Simulate a failed request and Retry: the question should appear only once. Change preferences or language during a request and confirm stale results do not appear.
6. Scroll up through history, receive another reply, and use Latest message. Clear chat, reload, and switch accounts; verify separate history and preserved selected-course context for follow-ups.
7. Check responsive layout, keyboard focus, light/dark themes, course result pagination, enrollment and the existing floating assistant.

This is an updated source testing ZIP, not a deployment or Git push.

## Fresh feature-branch checks before pushing

Only the 14 task paths were transferred into the existing feature/course-progress checkout using a 53 KB patch, with overlapping differences reconciled rather than replaced. No new repository copy, ZIP or dependency installation was needed. A lightweight backup branch preserves the starting commit.

Fresh checks in the Git checkout: 120 selected backend tests passed with zero failures, errors or skips; Maven package succeeded. All 42 frontend tests available in this feature checkout passed, and the frontend production build succeeded. These are separate results from the ZIP's 27 focused frontend checks above. No interactive browser or live AI-provider testing was performed.
