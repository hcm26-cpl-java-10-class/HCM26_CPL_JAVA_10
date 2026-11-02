# Teaching assignments

The management page is available at `/teaching-assignments` under **Training Operations → Teaching Assignments**.
It uses the existing application layout, theme, permissions and UI components. Labels are in English; names from the shared system are displayed as supplied.

Editable text fields in Teaching Assignments have a 200-character limit: class/program/subject/trainer names, trainer email, list search and text filters. Form inputs enforce the cap; backend creation DTOs and list/export search validate it again. Email syntax validation still applies. Number/date controls keep their existing range and calendar validation. Managed class/trainer name columns support 200 characters; program/subject names use the existing wider base columns.

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

1. Sign in with an account that has assignment, class/program and trainer creation permissions (the local admin has these permissions).
2. Open **Teaching Assignments** and click **New assignment**.
3. **1. Class information:** enter Class name, Training program name, Class start date, Class end date and Planned students. Program version defaults to `1.0`; no version input is shown. Class start date must be tomorrow or later in Vietnam time.
4. **2. Subject and trainer:** enter a new Subject name freely (up to 200 characters). There is no Duration input. Enter Trainer name and Trainer email directly; both are required and limited to 200 characters. No existing-trainer selection is needed. Select Main trainer or Assistant trainer for Role.
5. **3. Teaching schedule:** add Teaching slots with a calendar date, start time and end time. Add/remove rows as needed, then click **Create assignment**. Effective dates automatically follow the class dates; no separate effective-date input is shown.

### Dated teaching slots

The new form requires 1–200 teaching slots. **Add slot** and the remove action manage rows. Each row uses a specific calendar date and Vietnam local `HH:mm` times. The end must be more than 30 minutes after the start on the same day (`end - start > 0.5 hours`); exactly 30 minutes is rejected, while 31 minutes is accepted. The time error appears once both times have been entered and is rechecked on submit and by the backend. Overnight rows, incomplete/invalid dates, seconds, duplicate rows and overlapping intervals are rejected. Dates must be inside the assignment's effective interval and the class dates. Multiple non-overlapping slots on one day are allowed; `08:00–10:00` followed by `10:00–12:00` is valid. A trainer may teach different subjects/classes in those separate slots.

Each row displays a read-only **Duration**, calculated as `End time - Start time`. **Total teaching time** sums the rows and updates when times change or rows are added/removed. Minutes are calculated as integers: 08:00–09:30 is 90 minutes; adding 10:00–10:45 gives 135 minutes (2 hours 15 minutes). Incomplete or reversed times display a dash until corrected. The server independently recalculates the new subject's duration from the submitted slots, ignoring a supplied duration when slots exist. The Subject and program duration fields now support positive decimal hours (`DECIMAL(20,9)` for Subject storage); 90 minutes stores as 1.5 hours, not 2. Intervals retain the exact minutes; repeating hour fractions such as 31/60 use nine decimal places in the catalogue. Existing whole-hour data and imports remain supported.

Trainer conflicts are checked across all active assignments and both session tables, under the shared scheduling write lock. A failed one-submit create rolls back all new records along with the assignment, preserving existing subjects/trainers. Simultaneous conflicting reservations cannot both commit. Slots are stored in `teaching_assignment_slots` and returned as `teachingSlots: [{ date: "2026-11-02", startTime: "08:00:00", endTime: "10:00:00" }]`; requests accept `HH:mm` values. List/detail/edit show the saved slots. Edits require a new impact preview and cannot remove coverage for non-cancelled linked sessions. Ending an assignment expires future reservations while retaining the dated definitions for history.

The `available` API and bulk generation resolve assignments against the whole requested slot, and linked session writes must fit in one dated slot. Slots are reservations; adding them does not itself create Study Sessions. Old API requests and existing assignments without slots retain their date-based behavior. Omitting `teachingSlots` during an update preserves any saved slots; an explicitly empty array is rejected. Optional **Teaching Slots** in import/export uses `YYYY-MM-DD HH:mm-HH:mm; YYYY-MM-DD HH:mm-HH:mm`. Older import files remain accepted.

