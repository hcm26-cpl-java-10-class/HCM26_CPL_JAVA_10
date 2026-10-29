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
mvn.cmd spring-boot:run '-Dspring-boot.run.profiles=local'
```

From `frontend/`, run `npm.cmd run dev`, then open
<http://localhost:5173/class-setup>. Sign in as `admin@example.com` with the
local seed password `password123`. The page displays a sample-data notice.
Local data uses an in-memory H2 database and is reset when the backend stops.

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

Run without the `local` profile and set `EXTERNAL_API_BASE_URL` (default
`http://localhost:9090`) and `EXTERNAL_API_TOKEN` when needed. The shared service
must expose `GET /api/classes`, `GET /api/classes/{id}`, `GET /api/trainers`, and
`GET /api/rooms`. Class and trainer lists accept the `status` query parameter.
This mode does not silently substitute sample data if the shared service fails.
