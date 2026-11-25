# AI Personal Learning Roadmap

## Configuration and diagnosis

The message “AI roadmap generation is unavailable” was rendered when the Roadmap API returned `aiAvailable: false`. The backend checks whether AI is enabled and a key is configured before sending a provider request. The checked workspace had neither a `backend/.env` file nor an AI key in the inspection shell. A probe of the existing backend returned HTTP 503 and a later probe could not connect, so its effective environment and provider credentials could not be verified.

Set `GEMINI_API_KEY` in `backend/.env` or in the environment that starts Spring Boot. `AI_API_KEY` is accepted when the Gemini key is absent or blank. Keep `AI_ENABLED=true` and restart the backend. `AI_MODEL` and `AI_ENDPOINT` override the configured model and endpoint. Backend startup logs report `CONFIGURED`, `DISABLED`, or `MISSING_KEY` without logging values. `CONFIGURED` confirms local configuration presence. Provider authentication and availability are determined when generation is requested.

**Create roadmap / Update roadmap** now builds a catalog-based roadmap directly in the backend. It matches goal terms to course titles, descriptions and categories, prioritizes relevance and the learner’s level, skips completed courses and selects courses within the available budget. The chosen courses are ordered by difficulty. Spare weeks are distributed across phases for practice. A roadmap can only be saved when relevant unfinished courses fit the schedule.

**Get AI advice** is optional and operates on a saved roadmap. It sends the goal, selected available course titles and completion states to the provider. It validates one to three advice strings before saving and preserves the selected courses and week ranges. A failed provider request leaves the saved roadmap intact. The source is labeled “Catalog-based roadmap”, with “AI study advice added” when applicable.

## Data flow

**Profile** and the **Edit learning goal** dialog save through the same API. **Overview** and **My Roadmap** share one account-scoped query and one persisted roadmap. The server resolves the learner from the authenticated session. Catalog selection and scheduling run locally for the primary create action. The legacy AI generation request remains supported for callers explicitly sending `ruleBased: false`. It validates course IDs, duplicates, week ranges, text lengths, and known workload before saving. Reloading reads live course titles, enrollment, lesson progress, and certificates from the LMS.

Roadmap progress is the number of completed recommended courses divided by the total number of courses in the saved plan, including unavailable entries. A phase is completed when all its courses are completed. The first unfinished phase with an available, unfinished course is the current phase. Study budget is weekly hours multiplied by target weeks. The Roadmap converts published lesson totals from seconds to minutes once per course. An unknown duration is labeled and excluded from budget validation. The check budgets full known course duration for unfinished courses.

## Personal API

