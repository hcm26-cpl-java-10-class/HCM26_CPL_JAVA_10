# Running locally

Requires JDK 21 and Node.js. The `local` Spring profile provides sample classes,
trainers and rooms without requiring the shared API on port 9090. It also creates
an ACTIVE Java program with three subjects and assigns it to the first sample
class. The second sample class is available to try assigning a program.

From `backend/`, run:

```powershell
# Use your installed JDK 21 path if JAVA_HOME points to another version.
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-21'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
mvn.cmd spring-boot:run '-Dspring-boot.run.profiles=local,schedule-demo'
```

From `frontend/`, run `npm.cmd run dev`, then open
<http://localhost:5173/class-setup>. Sign in as `admin@example.com` with the
local seed password `password123`. The page displays a sample-data notice.
Local data uses an in-memory H2 database and is reset when the backend stops.
The additional `schedule-demo` profile supplies scheduling references for Sessions,
schedule validation when the shared API on port 9090 is not running.
Both profiles explicitly use sample data. Session import refuses to certify/import these references as real data; it reports a source-data error until the real source is available.

## Session import and preview

On `/sessions`, select **Import**, upload an Excel/CSV file, then choose **Preview**.
Preview displays the parsed data and per-row validation without saving anything.
Like Subject preview, every Session import cell can be edited directly. After an edit,
**Recheck** validates all rows together; **Import** stays disabled until the check passes.
Recheck and confirmation submit the edited JSON rows, preserving the original row numbers.
Returning to the upload step or encountering a save error retains the draft. If another
booking appears after preview, confirmation is rejected and the editor displays the new
conflict without discarding the corrections.

The **Format and scheduling rules** panel reflects the server's configured working
hours, days, timezone and batch limit. Missing/unused file columns are reported;
a Study Sessions template using Subject ID/Lecturer is not silently treated as a
Session template using Topic ID/Trainer ID. Fill the correct values in preview or
use the Session template.
All rows must be valid before confirmation; saving rechecks the current schedule
and imports the file as one atomic batch.

Teaching Assignment ID is nullable in the legacy model. The import path resolves a blank
only if exactly one stored assignment is eligible for the class, trainer and complete
session interval according to ClassSetupService (the same service as the available API).
No match or multiple matches produces a row/column D error. An explicit ID must exist,
be active, belong to the class/trainer/current curriculum and cover the full interval.
Preview, edited-row Recheck and confirmation share these checks; confirmation repeats
them under the existing schedule write lock. Preview does not mark assignments as used.
Topic ID remains independent: the legacy scheduling reference contract must also verify
it. No Subject ID or ProgramSubject ID is converted into a Topic ID.

Download the template for the exact column names. Required columns are Class ID,
Topic ID, Trainer ID, Session Title, Start Time and End Time. Provide either a Room ID,
a recognized Location / Room or a Meeting URL. Whole-number IDs such as 1 and 1.0
are accepted; zero, negative, fractional and out-of-range IDs are rejected. Use Excel date/time
cells or ISO date-times such as 2026-10-28T09:00 (2026-10-28 09:00 is also accepted).
Excel .xlsx/.xls files, formulas and UTF-8 CSV files are supported. Required fields,
positive exact IDs, real date-times, title/location/URL length limits and supplied
meeting URL format are checked on both file and edited-row imports. All field errors
are returned per row. Scheduling checks still enforce active class/trainer/assignment,
class and assignment date ranges, holidays, working hours, valid room/online venue,
and class/trainer/room conflicts against existing bookings and other submitted rows.
Adjacent time intervals are allowed. Both file and JSON endpoints require SESSION_READ
and SESSION_CREATE; client-side "valid" flags never bypass server checks.

## Importing new teaching assignment details

Download the current template from Teaching Assignments > Import. Fill the first
`Import` sheet, or use UTF-8 CSV with these headers:

```csv
Class Name,Class Start Date,Class End Date,Planned Size,Program Name,Program Version,Subject Name,Duration Hours,Trainer Name,Trainer Email,Role,Effective From,Effective To
Java November A,2026-11-01,2026-12-31,25,Java Foundation,1.0,Java Basics,40,Nguyen Van An,an@example.com,MAIN,2026-11-01,2026-11-30
```

New class names create a class, program, subject and assignment. The system generates
IDs. Existing classes are reused only when name, dates, planned size, program name/version
and subject name/duration match. Deleting assignments keeps reference data, so reimporting
the same details recreates deleted assignments without duplicating classes or subjects.
Existing overlapping assignments still fail. Trainers are reused when the active trainer's name
and email both match; conflicting trainer details fail the row. `Effective To` is
optional. Duration Hours may also be blank when the optional `Teaching Slots`
column is supplied; the server calculates hours from those intervals. Otherwise,
Duration Hours must be a positive number (fractional hours are supported).
Teaching Slots uses `YYYY-MM-DD HH:mm-HH:mm; YYYY-MM-DD HH:mm-HH:mm`; each slot must
be longer than 30 minutes. Dates must be ISO `YYYY-MM-DD` or Excel date cells, new
classes must start tomorrow or later in Vietnam time, and assignment dates must
fall within class dates. Planned Size is 1–10000. Up to 1000 rows are supported.

Each row commits independently; failure rolls back all records created for that
row. Creation requires the same class, program, subject, trainer and assignment
permissions as the create form. Existing ID-based imports remain supported; the
`Existing Assignments` sheet provides those headers for a separate workbook/CSV.
Old files containing only IDs and display names cannot create full new records:
copy their data into the new template and supply the missing details.

## Connecting the shared service

Run without the `local` and `schedule-demo` profiles and set `EXTERNAL_API_BASE_URL` (default
`http://localhost:9090`) and `EXTERNAL_API_TOKEN` when needed. The shared service
must expose `GET /api/classes`, `GET /api/classes/{id}`, `GET /api/trainers`, and
`GET /api/rooms`. Class and trainer lists accept the `status` query parameter.
Session scheduling also requires teaching-assignment and holiday reference endpoints (default /api/teaching-assignments and /api/holidays; configurable using schedule.references.assignments-path and schedule.references.holidays-path).
This mode does not silently substitute sample data if the shared service fails.

The application port (8080) and the external API base URL (default 9090) have different
roles. Do not repoint the external base at this application without checking endpoint
contracts: the legacy scheduling provider expects a list with topicId/status, while
the local teaching-assignment API returns its own paginated Subject/ProgramSubject model.
See [the Session import data audit](../docs/session-import-data-audit.md) for the verified
runtime state, missing real inputs and validation results.