The dialog has one new-class flow, with no existing-class switch or class preselection from list filters. It has no separate class/trainer save buttons: only **Create assignment** writes the completed draft. The new subject is included in the new program with the duration calculated from its teaching slots. Cancel before submission saves nothing. Errors retain form values. A successful assignment create closes the dialog and refreshes list/filter queries while keeping current filters. The list has no Reset button; clear a text filter to show all records.

Role uses a dropdown with Main trainer and Assistant trainer in create/edit forms; the role filter also offers All roles. New class/program names and trainer names/emails are ordinary text fields, without internal ID suffixes or sample-name matching. The edit form preserves the trainer lock for assignments already used. Text filters/sort apply on Enter or blur; clearing a filter means all records. Row counts accept whole numbers from 1 to 100.

### Create a class with a freely entered name

Users with assignment/class/program/trainer creation permissions enter the whole form before saving. **Create assignment** generates codes, creates/activates the program through the existing program service, saves the class/program association, creates or reuses the trainer and creates the assignment in one transaction. Any failed validation rolls back all new records; existing trainer profiles are preserved. There are no separately saved class or trainer records when cancelling an unsent draft.

New class names are limited to 200 characters; student count is 1–10000. Blank names, duplicate names/codes (ignoring case and repeated whitespace), reversed dates and programs without active subjects are rejected. Newly created profiles are stored in `managed_teaching_classes`, returned by the class directory and used by assignment searches, imports/templates, StudySession validation and generation. They supplement shared profiles; external profiles are not modified and upstream outages are not treated as a successful lookup. The normal database lifecycle applies, including the existing local H2 reset on restart.

Class references use positive 52-bit generated IDs that are safe in JavaScript. Creation checks for collisions with known shared/application IDs under the schedule write lock; the combined directory rejects any later shared/application collision instead of silently replacing a profile. The training-program association continues to use the existing `class_training_programs` table.

- `GET /api/teaching-assignments/class-program-options` lists eligible active programs.
- `GET /api/teaching-assignments/class-subject-options` lists eligible subjects for a new program; additionally requires program create/update permissions.
- `POST /api/teaching-assignments/classes` accepts `{name, newProgram: {name, version, subjectIds}, startDate, endDate, plannedSize}` and returns the saved class profile (201). The earlier `programId` variant remains compatible for API callers; exactly one program source is required.

Class endpoints require assignment create, class create and class-program update permissions. New-program writes also check program create/update permissions. Existing assignment creation payloads remain unchanged; internal IDs are retained for stable linkage.

The form uses `POST /api/teaching-assignments/create-with-details` with `{classDetails, trainer: {name, email}, newSubject: {name}, role, effectiveFrom, effectiveTo: null, teachingSlots}`. The form sends an empty `classDetails.newProgram.subjectIds` array; the server calculates the new subject's duration from the slots, creates it and includes it in the curriculum. The existing trainer is reused by matching name/email. `effectiveFrom` is the class start date and the server bounds `effectiveTo` to the class end date. It requires assignment create, class create, class-program update, program create/update, trainer create and subject create permissions. The server resolves the new ProgramSubject after creating the curriculum. The `subjectId` variant and legacy `newSubject.durationHours` without slots remain available to other API callers; exactly one subject source is required. The response is TeachingAssignmentResponse (201); failures roll back all newly created records. Independent class/trainer APIs remain compatible for other callers.

### Enter a trainer name and email

The new-assignment form accepts trainer names/emails directly, requires nonblank values, caps both at 200 characters, and validates email syntax. The same validation is enforced by backend DTOs. The profile is created or reused inside the single assignment transaction. The independent `POST /api/teaching-assignments/trainers` API and unused-assignment edit flow also accept new names/emails and return an active profile. They require `TRAINER_CREATE` and assignment create or update permission. New profiles are persisted in `managed_teaching_trainers` and included in class-setup, assignment, template/import and schedule reference lookups. They are teaching profiles, not login accounts, and no email is sent.

An existing active profile with the same name/email is reused, including shared profiles; email comparison ignores case. A reused email with a different name, or an inactive/ambiguous owner, returns 409. Malformed email/blank name returns 400. Editing an unused assignment can save a new trainer profile before preview; any name/email edit invalidates the preview. A used assignment retains its locked trainer and session history.