The three endpoints require `LEARNER_ACCESS`, `LEARNING_SELF_READ`, and `COURSE_READ`. The contract accepts no target learner ID. Send the latest revision from the GET response when writing. A concurrent change returns HTTP 409.

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/learning/me/roadmap` | Current goal, plan phases, advice, source, stale flag, and live enrollment evidence |
| PUT | `/api/learning/me/roadmap/goal` | Validates and saves the caller’s goal. A changed goal flags the previous plan as outdated |
| POST | `/api/learning/me/roadmap/generate` | Saves a validated plan and returns the new revision |
| POST | `/api/learning/me/roadmap/advice` | Adds optional AI study advice to the caller’s current saved roadmap |

Create a goal:

```json
{"revision":null,"goal":{"careerGoal":"Java Backend Developer","currentLevel":"BEGINNER","hoursPerWeek":3,"durationWeeks":12}}
```

Generate with the revision returned by the goal response:

```json
{"revision":0,"ruleBased":true}
```

An abbreviated successful response:

```json
{"revision":1,"targetWeeks":12,"source":"RULE_BASED","outdated":false,"aiAvailable":true,"phases":[{"title":"Java Fundamentals","startWeek":1,"endWeek":12,"objective":"Practice core Java","courses":[{"id":42,"title":"Java Fundamentals","status":"ENROLLED","enrollmentId":17,"progressPercent":0,"durationMinutes":120}],"reasons":{"42":"The catalog title or description matches terms from your career goal."}}]}
```

An omitted `ruleBased` value defaults to catalog-based selection. The UI always sends true. Existing callers can explicitly send false for the previous full AI generation workflow. No suitable courses or an excessive known workload returns HTTP 422. A structurally invalid AI plan returns HTTP 502. Missing AI configuration and upstream rejection can return HTTP 503 for AI operations. The AI request guard may return HTTP 429 when a request is already in flight or inside the cooldown. Local creation does not use that guard or call the provider.

Request optional advice using the current saved revision:

```json
{"revision":1}
```

The response source becomes `RULE_BASED_WITH_AI_ADVICE`. The source of an existing AI-generated plan remains `AI`. Old phase-array JSON, `AI` plans, and `RULE_BASED` plans remain readable without a schema migration for this change.

## Persistence and files

The existing `learning_roadmaps` table remains the sole store. Two nullable columns, `duration_weeks` and `plan_outdated`, preserve legacy month-based goals and prior plans. Legacy JSON phase arrays remain readable. Local Hibernate update creates the columns. With DDL updates disabled, apply [the manual SQL](../backend/src/main/resources/db/manual/learning-roadmaps.sql) before running the new backend.

- Backend generation, validation and progress mapping live in [the Roadmap package](../backend/src/main/java/com/example/starter_project_2025/system/learning/roadmap).
- Provider configuration and request diagnostics reuse [the Learning AI gateway](../backend/src/main/java/com/example/starter_project_2025/system/learning/LearningAiGateway.java) and the Gemini client.
- The tab structure lives in [My Learning](../frontend/src/pages/management/learning/index.tsx). The summary, detailed timeline, and modal live in [LearningRoadmapPanel](../frontend/src/pages/management/learning/components/LearningRoadmapPanel.tsx). The form also remains available in [Profile](../frontend/src/pages/management/profile/components/LearningGoalCard.tsx).
- Course enrollment and lesson completion invalidate the personal Roadmap query. Both tabs reflect the refreshed result.

## Manual verification

1. Run frontend and backend from the `HCM26_INTEGRATION_GR4` workspace. Sign in with a learner account that can read the course catalog.
2. In Profile or My Learning, save your goal, weekly hours, and target weeks.
3. Open **My Roadmap** and select **Create roadmap**. Ensure the published catalog has relevant unfinished courses with a known workload that fits the target duration, or courses with unknown duration clearly labeled.
4. Open a course from the timeline, enroll, and complete a lesson. Return to My Learning to check the summary, timeline, and course list.
5. Change the goal, confirm the previous plan is marked outdated, and choose **Update roadmap**.
6. With a provider configured, select **Get AI advice**. Provider failure keeps the saved plan usable. This action requires an updated roadmap for the current goal.

Learning History and Reports reuse the existing calendar and statistics components. Those components display unavailable states where the LMS provides no history or report data. No report engine or additional profile skills/preferences fields were introduced.

## Verification results

- The catalog-first workflow passed 22 targeted backend tests on 20 November 2026, including creation without a provider call, advice failure preserving the saved plan, source labels, and advice keeping course selection and week ranges intact.
- An isolated H2 backend and a provider stub verified creation with the provider returning HTTP 503. The provider counter stayed at zero during creation. A subsequent advice failure preserved the saved roadmap. After enabling the stub, advice was saved without changing the selected courses or schedule. The same behavior was checked through the browser.
- Frontend production build and scoped ESLint checks passed for the catalog-first UI. These tests used catalog records in an isolated test database and a provider stub.
- Production frontend build and three targeted frontend tests passed.
- The complete frontend suite ran 64 tests, with 51 passing and the same 13 failures previously observed in role previews, Course import, and Course Catalog tests.
- 28 backend tests passed across Roadmap, rule-based selection, Learning Insights and essay grading.
- A running Spring Boot backend, isolated H2 database and local provider stub verified goal editing, AI generation, catalog-based suggestions, saved plans, enrollment and completion synchronization, and preservation after a failed regeneration.
- Learner and Admin test accounts saw separate records. A Teacher account without learner grants received HTTP 403.
- Browser checks covered the Overview-to-Roadmap action, the goal dialog, the timeline, light and dark themes, and no horizontal overflow at 390 px and 768 px.
- The live Gemini API and a production database were unavailable for this verification. The actual Gemini model and credentials still need a deployment smoke test.
- All changes are in the working tree on `backup/gr4`. Existing unrelated working changes were preserved.
