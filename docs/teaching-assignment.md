# Teaching assignments

The management page is available at `/teaching-assignments` under **Training Operations → Teaching Assignments**.
It uses the existing application layout, theme, permissions and UI components. Labels are in English; names from the shared system are displayed as supplied.

## Run locally

From the repository root, start the backend with the existing sample-data profile:

```powershell
cd backend
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local"
```

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

The local profile seeds one class with an active program and sample trainer profiles. The second active class must be assigned a program in class setup before it becomes eligible for a new teaching assignment.
Sample data uses an in-memory database and is cleared on restart. The default profile uses the configured external class/trainer service and never falls back to local samples on upstream failure.

## Create an assignment

1. Sign in with an account that has `ASSIGNMENT_READ` and `ASSIGNMENT_CREATE`.
2. Open **Teaching Assignments** and click **New assignment**.
3. Select an eligible class, then one of its active program subjects.
4. Select an active trainer from the trainer directory and the Main or Assistant role.
5. Set the effective start date and optional end date, then click **Create assignment**.

If the page is already filtered by class, that class is preselected when eligible. Changing the class clears the subject selection. Errors retain the form values, and a successful create closes the dialog and refreshes list/filter queries while keeping the current list filters.

## Creation rules

- Classes and their assigned programs must be active. A subject must belong to the selected class program, have `isActive=true` and status `ACTIVE`.
- Trainer IDs come from the shared trainer directory, not from the general user list. Only profiles with active status are accepted, even if an upstream filter incorrectly returns an inactive profile.
- Start/end dates are inclusive; a same-day assignment is allowed. The end cannot precede the start.
- The period must stay within the class dates when those bounds are provided. An omitted end uses the class end date when available, otherwise it remains open-ended.
- There can be one Main trainer per class subject at a time. Multiple different Assistant trainers are allowed. The same trainer cannot have overlapping assignments for the same class subject, including across roles.
- An existing program-subject row is locked before overlap checks and writes, including when the first assignment is created. Participating create/update writes use the same lock, so concurrent conflicting creates cannot both commit.
- Shared-service failures do not save an assignment. Malformed or reversed upstream class date ranges are reported as upstream errors.

The backend revalidates on submission. Field errors return HTTP 400, overlaps return 409 and missing create permission returns 403. Loading/retry states, pending-submit guards and query cancellation protect the form from duplicate submissions and stale class-subject responses.

## View assignment details and session history

Click **Details** in an assignment row. The dialog shows the class, subject/version, training program/version, trainer/email, role and effective period. Opening details stores `assignmentId` in the URL, so a copied URL can reopen the same assignment; closing the dialog preserves the list filters and page.

The session table has its own server pagination, status filter and time ordering. It includes completed, cancelled and archived sessions, with archived rows identified explicitly. Only sessions whose `teachingAssignmentId` matches the selected assignment are included. Legacy rows without a reference are not inferred from a shared class, subject or trainer.

Local end-to-end session scheduling can use the existing `local,schedule-demo` profile combination. The schedule-demo profile supplies static class dates and assignment references for scheduling; those sample IDs must match the assignment being exercised. The normal scheduling profile continues to require its configured external reference service.

Assignment profiles and session history load independently, with separate loading/error/retry states. Deleted shared profiles fall back to local identifiers, and an upstream profile outage does not block the local session-history endpoint. Schedule timestamps are displayed without shifting their local date or time. Meeting links accept only absolute HTTP/HTTPS URLs without embedded credentials.

## Edit an assignment and preview its impact

Accounts with `ASSIGNMENT_UPDATE` can click **Edit** in an assignment row. The form loads a fresh edit context and preserves input until the user saves, closes or explicitly reloads it. Class and subject are fixed. Trainer changes are allowed only while there are no linked sessions, including cancelled or archived history.

Use **Preview impact** after changing the role or effective dates. The preview lists affected sessions and reasons with server pagination. Non-cancelled sessions, including completed and archived sessions, must remain within the proposed inclusive date range and retain their class/trainer context. Cancelled sessions do not block date changes, but still prevent changing the trainer on a used assignment. Replacement assignments and session reassignment are separate, explicit operations; this form never rewrites session history.

**Save changes** becomes available only for the exact form values and revision that passed preview. Any further edit invalidates that preview. The backend always repeats validation at save time, even if the caller skips preview. Both preview and update require the current `revision` from the assignment response; stale or missing revisions return HTTP 409 and require an explicit reload.

Updates share the existing schedule write lock with single-session writes and the bulk session writer. After taking the lock, the backend reloads the assignment, checks its revision and validates linked sessions before committing. Single-session and bulk writes also recheck the local assignment class, trainer and effective period, so stale external assignment references cannot bypass an update. Existing bulk conflict/idempotency behavior remains the responsibility of schedule integration.

## API additions

Both lookup endpoints require `ASSIGNMENT_CREATE`, without requiring class/program management permissions:

- `GET /api/teaching-assignments/create-options`: eligible classes and active trainers.
- `GET /api/teaching-assignments/create-context?classId=...`: selected class dates, program/version and eligible program subjects.

The existing `POST /api/teaching-assignments` contract is preserved.

Assignment readers use the existing `GET /api/teaching-assignments/{id}` endpoint, now with additive class/subject/program/trainer display fields. `GET /api/teaching-assignments/{id}/sessions` returns a page of linked session summaries and requires `ASSIGNMENT_READ`. Parameters are `page`, `size` (at most 100), `sort` (`id`, `startTime`, `endTime`, `status`) and optional `status` (`SCHEDULED`, `COMPLETED`, `CANCELLED`). A unique ID tie breaker keeps pages stable for sessions with equal times. Session summaries exclude session notes and cancellation details.

Editing uses `ASSIGNMENT_UPDATE` for all three endpoints:

- `GET /api/teaching-assignments/{id}/edit-context`: current assignment/revision, class dates, active trainers and linked session count.
- `POST /api/teaching-assignments/{id}/impact-preview`: proposed assignment fields plus `revision`; accepts `page`/`size` (at most 100) and returns a paginated impact report without saving.
- `PUT /api/teaching-assignments/{id}`: the same fields plus current `revision`; revalidates in the write transaction and returns the incremented revision.

The existing class-setup editing path also supplies the revision and receives the same backend protections.

## Validation commands

```powershell
# backend
.\mvnw.cmd test

# frontend (form tests verified with Node 24)
npm run build
npm run test:teaching-assignment
npm exec -- eslint src/pages/management/teaching-assignment src/api/features/class-setup.api.ts
```

The integration tests cover permissions, creation lookups, date boundaries, invalid input, inactive/foreign data, overlap policies, service failures and simultaneous Main assignment requests. Detail tests also cover exact session linkage, historical statuses, pagination, missing profiles and upstream outages. Frontend tests cover form validation, schedule-time formatting and safe meeting links. Existing list and class-setup tests remain regression coverage.

Edit integration tests cover read-only preview, immutable identity, historical/cancelled sessions, stale revisions, changed sessions after preview, local single/bulk write guards and simultaneous session/assignment edits. Frontend tests verify that only an exact, successful preview can enable save.

Ending assignments, deletion rules and the remaining schedule integration are subsequent implementation stages.