## Creation rules

- Classes and their assigned programs must be active. A subject must belong to the selected class program, have `isActive=true` and status `ACTIVE`.
- Trainer IDs come from the combined shared/application teaching directory, not from the general user list. Only profiles with active status are accepted, even if an upstream filter incorrectly returns an inactive profile.
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

Accounts with `ASSIGNMENT_UPDATE` can click **Edit** in an assignment row. The form loads a fresh edit context and preserves input until the user saves, closes or explicitly reloads it. Class and subject are fixed. Trainer changes are allowed only while the assignment has never been used and has no linked sessions, including cancelled or archived history.

Use **Preview impact** after changing the role or effective dates. The preview lists affected sessions and reasons with server pagination. Non-cancelled sessions, including completed and archived sessions, must remain within the proposed inclusive date range and retain their class/trainer context. Cancelled sessions do not block date changes, but still prevent changing the trainer on a used assignment. Replacement assignments and session reassignment are separate, explicit operations; this form never rewrites session history.

**Save changes** becomes available only for the exact form values and revision that passed preview. Any further edit invalidates that preview. The backend always repeats validation at save time, even if the caller skips preview. Both preview and update require the current `revision` from the assignment response; stale or missing revisions return HTTP 409 and require an explicit reload.

Updates share the existing schedule write lock with single-session writes and the bulk session writer. After taking the lock, the backend reloads the assignment, checks its revision and validates linked sessions before committing. Single-session and bulk writes also recheck the local assignment class, trainer and effective period, so stale external assignment references cannot bypass an update. Existing bulk conflict/idempotency behavior remains the responsibility of schedule integration.

## End an assignment or delete an unused assignment

Click **End** to choose an inclusive effective end date. The date must be on or after the assignment start and must not extend an existing end date. Preview is required in the dialog; changing the date invalidates that preview. Non-cancelled sessions, including completed and archived records, block an end date that would leave them outside the period. Cancelled sessions remain in history and do not block date shortening.

Ending preserves the assignment, its trainer/start date and all session rows. It does not cancel, move or reassign any session. The assignment remains available through the selected end date and is no longer available on later dates. The end operation can also close an open-ended assignment.

Click **Delete** to load a fresh deletion context and explicitly confirm removal. Any session reference, including completed, cancelled or archived history, blocks deletion. A persistent usage marker also blocks deletion and trainer changes after the last linked session is moved or removed. Successful session/bulk writes record first use in the same transaction; rejected writes roll it back. Single-session reassignment/deletion also records legacy usage before removing a reference. The dialog offers **End assignment instead** when the user has update permission. Deleting the last row on a later list page returns to the preceding page while preserving filters.

Lifecycle context, end preview and end/delete writes use local assignment/session data, so shared profile outages or retired trainer/class profiles do not prevent safe cleanup. Ending only shortens the existing interval; it is not a path to extend an assignment while bypassing normal edit validation. Writes check the current revision and use the same schedule lock as session writers, so a session added after a dialog/preview was loaded is checked again before committing.

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

Lifecycle endpoints are:

- `GET /api/teaching-assignments/{id}/lifecycle-context`: requires `ASSIGNMENT_UPDATE` or `ASSIGNMENT_DELETE`; returns the local assignment/revision, linked session count, `previouslyUsed` and `canDelete`.
- `POST /api/teaching-assignments/{id}/end-preview`: requires `ASSIGNMENT_UPDATE`; body `{ effectiveTo, revision }`, with `page`/`size` for the impact report.
- `PATCH /api/teaching-assignments/{id}/end`: requires `ASSIGNMENT_UPDATE`; the same body, with validation repeated under the write lock.
- `DELETE /api/teaching-assignments/{id}?revision=...`: requires `ASSIGNMENT_DELETE`; returns 204 only for an unused assignment. Missing/stale revisions or session references return 409. The class-setup deletion path also supplies the revision.

Update permission does not grant delete permission, and delete permission does not grant permission to end an assignment.

## Import and export

The Teaching Assignments header offers **Import** to users with `ASSIGNMENT_CREATE` and **Export** to users with `ASSIGNMENT_READ`, using the same dialogs as Courses.

- **Download Template** supplies an Excel workbook with an empty Import sheet, Instructions, eligible Classes, Curriculum and active Trainers. Copy Class ID and Program Subject ID from the same Curriculum row; a Subject ID cannot substitute for Program Subject ID. Reference sheets are a snapshot; import rechecks current data.
- Import accepts `.xlsx`, `.xls` and UTF-8 `.csv`, up to 50 MB and 1,000 data rows. Required headers are `Class ID`, `Program Subject ID`, `Trainer ID`, `Role`, `Effective From`, `Effective To`. The final column may be blank. Role is `MAIN` or `ASSISTANT`; dates are ISO `YYYY-MM-DD` or Excel date cells.
- Import creates new assignments only, using the existing create service, schedule lock, active/curriculum/date and overlap rules. Each row has its own transaction: valid rows remain saved when later rows fail. The result shows success/failure counts and spreadsheet row numbers. Reimporting the same assignment reports an overlap; it never overwrites a record or changes session history. Repair and retry failed rows only.
- Export supports Excel, CSV and PDF. It applies the current search, class/subject/trainer/role/effective-date filters and sort across all pages, ignoring current page/row count. Exports above 10,000 matching assignments are rejected with a request to narrow the filters. Excel/CSV include import headers and display columns; PDF is for viewing.

Endpoints:

- `GET /api/teaching-assignments/import-template` requires `ASSIGNMENT_CREATE`.
- `POST /api/teaching-assignments/import` requires `ASSIGNMENT_CREATE`; multipart field `file`; response `{successCount, failureCount, errors: [{rowNumber, message}]}`. Malformed files/headers return 400 before writes; row-level validation failures are included in the result.
- `GET /api/teaching-assignments/export?format=EXCEL|CSV|PDF` requires `ASSIGNMENT_READ`; uses the list filter/sort parameters.

The shared Courses import flow remains unchanged; the optional template callback is used only by Teaching Assignments.

## Validation commands

New classes created through Teaching Assignments must start tomorrow or later, using the current calendar date in `Asia/Ho_Chi_Minh` plus one day. The date picker and submit validation enforce the same lower bound; the backend rechecks it before creating the class, including new-class imports. Class end dates must remain on or after the start date. Existing class history and assignment editing retain their current rules.

```powershell
# backend
.\mvnw.cmd test

# frontend (form tests verified with Node 24)
npm run build
npm run test:teaching-assignment
npm exec -- eslint src/pages/management/teaching-assignment src/api/features/class-setup.api.ts
```

The integration tests cover permissions, creation lookups, date boundaries, invalid input, inactive/foreign data, overlap policies, service failures and simultaneous Main assignment requests. Detail tests also cover exact session linkage, historical statuses, pagination, missing profiles and upstream outages. Frontend tests cover form validation, schedule-time formatting and safe meeting links. Existing list and class-setup tests remain regression coverage.

Automatic-duration coverage includes missing duration input, 90-minute and 31-minute slots, summing multiple slots, ignoring a client-supplied total, fractional programme totals, and rollback for invalid slots. The shared Subject API/import and frontend form accept positive decimal hours without integer truncation. Whole-hour values remain compatible.

Verification on 2026-10-29 also identified a pre-existing full-suite issue: `BulkSessionGenerationIntegrationTest` cannot bootstrap because its test configuration lacks `TeachingAssignmentRepository` for the current generation service (10 test errors). The same failure was reproduced from a clean HEAD checkout; the focused assignment/Subject duration checks are separate from this stale fixture.

Edit integration tests cover read-only preview, immutable identity, historical/cancelled sessions, stale revisions, changed sessions after preview, local single/bulk write guards and simultaneous session/assignment edits. Frontend tests verify that only an exact, successful preview can enable save.

Lifecycle tests cover inclusive ending, open-ended assignments, extension/reversed-date rejection, stale contexts/revisions, all historical session statuses, separate update/delete permissions, profile outages and races between ending/deletion and session creation. Frontend tests cover date defaults/bounds, exact-preview confirmation and unused-only deletion guards.

The assignment integration endpoints, source transition, verification and module ownership boundaries are documented in [teaching-assignment-integration.md](teaching-assignment-integration.md).
